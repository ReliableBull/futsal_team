import 'dart:convert';

import 'backend.dart';
import 'db.dart';
import 'http.dart';
import 'stats.dart';

const positions = ['GK', 'DF', 'MF', 'FW', '골키퍼', '수비수', '미드필더', '공격수', '윙어', '피보', '아라', '픽소'];
const matchStatuses = ['scheduled', 'in_progress', 'completed', 'cancelled'];

/// Everything needed to aggregate one club. Every query is scoped by club_id.
class ClubData {
  ClubData(this.players, this.matches);
  final Map<int, StatPlayer> players;
  final List<StatMatch> matches;
}

ClubData loadClubData(Backend b, int clubId) {
  final db = b.db;
  final players = {
    for (final p in db.all('SELECT * FROM players WHERE club_id = ?', [clubId]))
      p['id'] as int: StatPlayer(
        p['id'] as int,
        p['name'] as String,
        p['nickname'] as String?,
        flag(p['is_active']),
        flag(p['is_guest']),
        {
          'number': p['number'],
          'position': p['position'],
          'photoUrl': b.fileUrl(p['photo_file_id']),
        },
      ),
  };
  final lines = <int, List<StatLine>>{};
  for (final r in db.all('SELECT * FROM match_players WHERE club_id = ?', [clubId])) {
    (lines[r['match_id'] as int] ??= []).add(StatLine(
        r['player_id'] as int, r['team'] as String, r['goals'] as int, r['assists'] as int, flag(r['is_mom'])));
  }
  final goals = <int, List<StatGoal>>{};
  for (final r in db.all('SELECT * FROM match_goals WHERE club_id = ? ORDER BY match_id, scorer_player_id, sequence', [clubId])) {
    (goals[r['match_id'] as int] ??= []).add(
        StatGoal(r['scorer_player_id'] as int, r['assist_player_id'] as int?, flag(r['assist_known'])));
  }
  final matches = [
    for (final m in db.all('SELECT * FROM matches WHERE club_id = ?', [clubId]))
      StatMatch(
        id: m['id'] as int,
        date: m['match_date'] as String,
        status: m['status'] as String,
        teamAName: m['team_a_name'] as String,
        teamBName: m['team_b_name'] as String,
        scoreA: m['team_a_score'] as int?,
        scoreB: m['team_b_score'] as int?,
        lines: lines[m['id']] ?? const [],
        goals: goals[m['id']] ?? const [],
      ),
  ];
  return ClubData(players, matches);
}

String? winnerOf(Json m) {
  final a = m['team_a_score'] as int?, bScore = m['team_b_score'] as int?;
  if (a == null || bScore == null || m['status'] != 'completed') return null;
  return a > bScore ? 'A' : (a < bScore ? 'B' : 'draw');
}

List<Route> recordRoutes(Backend b) {
  final db = b.db;

  Json matchSummary(Json m) => {
        'id': m['id'],
        'matchDate': m['match_date'],
        'startTime': m['start_time'],
        'location': m['location'],
        'status': m['status'],
        'teamAName': m['team_a_name'],
        'teamBName': m['team_b_name'],
        'teamAScore': m['team_a_score'],
        'teamBScore': m['team_b_score'],
        'winner': winnerOf(m),
        'countsForStats': m['status'] == 'completed' && m['team_a_score'] != null && m['team_b_score'] != null,
        'source': m['source'],
      };

  Json matchDetail(int clubId, int matchId) {
    final m = db.one('SELECT * FROM matches WHERE id = ? AND club_id = ?', [matchId, clubId]) ?? (throw notFound('경기를 찾을 수 없습니다.'));
    final players = db.all(
        'SELECT mp.*, p.name, p.nickname, p.photo_file_id, p.number, p.is_guest FROM match_players mp '
        'JOIN players p ON p.id = mp.player_id WHERE mp.match_id = ? AND mp.club_id = ? ORDER BY mp.team, p.name',
        [matchId, clubId]);
    final names = {for (final p in players) p['player_id']: p['name']};
    final goals = db.all('SELECT * FROM match_goals WHERE match_id = ? AND club_id = ? ORDER BY id', [matchId, clubId]);
    final posters = db.all('SELECT * FROM posters WHERE match_id = ? AND club_id = ? ORDER BY id', [matchId, clubId]);
    return {
      ...matchSummary(m),
      'memo': m['memo'],
      'version': m['version'],
      'players': [
        for (final p in players)
          {
            'playerId': p['player_id'],
            'team': p['team'],
            'goals': p['goals'],
            'assists': p['assists'],
            'isMom': flag(p['is_mom']),
            'player': {
              'id': p['player_id'],
              'name': p['name'],
              'nickname': p['nickname'],
              'number': p['number'],
              'isGuest': flag(p['is_guest']),
              'photoUrl': b.fileUrl(p['photo_file_id']),
            },
          }
      ],
      'goals': [
        for (final g in goals)
          {
            'scorerId': g['scorer_player_id'],
            'scorerName': names[g['scorer_player_id']],
            'assistId': g['assist_player_id'],
            'assistName': names[g['assist_player_id']],
            'assistKnown': flag(g['assist_known']),
            'sequence': g['sequence'],
          }
      ],
      'posters': [for (final p in posters) {'id': p['id'], 'url': b.fileUrl(p['file_id'])}],
    };
  }

  Json playerRow(int clubId, int playerId) =>
      db.one('SELECT * FROM players WHERE id = ? AND club_id = ?', [playerId, clubId]) ?? (throw notFound('선수를 찾을 수 없습니다.'));

  Json playerFields(Json body, {required bool create, required bool manager}) {
    final out = <String, Object?>{};
    if (create || body.containsKey('name')) {
      if (!manager) throw forbidden('이름은 운영진만 수정할 수 있습니다.');
      out['name'] = body.str('name', max: 30);
    }
    if (body.containsKey('nickname')) out['nickname'] = body.optStr('nickname', max: 60);
    if (body.containsKey('position')) {
      final pos = body.optStr('position', max: 20);
      if (pos != null && !positions.contains(pos)) throw badRequest('포지션을 다시 선택해주세요.');
      out['position'] = pos;
    }
    for (final (key, column) in [('number', 'number'), ('isGuest', 'is_guest'), ('isActive', 'is_active')]) {
      if (!body.containsKey(key)) continue;
      if (!manager) throw forbidden('등번호·활동 상태는 운영진만 수정할 수 있습니다.');
      out[column] = key == 'number' ? body.optInt('number', min: 0, max: 999) : ((body.optBool(key) ?? false) ? 1 : 0);
    }
    return out;
  }

  /// Validates and normalises a match payload against this club's players.
  Json parseMatch(int clubId, Json body) {
    final status = body.oneOf('status', matchStatuses);
    final date = parseDay(body['matchDate'] as String?, '경기') ?? (throw badRequest('경기 날짜를 입력해주세요.'));
    final startTime = body.optStr('startTime', max: 5);
    if (startTime != null && !RegExp(r'^([01]\d|2[0-3]):[0-5]\d$').hasMatch(startTime)) throw badRequest('시작 시간을 HH:MM 형식으로 입력해주세요.');
    final teamA = body.str('teamAName', max: 20), teamB = body.str('teamBName', max: 20);
    if (teamA == teamB) throw badRequest('두 팀의 이름을 다르게 입력해주세요.');
    var scoreA = body.optInt('teamAScore', max: 99), scoreB = body.optInt('teamBScore', max: 99);
    final live = status == 'completed' || status == 'in_progress';
    if (live && (scoreA == null || scoreB == null)) throw badRequest('경기 중·완료 경기는 양 팀 점수를 입력해주세요.');
    if (!live) scoreA = scoreB = null;

    final rawPlayers = body['players'] ?? [];
    if (rawPlayers is! List || rawPlayers.length > 60) throw badRequest('출전 명단 형식이 올바르지 않습니다.');
    final lines = <int, Json>{};
    for (final raw in rawPlayers) {
      if (raw is! Map) throw badRequest('출전 명단 형식이 올바르지 않습니다.');
      final p = Map<String, dynamic>.from(raw);
      final id = p.optInt('playerId', min: 1) ?? (throw badRequest('선수를 선택해주세요.'));
      if (lines.containsKey(id)) throw badRequest('같은 선수를 두 번 배정할 수 없습니다.');
      lines[id] = {
        'team': p.oneOf('team', ['A', 'B']),
        'mom': live && (p.optBool('isMom') ?? false),
        'assists': p.optInt('assists', max: 50),
        'goals': 0,
        'known': 0,
        'unknownLinks': 0,
      };
    }
    if (lines.isNotEmpty) {
      final ids = lines.keys.toList();
      final found = db.scalar('SELECT COUNT(*) FROM players WHERE club_id = ? AND id IN (${List.filled(ids.length, '?').join(',')})', [clubId, ...ids]);
      if (found != ids.length) throw badRequest('이 동호회에 등록되지 않은 선수가 포함되어 있습니다.');
    }

    final rawGoals = body['goals'] ?? [];
    if (rawGoals is! List || rawGoals.length > 99) throw badRequest('득점 기록 형식이 올바르지 않습니다.');
    if (!live && rawGoals.isNotEmpty) throw badRequest('예정·취소 경기에는 득점을 기록할 수 없습니다.');
    final goals = <Json>[];
    final sequence = <int, int>{};
    for (final raw in rawGoals) {
      if (raw is! Map) throw badRequest('득점 기록 형식이 올바르지 않습니다.');
      final g = Map<String, dynamic>.from(raw);
      final scorer = g.optInt('scorerId', min: 1);
      final line = lines[scorer];
      if (line == null) throw badRequest('득점자는 출전 명단에 있어야 합니다.');
      final assist = g['assistId'];
      int? assistId;
      var known = true;
      if (assist == 'UNKNOWN') {
        known = false;
        line['unknownLinks'] = (line['unknownLinks'] as int) + 1;
      } else if (assist != null) {
        if (assist is! int || lines[assist] == null) throw badRequest('도움 선수는 출전 명단에 있어야 합니다.');
        if (assist == scorer) throw badRequest('자기 자신에게 도움을 기록할 수 없습니다.');
        if (lines[assist]!['team'] != line['team']) throw badRequest('도움은 같은 팀 선수만 기록할 수 있습니다.');
        assistId = assist;
        lines[assist]!['known'] = (lines[assist]!['known'] as int) + 1;
      }
      line['goals'] = (line['goals'] as int) + 1;
      sequence[scorer!] = (sequence[scorer] ?? 0) + 1;
      goals.add({'scorer': scorer, 'assist': assistId, 'known': known, 'sequence': sequence[scorer]});
    }
    final anyUnknown = goals.any((g) => g['known'] == false);
    for (final entry in lines.entries) {
      final known = entry.value['known'] as int;
      final given = entry.value['assists'] as int?;
      // Without unknown links, assists are exactly the recorded links.
      // With unknown links (legacy data), a preserved total may be larger.
      if (!anyUnknown || given == null) {
        entry.value['assists'] = known;
      } else if (given < known) {
        throw badRequest('도움 합계는 연결된 도움 수보다 작을 수 없습니다.');
      }
    }
    if (live) {
      for (final (team, score) in [('A', scoreA!), ('B', scoreB!)]) {
        final sum = lines.values.where((l) => l['team'] == team).fold<int>(0, (s, l) => s + (l['goals'] as int));
        if (sum > score) throw badRequest('${team == 'A' ? teamA : teamB} 선수 득점 합계($sum)가 팀 점수($score)보다 많습니다.');
      }
    }
    return {
      'status': status, 'date': date, 'startTime': startTime, 'location': body.optStr('location', max: 60),
      'teamA': teamA, 'teamB': teamB, 'scoreA': scoreA, 'scoreB': scoreB,
      'memo': body.optStr('memo', max: 2000), 'lines': lines, 'goals': goals,
    };
  }

  void writeChildren(int clubId, int matchId, Json input) {
    db.run('DELETE FROM match_goals WHERE match_id = ?', [matchId]);
    db.run('DELETE FROM match_players WHERE match_id = ?', [matchId]);
    for (final e in (input['lines'] as Map<int, Json>).entries) {
      db.insert('INSERT INTO match_players (club_id, match_id, player_id, team, goals, assists, is_mom) VALUES (?,?,?,?,?,?,?)',
          [clubId, matchId, e.key, e.value['team'], e.value['goals'], e.value['assists'], e.value['mom'] == true ? 1 : 0]);
    }
    for (final g in input['goals'] as List<Json>) {
      db.insert('INSERT INTO match_goals (club_id, match_id, scorer_player_id, assist_player_id, assist_known, sequence) VALUES (?,?,?,?,?,?)',
          [clubId, matchId, g['scorer'], g['assist'], g['known'] == true ? 1 : 0, g['sequence']]);
    }
  }

  Period periodOf(Ctx ctx) => Period.fromQuery(ctx.query);

  return [
    Route('GET', '/clubs/:clubId/dashboard', (ctx) {
      final (:club, :viewer) = b.clubFor(ctx, records: true);
      final period = periodOf(ctx);
      final data = loadClubData(b, club['id'] as int);
      final aggregates = aggregatePlayers(data.players.values.toList(), data.matches, period);
      final completed = db.all(
          "SELECT * FROM matches WHERE club_id = ? AND status = 'completed' ORDER BY match_date DESC, id DESC LIMIT 5", [club['id']]);
      final upcoming = db.all(
          "SELECT * FROM matches WHERE club_id = ? AND status IN ('scheduled','in_progress') ORDER BY match_date, id LIMIT 5", [club['id']]);
      final posters = db.all(
          'SELECT p.id, p.file_id, m.id AS match_id, m.match_date FROM posters p JOIN matches m ON m.id = p.match_id '
          'WHERE p.club_id = ? ORDER BY m.match_date DESC, p.id DESC LIMIT 12', [club['id']]);
      return {
        'club': b.clubJson(club, viewer),
        'period': period.toJson(),
        'countedMatches': countedMatches(data.matches, period).length,
        'latestResult': completed.isEmpty ? null : matchDetail(club['id'] as int, completed.first['id'] as int),
        'recentMatches': completed.map(matchSummary).toList(),
        'upcomingMatches': upcoming.map(matchSummary).toList(),
        'rankings': dashboardRankings(aggregates, club['min_win_rate_matches'] as int),
        'posters': [for (final p in posters) {'id': p['id'], 'url': b.fileUrl(p['file_id']), 'matchId': p['match_id'], 'matchDate': p['match_date']}],
      };
    }),

    Route('GET', '/clubs/:clubId/players', (ctx) {
      final (:club, :viewer) = b.clubFor(ctx, records: true);
      final period = periodOf(ctx);
      final includeInactive = ctx.query['includeInactive'] == 'true';
      final data = loadClubData(b, club['id'] as int);
      final aggregates = aggregatePlayers(
          data.players.values.where((p) => includeInactive || p.active).toList(), data.matches, period);
      aggregates.sort((a, b) => a.player.name.compareTo(b.player.name));
      return {
        'period': period.toJson(),
        'countedMatches': countedMatches(data.matches, period).length,
        'minWinRateMatches': club['min_win_rate_matches'],
        'players': [for (final a in aggregates) a.summary()],
      };
    }),

    Route('GET', '/clubs/:clubId/players/:playerId', (ctx) {
      final (:club, :viewer) = b.clubFor(ctx, records: true);
      final period = periodOf(ctx);
      final row = playerRow(club['id'] as int, ctx.intParam('playerId'));
      final data = loadClubData(b, club['id'] as int);
      final agg = aggregatePlayers([data.players[row['id']]!], data.matches, period).single;
      final photos = db.all('SELECT * FROM player_photos WHERE player_id = ? AND club_id = ? ORDER BY id', [row['id'], club['id']]);
      final me = ctx.account?['id'];
      return {
        'period': period.toJson(),
        'player': {
          ...agg.detail(),
          'linked': row['account_id'] != null,
          'isMe': me != null && row['account_id'] == me,
          'source': row['source'],
          'cardPhotos': [
            if (row['photo_file_id'] != null) {'label': '프로필', 'url': b.fileUrl(row['photo_file_id']), 'fit': 'cover'},
            for (final p in photos) {'label': p['label'], 'url': b.fileUrl(p['file_id']), 'fit': p['fit']},
          ],
        },
        'chemistryPreview': chemistry(row['id'] as int, data.players, data.matches, period, 1)['connections'],
      };
    }),

    Route('POST', '/clubs/:clubId/players', (ctx) async {
      final (:club, :viewer) = b.clubFor(ctx, role: 'manager');
      final fields = playerFields(await ctx.json(), create: true, manager: true);
      final id = db.tx(() {
        final id = db.insert(
            'INSERT INTO players (club_id, ${fields.keys.join(', ')}, source, created_at, updated_at) '
            "VALUES (?, ${List.filled(fields.length, '?').join(', ')}, 'user_created', ?, ?)",
            [club['id'], ...fields.values, b.nowIso(), b.nowIso()]);
        b.audit(club['id'] as int, ctx.accountId, 'player.created', 'player', id);
        return id;
      });
      return Created({'player': {'id': id}});
    }),

    Route('PATCH', '/clubs/:clubId/players/:playerId', (ctx) async {
      final (:club, :viewer) = b.clubFor(ctx, role: 'member');
      final row = playerRow(club['id'] as int, ctx.intParam('playerId'));
      final manager = viewer.atLeast('manager');
      if (!manager && row['account_id'] != ctx.accountId) throw forbidden('본인과 연결된 선수 프로필만 수정할 수 있습니다.');
      final fields = playerFields(await ctx.json(), create: false, manager: manager);
      if (fields.isEmpty) throw badRequest('변경할 항목이 없습니다.');
      db.tx(() {
        db.run('UPDATE players SET ${fields.keys.map((k) => '$k = ?').join(', ')}, updated_at = ? WHERE id = ?',
            [...fields.values, b.nowIso(), row['id']]);
        b.audit(club['id'] as int, ctx.accountId, 'player.updated', 'player', row['id'], fields.keys.toList());
      });
      return {'ok': true};
    }),

    Route('POST', '/clubs/:clubId/players/:playerId/photo', (ctx) async {
      final (:club, :viewer) = b.clubFor(ctx, role: 'member');
      final row = playerRow(club['id'] as int, ctx.intParam('playerId'));
      if (!viewer.atLeast('manager') && row['account_id'] != ctx.accountId) throw forbidden('본인과 연결된 선수 사진만 바꿀 수 있습니다.');
      final bytes = await b.readImageUpload(ctx);
      db.tx(() {
        final file = b.saveFile(bytes, clubId: club['id'] as int, kind: 'player_photo');
        db.run('UPDATE players SET photo_file_id = ?, updated_at = ? WHERE id = ?', [file, b.nowIso(), row['id']]);
        b.audit(club['id'] as int, ctx.accountId, 'player.photo', 'player', row['id']);
      });
      return {'ok': true};
    }),

    Route('DELETE', '/clubs/:clubId/players/:playerId', (ctx) {
      final (:club, :viewer) = b.clubFor(ctx, role: 'manager');
      db.tx(() {
        final row = playerRow(club['id'] as int, ctx.intParam('playerId'));
        if (db.scalar('SELECT COUNT(*) FROM match_players WHERE player_id = ?', [row['id']]) != 0) {
          throw conflict('경기 기록이 있는 선수는 삭제하지 않고 비활성화해주세요.', 'has_records');
        }
        db.run('DELETE FROM players WHERE id = ?', [row['id']]);
        b.audit(club['id'] as int, ctx.accountId, 'player.deleted', 'player', row['id'], {'name': row['name']});
      });
      return {'ok': true};
    }),

    Route('GET', '/clubs/:clubId/matches', (ctx) {
      final (:club, :viewer) = b.clubFor(ctx, records: true);
      final period = periodOf(ctx);
      final status = ctx.query['status'];
      if (status != null && status.isNotEmpty && !matchStatuses.contains(status)) throw badRequest('경기 상태를 다시 선택해주세요.');
      final page = int.tryParse(ctx.query['page'] ?? '1') ?? 1;
      final limit = (int.tryParse(ctx.query['limit'] ?? '30') ?? 30).clamp(1, 100);
      if (page < 1 || page > 10000) throw badRequest('페이지 번호가 올바르지 않습니다.');
      const where = "club_id = ? AND (? IS NULL OR match_date >= ?) AND (? IS NULL OR match_date <= ?) AND (? = '' OR status = ?)";
      final args = [club['id'], period.start, period.start, period.end, period.end, status ?? '', status ?? ''];
      final total = db.scalar('SELECT COUNT(*) FROM matches WHERE $where', args) as int;
      final rows = db.all('SELECT * FROM matches WHERE $where ORDER BY match_date DESC, id DESC LIMIT ? OFFSET ?',
          [...args, limit, (page - 1) * limit]);
      return {
        'matches': rows.map(matchSummary).toList(),
        'pagination': {'page': page, 'limit': limit, 'total': total, 'hasMore': (page - 1) * limit + rows.length < total},
      };
    }),

    Route('GET', '/clubs/:clubId/matches/:matchId', (ctx) {
      final (:club, :viewer) = b.clubFor(ctx, records: true);
      return {'match': matchDetail(club['id'] as int, ctx.intParam('matchId'))};
    }),

    Route('POST', '/clubs/:clubId/matches', (ctx) async {
      final (:club, :viewer) = b.clubFor(ctx, role: 'recorder');
      final clubId = club['id'] as int;
      final input = parseMatch(clubId, await ctx.json());
      final id = db.tx(() {
        final id = db.insert(
            'INSERT INTO matches (club_id, match_date, start_time, location, status, team_a_name, team_b_name, team_a_score, team_b_score, memo, '
            "source, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?, 'user_created', ?, ?, ?)",
            [clubId, input['date'], input['startTime'], input['location'], input['status'], input['teamA'], input['teamB'],
             input['scoreA'], input['scoreB'], input['memo'], ctx.accountId, b.nowIso(), b.nowIso()]);
        writeChildren(clubId, id, input);
        b.audit(clubId, ctx.accountId, 'match.created', 'match', id, {'status': input['status']});
        return id;
      });
      return Created({'match': matchDetail(clubId, id)});
    }),

    Route('PUT', '/clubs/:clubId/matches/:matchId', (ctx) async {
      final (:club, :viewer) = b.clubFor(ctx, role: 'recorder');
      final clubId = club['id'] as int;
      final body = await ctx.json();
      final input = parseMatch(clubId, body);
      final version = body.optInt('version', min: 1);
      db.tx(() {
        final current = db.one('SELECT * FROM matches WHERE id = ? AND club_id = ?', [ctx.intParam('matchId'), clubId]) ??
            (throw notFound('경기를 찾을 수 없습니다.'));
        if (version != null && version != current['version']) {
          throw conflict('다른 사용자가 먼저 이 경기를 수정했습니다. 새로고침 후 다시 입력해주세요.', 'stale_version');
        }
        db.run(
            'UPDATE matches SET match_date = ?, start_time = ?, location = ?, status = ?, team_a_name = ?, team_b_name = ?, '
            'team_a_score = ?, team_b_score = ?, memo = ?, version = version + 1, updated_at = ? WHERE id = ?',
            [input['date'], input['startTime'], input['location'], input['status'], input['teamA'], input['teamB'],
             input['scoreA'], input['scoreB'], input['memo'], b.nowIso(), current['id']]);
        writeChildren(clubId, current['id'] as int, input);
        b.audit(clubId, ctx.accountId, 'match.updated', 'match', current['id'],
            {'fromStatus': current['status'], 'toStatus': input['status'], 'score': '${input['scoreA']}:${input['scoreB']}'});
      });
      return {'match': matchDetail(clubId, ctx.intParam('matchId'))};
    }),

    Route('DELETE', '/clubs/:clubId/matches/:matchId', (ctx) {
      final (:club, :viewer) = b.clubFor(ctx, role: 'manager');
      db.tx(() {
        final m = db.one('SELECT * FROM matches WHERE id = ? AND club_id = ?', [ctx.intParam('matchId'), club['id']]) ??
            (throw notFound('경기를 찾을 수 없습니다.'));
        db.run('DELETE FROM matches WHERE id = ?', [m['id']]);
        b.audit(club['id'] as int, ctx.accountId, 'match.deleted', 'match', m['id'], matchSummary(m));
      });
      return {'ok': true};
    }),

    Route('POST', '/clubs/:clubId/matches/:matchId/posters', (ctx) async {
      final (:club, :viewer) = b.clubFor(ctx, role: 'recorder');
      final clubId = club['id'] as int;
      final m = db.one('SELECT id FROM matches WHERE id = ? AND club_id = ?', [ctx.intParam('matchId'), clubId]) ??
          (throw notFound('경기를 찾을 수 없습니다.'));
      final bytes = await b.readImageUpload(ctx);
      final id = db.tx(() {
        final file = b.saveFile(bytes, clubId: clubId, kind: 'poster');
        final id = db.insert('INSERT INTO posters (club_id, match_id, file_id, created_at) VALUES (?,?,?,?)', [clubId, m['id'], file, b.nowIso()]);
        b.audit(clubId, ctx.accountId, 'poster.added', 'match', m['id']);
        return id;
      });
      return Created({'poster': {'id': id}});
    }),

    Route('DELETE', '/clubs/:clubId/matches/:matchId/posters/:posterId', (ctx) {
      final (:club, :viewer) = b.clubFor(ctx, role: 'recorder');
      final n = db.run('DELETE FROM posters WHERE id = ? AND match_id = ? AND club_id = ?',
          [ctx.intParam('posterId'), ctx.intParam('matchId'), club['id']]);
      if (n == 0) throw notFound('포스터를 찾을 수 없습니다.');
      b.audit(club['id'] as int, ctx.accountId, 'poster.deleted', 'match', ctx.params['matchId']);
      return {'ok': true};
    }),

    Route('GET', '/clubs/:clubId/posters', (ctx) {
      final (:club, :viewer) = b.clubFor(ctx, records: true);
      final rows = db.all(
          'SELECT p.id, p.file_id, m.id AS match_id, m.match_date, m.team_a_name, m.team_b_name FROM posters p '
          'JOIN matches m ON m.id = p.match_id WHERE p.club_id = ? ORDER BY m.match_date DESC, p.id DESC', [club['id']]);
      return {
        'posters': [
          for (final p in rows)
            {'id': p['id'], 'url': b.fileUrl(p['file_id']), 'matchId': p['match_id'], 'matchDate': p['match_date'],
             'title': '${p['team_a_name']} vs ${p['team_b_name']}'}
        ]
      };
    }),

    Route('GET', '/clubs/:clubId/hall-of-fame', (ctx) {
      final (:club, :viewer) = b.clubFor(ctx, records: true);
      final period = periodOf(ctx);
      final data = loadClubData(b, club['id'] as int);
      return {
        'period': period.toJson(),
        'hallOfFame': hallOfFame(aggregatePlayers(data.players.values.toList(), data.matches, period),
            countedMatches(data.matches, period).length),
      };
    }),

    Route('GET', '/clubs/:clubId/chemistry', (ctx) {
      final (:club, :viewer) = b.clubFor(ctx, records: true);
      final period = periodOf(ctx);
      final min = int.tryParse(ctx.query['minMatches'] ?? '3') ?? 3;
      if (![1, 3, 5, 10].contains(min)) throw badRequest('최소 경기 수는 1, 3, 5, 10 중에서 선택해주세요.');
      final data = loadClubData(b, club['id'] as int);
      final candidates = data.players.values
          .where((p) => p.active || data.matches.any((m) => m.countsForStats && m.lines.any((l) => l.playerId == p.id)))
          .map((p) => p.toJson())
          .toList()
        ..sort((a, b) => (a['name'] as String).compareTo(b['name'] as String));
      final raw = ctx.query['playerId'];
      if (raw == null || raw.isEmpty) return {'players': candidates, 'chemistry': null};
      final id = int.tryParse(raw);
      if (id == null || !data.players.containsKey(id)) throw notFound('선수를 찾을 수 없습니다.');
      return {'players': candidates, 'chemistry': chemistry(id, data.players, data.matches, period, min)};
    }),

    Route('GET', '/clubs/:clubId/source', (ctx) {
      final (:club, :viewer) = b.clubFor(ctx);
      if (club['source'] != 'arena_import') return {'source': club['source'], 'importRun': null};
      final run = db.one("SELECT * FROM import_runs WHERE source = 'arena' AND status = 'completed' ORDER BY id DESC LIMIT 1");
      return {
        'source': club['source'],
        'importedAt': club['imported_at'],
        'importRun': run == null ? null : {'finishedAt': run['finished_at'], 'sourceUrl': run['source_url'],
            'summary': jsonDecode(run['summary_json'] as String? ?? '{}')},
      };
    }),
  ];
}
