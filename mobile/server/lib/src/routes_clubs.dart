import 'dart:convert';

import 'backend.dart';
import 'db.dart';
import 'http.dart';
import 'security.dart';

List<Json> parseSeasons(Object? value) {
  if (value is! List || value.length > 30) throw badRequest('시즌 설정 형식이 올바르지 않습니다.');
  final out = <Json>[];
  for (final item in value) {
    if (item is! Map) throw badRequest('시즌 설정 형식이 올바르지 않습니다.');
    final s = Map<String, dynamic>.from(item);
    final label = s.str('label', max: 30);
    final start = parseDay(s['startDate'] as String?, '시즌 시작');
    final end = parseDay(s['endDate'] as String?, '시즌 종료');
    if (start == null || end == null || start.compareTo(end) > 0) {
      throw badRequest('$label 시즌의 기간을 확인해주세요.');
    }
    out.add({'label': label, 'startDate': start, 'endDate': end});
  }
  return out;
}

String slugify(String name) {
  final base = name.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]+'), '-').replaceAll(RegExp(r'^-|-$'), '');
  return '${base.isEmpty ? 'club' : base}-${randomCode(5).toLowerCase()}';
}

List<Route> clubRoutes(Backend b) {
  final db = b.db;

  Json membershipFor(int clubId, int membershipId) =>
      db.one('SELECT * FROM memberships WHERE id = ? AND club_id = ?', [membershipId, clubId]) ??
      (throw notFound('회원을 찾을 수 없습니다.'));

  /// Shared by direct requests and invite acceptance.
  Json requestMembership(Json club, int accountId, {String? message, int? inviteId, required bool autoApprove}) {
    return db.tx(() {
      final existing = db.one('SELECT * FROM memberships WHERE club_id = ? AND account_id = ?', [club['id'], accountId]);
      final status = autoApprove ? 'approved' : 'pending';
      if (existing != null) {
        switch (existing['status']) {
          case 'approved':
            throw conflict('이미 가입된 동호회입니다.', 'already_member');
          case 'pending':
            throw conflict('이미 가입 신청 중입니다. 운영진 승인을 기다려주세요.', 'already_pending');
          case 'banned':
            throw forbidden('이 동호회는 가입이 제한되어 있습니다.');
        }
        // left / rejected: re-application starts over as a plain member.
        db.run(
            "UPDATE memberships SET status = ?, role = 'member', message = ?, invite_id = ?, requested_at = ?, "
            'decided_at = ?, decided_by = NULL WHERE id = ?',
            [status, message, inviteId, b.nowIso(), autoApprove ? b.nowIso() : null, existing['id']]);
      } else {
        db.insert(
            'INSERT INTO memberships (club_id, account_id, role, status, message, invite_id, requested_at, decided_at) '
            "VALUES (?, ?, 'member', ?, ?, ?, ?, ?)",
            [club['id'], accountId, status, message, inviteId, b.nowIso(), autoApprove ? b.nowIso() : null]);
      }
      b.audit(club['id'] as int, accountId, autoApprove ? 'membership.joined_by_invite' : 'membership.requested', 'account', accountId);
      return db.one('SELECT id, role, status FROM memberships WHERE club_id = ? AND account_id = ?', [club['id'], accountId])!;
    });
  }

  Json? inviteByToken(String token) {
    if (token.length < 16 || token.length > 80) return null;
    return db.one('SELECT * FROM invites WHERE token_hash = ?', [sha256Hex(token)]);
  }

  String? inviteProblem(Json invite) {
    if (invite['revoked_at'] != null) return '폐기된 초대 링크입니다.';
    if ((invite['expires_at'] as String).compareTo(b.nowIso()) <= 0) return '만료된 초대 링크입니다.';
    final max = invite['max_uses'] as int?;
    if (max != null && (invite['use_count'] as int) >= max) return '사용 횟수가 모두 소진된 초대 링크입니다.';
    return null;
  }

  void unlinkAccount(int clubId, int accountId) {
    db.run('UPDATE players SET account_id = NULL, updated_at = ? WHERE club_id = ? AND account_id = ?', [b.nowIso(), clubId, accountId]);
    db.run("UPDATE player_links SET status = 'cancelled', decided_at = ? WHERE club_id = ? AND account_id = ? AND status = 'pending'",
        [b.nowIso(), clubId, accountId]);
  }

  Json memberJson(Json m, {required bool full}) => {
        'membershipId': m['id'],
        'accountId': m['account_id'],
        'displayName': m['display_name'],
        'role': m['role'],
        'status': m['status'],
        if (full) 'message': m['message'],
        if (full) 'requestedAt': m['requested_at'],
        if (full) 'viaInvite': m['invite_id'] != null,
        'linkedPlayer': m['player_id'] == null ? null : {'id': m['player_id'], 'name': m['player_name']},
      };

  return [
    Route('GET', '/clubs', (ctx) {
      final q = (ctx.query['q'] ?? '').trim();
      if (q.length > 50) throw badRequest('검색어가 너무 깁니다.');
      final rows = db.all(
          "SELECT * FROM clubs WHERE (visibility = 'public' OR discoverable = 1) "
          "AND (? = '' OR name LIKE ? ESCAPE '\\' OR IFNULL(region,'') LIKE ? ESCAPE '\\' OR IFNULL(description,'') LIKE ? ESCAPE '\\') "
          "ORDER BY CASE source WHEN 'arena_import' THEN 0 WHEN 'user_created' THEN 1 ELSE 2 END, name",
          [q, ...List.filled(3, '%${q.replaceAll(r'\', r'\\').replaceAll('%', r'\%').replaceAll('_', r'\_')}%')]);
      return {'clubs': [for (final c in rows) b.clubJson(c, b.viewer(ctx, c))]};
    }),

    Route('POST', '/clubs', (ctx) async {
      final accountId = ctx.accountId;
      final body = await ctx.json();
      final name = body.str('name', max: 40, min: 2);
      final visibility = body.oneOf('visibility', ['public', 'private'], fallback: 'public');
      final club = db.tx(() {
        final id = db.insert(
            'INSERT INTO clubs (slug, name, region, description, visibility, discoverable, records_visibility, join_policy, '
            "seasons_json, source, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?, 'user_created', ?, ?, ?)",
            [
              slugify(name), name, body.optStr('region', max: 40), body.optStr('description', max: 1000),
              visibility,
              (body.optBool('discoverable') ?? visibility == 'public') ? 1 : 0,
              // New clubs keep internal records for members unless changed later.
              visibility == 'private' ? 'members' : body.oneOf('recordsVisibility', ['public', 'members'], fallback: 'members'),
              body.oneOf('joinPolicy', ['approval', 'invite_only'], fallback: 'approval'),
              jsonEncode(body['seasons'] == null ? [] : parseSeasons(body['seasons'])),
              accountId, b.nowIso(), b.nowIso(),
            ]);
        db.insert(
            "INSERT INTO memberships (club_id, account_id, role, status, requested_at, decided_at) VALUES (?, ?, 'owner', 'approved', ?, ?)",
            [id, accountId, b.nowIso(), b.nowIso()]);
        b.audit(id, accountId, 'club.created', 'club', id);
        return b.loadClub(id);
      });
      return Created({'club': b.clubJson(club, b.viewer(ctx, club))});
    }),

    Route('GET', '/clubs/:clubId', (ctx) {
      final (:club, :viewer) = b.clubFor(ctx);
      return {'club': b.clubJson(club, viewer)};
    }),

    Route('PATCH', '/clubs/:clubId', (ctx) async {
      final (:club, :viewer) = b.clubFor(ctx, role: 'manager');
      final body = await ctx.json();
      final updates = <String, Object?>{};
      if (body.containsKey('name')) updates['name'] = body.str('name', max: 40, min: 2);
      if (body.containsKey('region')) updates['region'] = body.optStr('region', max: 40);
      if (body.containsKey('description')) updates['description'] = body.optStr('description', max: 1000);
      if (body.containsKey('activityNote')) updates['activity_note'] = body.optStr('activityNote', max: 200);
      if (body.containsKey('visibility')) updates['visibility'] = body.oneOf('visibility', ['public', 'private']);
      if (body.containsKey('discoverable')) updates['discoverable'] = body.optBool('discoverable') == true ? 1 : 0;
      if (body.containsKey('recordsVisibility')) updates['records_visibility'] = body.oneOf('recordsVisibility', ['public', 'members']);
      if (body.containsKey('joinPolicy')) updates['join_policy'] = body.oneOf('joinPolicy', ['approval', 'invite_only']);
      if (body.containsKey('seasons')) updates['seasons_json'] = jsonEncode(parseSeasons(body['seasons']));
      if (body.containsKey('minWinRateMatches')) updates['min_win_rate_matches'] = body.optInt('minWinRateMatches', min: 1, max: 50) ?? 3;
      if ((updates['visibility'] ?? club['visibility']) == 'private') updates['records_visibility'] = 'members';
      if (updates.isEmpty) throw badRequest('변경할 항목이 없습니다.');
      db.tx(() {
        db.run('UPDATE clubs SET ${updates.keys.map((k) => '$k = ?').join(', ')}, updated_at = ? WHERE id = ?',
            [...updates.values, b.nowIso(), club['id']]);
        b.audit(club['id'] as int, ctx.accountId, 'club.updated', 'club', club['id'], updates.keys.toList());
      });
      final fresh = b.loadClub(club['id'] as int);
      return {'club': b.clubJson(fresh, b.viewer(ctx, fresh))};
    }),

    Route('POST', '/clubs/:clubId/logo', (ctx) async {
      final (:club, :viewer) = b.clubFor(ctx, role: 'manager');
      final bytes = await b.readImageUpload(ctx);
      db.tx(() {
        final id = b.saveFile(bytes, clubId: club['id'] as int, kind: 'club_logo');
        db.run('UPDATE clubs SET logo_file_id = ?, updated_at = ? WHERE id = ?', [id, b.nowIso(), club['id']]);
      });
      final fresh = b.loadClub(club['id'] as int);
      return {'club': b.clubJson(fresh, b.viewer(ctx, fresh))};
    }),

    // ------------------------------------------------------------ joining
    Route('POST', '/clubs/:clubId/join', (ctx) async {
      final accountId = ctx.accountId;
      final (:club, :viewer) = b.clubFor(ctx);
      if (club['join_policy'] == 'invite_only') {
        throw forbidden('이 동호회는 초대 링크로만 가입할 수 있습니다.');
      }
      final body = ctx.request.headers['content-type']?.contains('json') == true ? await ctx.json() : <String, dynamic>{};
      final m = requestMembership(club, accountId, message: body.optStr('message', max: 300), autoApprove: false);
      return Created({'membership': m});
    }),

    Route('GET', '/invites/:token', (ctx) {
      final invite = inviteByToken(ctx.params['token']!) ?? (throw notFound('초대 링크를 찾을 수 없습니다.'));
      final club = b.loadClub(invite['club_id'] as int);
      final problem = inviteProblem(invite);
      return {
        'valid': problem == null,
        'problem': problem,
        'expiresAt': invite['expires_at'],
        'autoApprove': club['join_policy'] == 'invite_only',
        'club': problem == null || club['visibility'] == 'public' ? b.clubJson(club, b.viewer(ctx, club)) : null,
      };
    }),

    Route('POST', '/invites/:token/accept', (ctx) async {
      final accountId = ctx.accountId;
      final body = ctx.request.headers['content-type']?.contains('json') == true ? await ctx.json() : <String, dynamic>{};
      final result = db.tx(() {
        final invite = inviteByToken(ctx.params['token']!) ?? (throw notFound('초대 링크를 찾을 수 없습니다.'));
        final problem = inviteProblem(invite);
        if (problem != null) throw ApiError(410, problem, 'invite_invalid');
        final club = b.loadClub(invite['club_id'] as int);
        // An invite never grants more than a plain membership.
        final m = requestMembership(club, accountId,
            message: body.optStr('message', max: 300),
            inviteId: invite['id'] as int,
            autoApprove: club['join_policy'] == 'invite_only');
        db.run('UPDATE invites SET use_count = use_count + 1 WHERE id = ?', [invite['id']]);
        return {'clubId': club['id'], 'membership': m};
      });
      return Created(result);
    }),

    Route('POST', '/clubs/:clubId/leave', (ctx) {
      final accountId = ctx.accountId;
      final (:club, :viewer) = b.clubFor(ctx);
      final m = viewer.membership;
      if (m == null || !['approved', 'pending'].contains(m['status'])) throw notFound('가입 정보가 없습니다.');
      if (viewer.role == 'owner') throw conflict('소유자는 소유권을 이전한 뒤 탈퇴할 수 있습니다.', 'owner_must_transfer');
      db.tx(() {
        db.run("UPDATE memberships SET status = 'left', role = 'member', decided_at = ? WHERE id = ?", [b.nowIso(), m['id']]);
        // Records stay; only the account's control over the profile ends.
        unlinkAccount(club['id'] as int, accountId);
        b.audit(club['id'] as int, accountId, 'membership.left', 'membership', m['id']);
      });
      return {'ok': true};
    }),

    // ------------------------------------------------------------ members
    Route('GET', '/clubs/:clubId/members', (ctx) {
      final (:club, :viewer) = b.clubFor(ctx, role: 'member');
      final full = viewer.atLeast('manager');
      final rows = db.all(
          'SELECT m.*, a.display_name, p.id AS player_id, p.name AS player_name FROM memberships m '
          'JOIN accounts a ON a.id = m.account_id '
          'LEFT JOIN players p ON p.club_id = m.club_id AND p.account_id = m.account_id '
          "WHERE m.club_id = ? AND (? OR m.status = 'approved') "
          "ORDER BY CASE m.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, "
          "CASE m.role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 WHEN 'recorder' THEN 2 ELSE 3 END, a.display_name",
          [club['id'], full ? 1 : 0]);
      return {'members': [for (final m in rows) memberJson(m, full: full)]};
    }),

    Route('POST', '/clubs/:clubId/members/:membershipId/decision', (ctx) async {
      final (:club, :viewer) = b.clubFor(ctx, role: 'manager');
      final action = (await ctx.json()).oneOf('action', ['approve', 'reject']);
      db.tx(() {
        final m = membershipFor(club['id'] as int, ctx.intParam('membershipId'));
        if (m['status'] != 'pending') throw conflict('승인 대기 중인 신청이 아닙니다.');
        db.run('UPDATE memberships SET status = ?, decided_at = ?, decided_by = ? WHERE id = ?',
            [action == 'approve' ? 'approved' : 'rejected', b.nowIso(), ctx.accountId, m['id']]);
        b.audit(club['id'] as int, ctx.accountId, 'membership.$action', 'membership', m['id']);
      });
      return {'ok': true};
    }),

    Route('POST', '/clubs/:clubId/members/:membershipId/role', (ctx) async {
      final (:club, :viewer) = b.clubFor(ctx, role: 'manager');
      final role = (await ctx.json()).oneOf('role', ['manager', 'recorder', 'member']);
      db.tx(() {
        final m = membershipFor(club['id'] as int, ctx.intParam('membershipId'));
        if (m['account_id'] == ctx.accountId) throw forbidden('자신의 역할은 변경할 수 없습니다.');
        if (m['status'] != 'approved') throw conflict('승인된 회원의 역할만 변경할 수 있습니다.');
        if (m['role'] == 'owner') throw forbidden('소유자의 역할은 소유권 이전으로만 바꿀 수 있습니다.');
        // Only the owner appoints or dismisses managers.
        if ((role == 'manager' || m['role'] == 'manager') && !viewer.atLeast('owner')) {
          throw forbidden('운영진 지정·해제는 소유자만 할 수 있습니다.');
        }
        db.run('UPDATE memberships SET role = ? WHERE id = ?', [role, m['id']]);
        b.audit(club['id'] as int, ctx.accountId, 'membership.role', 'membership', m['id'], {'from': m['role'], 'to': role});
      });
      return {'ok': true};
    }),

    Route('POST', '/clubs/:clubId/members/:membershipId/status', (ctx) async {
      final (:club, :viewer) = b.clubFor(ctx, role: 'manager');
      final action = (await ctx.json()).oneOf('action', ['remove', 'ban', 'unban']);
      db.tx(() {
        final m = membershipFor(club['id'] as int, ctx.intParam('membershipId'));
        if (m['account_id'] == ctx.accountId) throw forbidden('자기 자신에게는 사용할 수 없습니다.');
        if (m['role'] == 'owner' && m['status'] == 'approved') throw forbidden('소유자는 내보낼 수 없습니다.');
        if (m['status'] == 'approved' && roleRank[m['role']]! >= viewer.rank) {
          throw forbidden('같거나 높은 역할의 회원은 관리할 수 없습니다.');
        }
        final next = switch (action) {
          'ban' => 'banned',
          'unban' when m['status'] == 'banned' => 'left',
          'remove' when m['status'] == 'approved' => 'left',
          _ => throw conflict('현재 상태에서는 처리할 수 없습니다.'),
        };
        db.run("UPDATE memberships SET status = ?, role = 'member', decided_at = ?, decided_by = ? WHERE id = ?",
            [next, b.nowIso(), ctx.accountId, m['id']]);
        if (next != 'left' || action == 'remove') unlinkAccount(club['id'] as int, m['account_id'] as int);
        b.audit(club['id'] as int, ctx.accountId, 'membership.$action', 'membership', m['id']);
      });
      return {'ok': true};
    }),

    Route('POST', '/clubs/:clubId/transfer-ownership', (ctx) async {
      final (:club, :viewer) = b.clubFor(ctx, role: 'owner');
      final targetId = (await ctx.json()).optInt('membershipId', min: 1) ?? (throw badRequest('membershipId 값을 입력해주세요.'));
      db.tx(() {
        final target = membershipFor(club['id'] as int, targetId);
        if (target['status'] != 'approved' || target['account_id'] == ctx.accountId) {
          throw conflict('승인된 다른 회원에게만 이전할 수 있습니다.');
        }
        db.run("UPDATE memberships SET role = 'manager' WHERE id = ?", [viewer.membership!['id']]);
        db.run("UPDATE memberships SET role = 'owner' WHERE id = ?", [target['id']]);
        b.audit(club['id'] as int, ctx.accountId, 'club.ownership_transferred', 'membership', target['id']);
      });
      return {'ok': true};
    }),

    // ------------------------------------------------------------ invites
    Route('GET', '/clubs/:clubId/invites', (ctx) {
      final (:club, :viewer) = b.clubFor(ctx, role: 'manager');
      return {
        'invites': [
          for (final i in db.all('SELECT * FROM invites WHERE club_id = ? ORDER BY id DESC', [club['id']]))
            {
              'id': i['id'],
              'hint': i['token_hint'],
              'expiresAt': i['expires_at'],
              'maxUses': i['max_uses'],
              'useCount': i['use_count'],
              'revoked': i['revoked_at'] != null,
              'problem': inviteProblem(i),
            }
        ]
      };
    }),

    Route('POST', '/clubs/:clubId/invites', (ctx) async {
      final (:club, :viewer) = b.clubFor(ctx, role: 'manager');
      final body = await ctx.json();
      final days = body.optInt('days', min: 1, max: 30) ?? 7;
      final maxUses = body.optInt('maxUses', min: 1, max: 500);
      final token = randomToken(24);
      final expires = iso(b.now().add(Duration(days: days)));
      final id = db.tx(() {
        final id = db.insert(
            'INSERT INTO invites (club_id, token_hash, token_hint, created_by, expires_at, max_uses, created_at) VALUES (?,?,?,?,?,?,?)',
            [club['id'], sha256Hex(token), token.substring(0, 4), ctx.accountId, expires, maxUses, b.nowIso()]);
        b.audit(club['id'] as int, ctx.accountId, 'invite.created', 'invite', id);
        return id;
      });
      // The raw token is returned once and never stored.
      return Created({'id': id, 'token': token, 'link': 'arenaclub://app/invite/$token', 'expiresAt': expires, 'maxUses': maxUses});
    }),

    Route('POST', '/clubs/:clubId/invites/:inviteId/revoke', (ctx) {
      final (:club, :viewer) = b.clubFor(ctx, role: 'manager');
      final n = db.run('UPDATE invites SET revoked_at = ? WHERE id = ? AND club_id = ? AND revoked_at IS NULL',
          [b.nowIso(), ctx.intParam('inviteId'), club['id']]);
      if (n == 0) throw notFound('초대 링크를 찾을 수 없습니다.');
      b.audit(club['id'] as int, ctx.accountId, 'invite.revoked', 'invite', ctx.params['inviteId']);
      return {'ok': true};
    }),

    // ------------------------------------------------- player-account links
    Route('POST', '/clubs/:clubId/players/:playerId/link-requests', (ctx) {
      final (:club, :viewer) = b.clubFor(ctx, role: 'member');
      final playerId = ctx.intParam('playerId');
      final id = db.tx(() {
        final player = db.one('SELECT * FROM players WHERE id = ? AND club_id = ?', [playerId, club['id']]) ?? (throw notFound('선수를 찾을 수 없습니다.'));
        if (player['account_id'] != null) throw conflict('이미 다른 계정과 연결된 선수입니다.');
        if (db.scalar('SELECT id FROM players WHERE club_id = ? AND account_id = ?', [club['id'], ctx.accountId]) != null) {
          throw conflict('이 동호회에서 이미 연결된 선수 프로필이 있습니다.');
        }
        if (db.scalar("SELECT id FROM player_links WHERE club_id = ? AND account_id = ? AND status = 'pending'", [club['id'], ctx.accountId]) != null) {
          throw conflict('이미 연결 신청 중입니다.', 'already_pending');
        }
        final id = db.insert(
            "INSERT INTO player_links (club_id, player_id, account_id, status, requested_at) VALUES (?, ?, ?, 'pending', ?)",
            [club['id'], playerId, ctx.accountId, b.nowIso()]);
        b.audit(club['id'] as int, ctx.accountId, 'player_link.requested', 'player', playerId);
        return id;
      });
      return Created({'id': id, 'status': 'pending'});
    }),

    Route('DELETE', '/clubs/:clubId/link-requests/mine', (ctx) {
      final (:club, :viewer) = b.clubFor(ctx);
      final n = db.run("UPDATE player_links SET status = 'cancelled', decided_at = ? WHERE club_id = ? AND account_id = ? AND status = 'pending'",
          [b.nowIso(), club['id'], ctx.accountId]);
      if (n == 0) throw notFound('진행 중인 연결 신청이 없습니다.');
      return {'ok': true};
    }),

    Route('GET', '/clubs/:clubId/link-requests', (ctx) {
      final (:club, :viewer) = b.clubFor(ctx, role: 'manager');
      final rows = db.all(
          'SELECT l.*, a.display_name, p.name AS player_name, p.nickname FROM player_links l '
          'JOIN accounts a ON a.id = l.account_id JOIN players p ON p.id = l.player_id '
          "WHERE l.club_id = ? AND l.status = 'pending' ORDER BY l.id",
          [club['id']]);
      return {
        'requests': [
          for (final r in rows)
            {
              'id': r['id'],
              'requestedAt': r['requested_at'],
              'account': {'id': r['account_id'], 'displayName': r['display_name']},
              'player': {'id': r['player_id'], 'name': r['player_name'], 'nickname': r['nickname']},
            }
        ]
      };
    }),

    Route('POST', '/clubs/:clubId/link-requests/:linkId/decision', (ctx) async {
      final (:club, :viewer) = b.clubFor(ctx, role: 'manager');
      final action = (await ctx.json()).oneOf('action', ['approve', 'reject']);
      db.tx(() {
        final link = db.one("SELECT * FROM player_links WHERE id = ? AND club_id = ? AND status = 'pending'",
                [ctx.intParam('linkId'), club['id']]) ??
            (throw notFound('연결 신청을 찾을 수 없습니다.'));
        if (action == 'approve') {
          final member = db.one("SELECT status FROM memberships WHERE club_id = ? AND account_id = ?", [club['id'], link['account_id']]);
          if (member?['status'] != 'approved') throw conflict('승인된 회원만 선수와 연결할 수 있습니다.');
          final player = db.one('SELECT account_id FROM players WHERE id = ? AND club_id = ?', [link['player_id'], club['id']])!;
          if (player['account_id'] != null) throw conflict('이미 다른 계정과 연결된 선수입니다.');
          db.run('UPDATE players SET account_id = ?, updated_at = ? WHERE id = ?', [link['account_id'], b.nowIso(), link['player_id']]);
        }
        db.run('UPDATE player_links SET status = ?, decided_at = ?, decided_by = ? WHERE id = ?',
            [action == 'approve' ? 'approved' : 'rejected', b.nowIso(), ctx.accountId, link['id']]);
        b.audit(club['id'] as int, ctx.accountId, 'player_link.$action', 'player', link['player_id'], {'account': link['account_id']});
      });
      return {'ok': true};
    }),

    Route('POST', '/clubs/:clubId/players/:playerId/unlink', (ctx) {
      final (:club, :viewer) = b.clubFor(ctx, role: 'member');
      db.tx(() {
        final player = db.one('SELECT * FROM players WHERE id = ? AND club_id = ?', [ctx.intParam('playerId'), club['id']]) ??
            (throw notFound('선수를 찾을 수 없습니다.'));
        if (player['account_id'] == null) throw conflict('연결된 계정이 없습니다.');
        if (player['account_id'] != ctx.accountId && !viewer.atLeast('manager')) throw forbidden();
        db.run('UPDATE players SET account_id = NULL, updated_at = ? WHERE id = ?', [b.nowIso(), player['id']]);
        b.audit(club['id'] as int, ctx.accountId, 'player_link.removed', 'player', player['id']);
      });
      return {'ok': true};
    }),

    Route('GET', '/clubs/:clubId/audit', (ctx) {
      final (:club, :viewer) = b.clubFor(ctx, role: 'manager');
      final rows = db.all(
          'SELECT l.*, a.display_name FROM audit_logs l LEFT JOIN accounts a ON a.id = l.actor_account_id '
          'WHERE l.club_id = ? ORDER BY l.id DESC LIMIT 100',
          [club['id']]);
      return {
        'entries': [
          for (final r in rows)
            {
              'id': r['id'],
              'action': r['action'],
              'targetType': r['target_type'],
              'targetId': r['target_id'],
              'actor': r['display_name'] ?? '시스템',
              'createdAt': r['created_at'],
              'detail': r['detail_json'] == null ? null : jsonDecode(r['detail_json'] as String),
            }
        ]
      };
    }),

    Route('GET', '/me/clubs', (ctx) {
      final rows = db.all(
          'SELECT c.* FROM memberships m JOIN clubs c ON c.id = m.club_id '
          "WHERE m.account_id = ? AND m.status IN ('approved','pending') ORDER BY c.name",
          [ctx.accountId]);
      return {'clubs': [for (final c in rows) b.clubJson(c, b.viewer(ctx, c))]};
    }),
  ];
}
