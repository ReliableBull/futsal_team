import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'backend.dart';
import 'db.dart';
import 'routes_venues.dart';
import 'security.dart';

/// Fictional demo data. Every row is tagged `source = 'demo'` (or
/// `is_demo = 1` for venues/bookings) so that [resetDemo] can remove exactly
/// this data and nothing imported from ARENA or created by real users.
const demoPassword = 'demo1234!';

const demoAccounts = [
  ('night_owner', '나이트 회장 (예시)'),
  ('multi_manager', '멀티 운영진 (예시)'),
  ('night_recorder', '나이트 기록담당 (예시)'),
  ('night_member', '나이트 회원 (예시)'),
  ('applicant', '가입 신청자 (예시)'),
  ('weekend_owner', '위켄드 회장 (예시)'),
  ('beginner_owner', '비기너 회장 (예시)'),
  ('newbie', '새 사용자 (예시)'),
];

class _ClubSpec {
  const _ClubSpec(this.ref, this.name, this.region, this.description, this.note,
      this.recordsVisibility, this.joinPolicy, this.players, this.teams, this.seed);
  final String ref, name, region, description, note, recordsVisibility, joinPolicy;
  final List<String> players;
  final (String, String) teams;
  final int seed;
}

const _clubs = [
  _ClubSpec('daegu-night', '대구 나이트 FC', '대구 (예시)', '퇴근 후 평일 저녁에 모여 뛰는 예시 동호회입니다.',
      '평일 저녁 · 화/목 20시', 'public', 'approval',
      ['가람', '나래', '다온', '라온', '마루', '바다', '새봄', '아라', '자람', '찬솔', '하늬', '한결'], ('블루', '레드'), 11),
  _ClubSpec('chilgok-weekend', '칠곡 위켄드 FC', '칠곡 (예시)', '주말 오전에 가볍게 공 차는 예시 동호회입니다. 초대 링크로 가입합니다.',
      '주말 오전 · 토 9시', 'public', 'invite_only',
      ['구름', '노을', '다솜', '로운', '미르', '보라', '솔빛', '여울', '윤슬', '초롱', '해솔'], ('화이트', '블랙'), 23),
  _ClubSpec('suseong-beginner', '수성 비기너 FC', '대구 수성 (예시)', '풋살을 처음 시작하는 분들을 위한 예시 동호회입니다. 경기 기록은 회원에게만 공개합니다.',
      '초보자 중심 · 일 16시', 'members', 'approval',
      ['가온', '나린', '다올', '루리', '모아', '별하', '시온', '온새', '이든', '주아'], ('옐로', '그린'), 37),
];

String _day(DateTime d) => d.toIso8601String().substring(0, 10);

/// One goal: (scorerIndex, assistIndex or null).
typedef _Goal = (int, int?);

class _MatchSpec {
  const _MatchSpec(this.daysAgo, this.status, this.a, this.b, this.goalsA, this.goalsB,
      {this.ownGoalsA = 0, this.momA, this.momB, this.memo});
  final int daysAgo;
  final String status;
  final List<int> a, b;
  final List<_Goal> goalsA, goalsB;
  /// Own goals by team A: counted for team B without a scorer.
  final int ownGoalsA;
  final int? momA, momB;
  final String? memo;
}

/// Hand-written for 대구 나이트 FC so that rankings show ties (6골 공동 1위),
/// a broken scoring streak, a current win streak and an in-progress match.
const _nightMatches = [
  _MatchSpec(35, 'completed', [0, 2, 4, 6, 8, 10], [1, 3, 5, 7, 9, 11], [(0, 2), (0, 4), (6, null)], [(1, 3), (5, null)], momA: 0, momB: 5),
  _MatchSpec(28, 'completed', [0, 2, 5, 7, 8, 11], [1, 3, 4, 6, 9, 10], [(0, 5), (2, 0)], [(1, 6), (4, 1)], momA: 0, momB: 1),
  _MatchSpec(21, 'completed', [0, 2, 3, 9, 10, 11], [1, 4, 5, 6, 7, 8], [(0, 2), (3, 0), (9, null)], [(5, 1)],
      ownGoalsA: 1, momA: 3, momB: 1, memo: '블루 자책골 1 (득점자 없음)'),
  _MatchSpec(14, 'completed', [0, 1, 2, 6, 7, 10], [3, 4, 5, 8, 9, 11], [(0, 1), (1, 2), (1, 0)], [(4, 3), (8, null)], momA: 1, momB: 4),
  _MatchSpec(7, 'completed', [1, 2, 4, 5, 9, 10], [0, 3, 6, 7, 8, 11], [(1, 4), (2, 5)], [(0, 6)], momA: 2, momB: 0),
  _MatchSpec(3, 'completed', [1, 2, 3, 5, 8, 11], [0, 4, 6, 7, 9, 10], [(1, 3), (2, 1)], [(6, 4)], momA: 1, momB: 6),
  _MatchSpec(0, 'in_progress', [0, 1, 2, 3, 4, 5], [6, 7, 8, 9, 10, 11], [(0, 1)], [], memo: '진행 중 경기: 확정 통계에 포함되지 않습니다.'),
  _MatchSpec(-4, 'scheduled', [0, 2, 4, 6, 8, 10], [1, 3, 5, 7, 9, 11], [], []),
  _MatchSpec(-11, 'scheduled', [], [], [], []),
];

List<_MatchSpec> _generatedMatches(_ClubSpec club) {
  final rnd = Random(club.seed);
  final n = club.players.length;
  final out = <_MatchSpec>[];
  for (var i = 0; i < 6; i++) {
    final order = List.generate(n, (j) => j)..shuffle(rnd);
    final size = min(6, n ~/ 2);
    final a = order.sublist(0, size)..sort();
    final b = order.sublist(size, size * 2)..sort();
    List<_Goal> goals(List<int> team) => List.generate(rnd.nextInt(5), (_) {
          final scorer = team[rnd.nextInt(team.length)];
          final mates = team.where((p) => p != scorer).toList();
          return (scorer, rnd.nextInt(10) < 7 ? mates[rnd.nextInt(mates.length)] : null);
        });
    final ga = goals(a), gb = goals(b);
    int? mom(List<_Goal> g, List<int> team) => g.isEmpty ? team.first : g.first.$1;
    out.add(_MatchSpec(42 - i * 7, 'completed', a, b, ga, gb, momA: mom(ga, a), momB: mom(gb, b)));
  }
  out.add(_MatchSpec(-6, 'scheduled', [], [], [], []));
  out.add(_MatchSpec(-13, 'scheduled', [], [], [], []));
  return out;
}

Json seedDemo(Backend b) {
  if (b.config.isProduction) throw StateError('예시 데이터는 운영 환경에 생성할 수 없습니다.');
  final db = b.db;
  final now = b.nowIso();
  final created = <String, int>{'accounts': 0, 'clubs': 0, 'players': 0, 'matches': 0, 'venues': 0};
  db.tx(() {
    final accounts = <String, int>{};
    for (final (username, name) in demoAccounts) {
      var id = db.scalar("SELECT id FROM accounts WHERE provider = 'dev' AND provider_subject = ?", [username]) as int?;
      if (id == null) {
        id = db.insert(
            "INSERT INTO accounts (display_name, provider, provider_subject, password_hash, source, created_at) VALUES (?, 'dev', ?, ?, 'demo', ?)",
            [name, username, hashPassword(demoPassword), now]);
        created['accounts'] = created['accounts']! + 1;
      }
      accounts[username] = id;
    }

    final today = DateTime.parse('${seoulDay(b.now())}T00:00:00Z');
    final year = today.year;
    final seasons = {
      'daegu-night': [
        {'label': '$year 시즌 1', 'startDate': '$year-01-01', 'endDate': '$year-06-30'},
        {'label': '$year 시즌 2', 'startDate': '$year-07-01', 'endDate': '$year-12-31'},
      ],
      'chilgok-weekend': [
        {'label': '$year 봄 리그', 'startDate': '$year-03-01', 'endDate': '$year-05-31'},
        {'label': '$year 가을 리그', 'startDate': '$year-09-01', 'endDate': '$year-11-30'},
      ],
      'suseong-beginner': <Json>[],
    };

    for (final spec in _clubs) {
      var clubId = db.scalar("SELECT id FROM clubs WHERE source = 'demo' AND source_ref = ?", [spec.ref]) as int?;
      if (clubId == null) {
        clubId = db.insert(
            'INSERT INTO clubs (slug, name, region, description, activity_note, visibility, discoverable, records_visibility, join_policy, '
            "seasons_json, min_win_rate_matches, source, source_ref, created_at, updated_at) VALUES (?,?,?,?,?, 'public', 1, ?, ?, ?, 3, 'demo', ?, ?, ?)",
            ['demo-${spec.ref}', spec.name, spec.region, spec.description, spec.note, spec.recordsVisibility, spec.joinPolicy,
             jsonEncode(seasons[spec.ref]), spec.ref, now, now]);
        created['clubs'] = created['clubs']! + 1;
      }
      final playerIds = <int>[];
      for (var i = 0; i < spec.players.length; i++) {
        final ref = '${spec.ref}:p$i';
        var id = db.scalar("SELECT id FROM players WHERE club_id = ? AND source = 'demo' AND source_ref = ?", [clubId, ref]) as int?;
        if (id == null) {
          id = db.insert(
              'INSERT INTO players (club_id, name, nickname, number, position, is_guest, is_active, source, source_ref, created_at, updated_at) '
              "VALUES (?,?,?,?,?,?,1,'demo',?,?,?)",
              [clubId, spec.players[i], i == 0 ? '주장' : null, i + 1,
               ['공격수', '미드필더', '센터백', '윙백'][i % 4], i == spec.players.length - 1 ? 1 : 0, ref, now, now]);
          created['players'] = created['players']! + 1;
        }
        playerIds.add(id);
      }
      final matches = spec.ref == 'daegu-night' ? _nightMatches : _generatedMatches(spec);
      for (var i = 0; i < matches.length; i++) {
        final m = matches[i];
        final ref = '${spec.ref}:m$i';
        if (db.scalar("SELECT 1 FROM matches WHERE club_id = ? AND source = 'demo' AND source_ref = ?", [clubId, ref]) != null) continue;
        final live = m.status == 'completed' || m.status == 'in_progress';
        // Scores always derive from the goal list (+ explicit own goals).
        final scoreA = live ? m.goalsA.length : null;
        final scoreB = live ? m.goalsB.length + m.ownGoalsA : null;
        final matchId = db.insert(
            'INSERT INTO matches (club_id, match_date, start_time, location, status, team_a_name, team_b_name, team_a_score, team_b_score, memo, '
            "source, source_ref, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?, 'demo', ?, ?, ?)",
            [clubId, _day(today.subtract(Duration(days: m.daysAgo))), spec.ref == 'chilgok-weekend' ? '09:00' : '20:00',
             '예시 구장', m.status, spec.teams.$1, spec.teams.$2, scoreA, scoreB, m.memo, ref, now, now]);
        created['matches'] = created['matches']! + 1;
        for (final (team, members, goals, mom) in [('A', m.a, m.goalsA, m.momA), ('B', m.b, m.goalsB, m.momB)]) {
          for (final p in members) {
            db.insert('INSERT INTO match_players (club_id, match_id, player_id, team, goals, assists, is_mom) VALUES (?,?,?,?,?,?,?)',
                [clubId, matchId, playerIds[p], team, goals.where((g) => g.$1 == p).length,
                 goals.where((g) => g.$2 == p).length, live && mom == p ? 1 : 0]);
          }
          final seq = <int, int>{};
          for (final (scorer, assist) in goals) {
            seq[scorer] = (seq[scorer] ?? 0) + 1;
            db.insert('INSERT INTO match_goals (club_id, match_id, scorer_player_id, assist_player_id, assist_known, sequence) VALUES (?,?,?,?,1,?)',
                [clubId, matchId, playerIds[scorer], assist == null ? null : playerIds[assist], seq[scorer]]);
          }
        }
      }

      void member(String user, String role, String status) => db.run(
          'INSERT OR IGNORE INTO memberships (club_id, account_id, role, status, requested_at, decided_at) VALUES (?,?,?,?,?,?)',
          [clubId, accounts[user], role, status, now, status == 'approved' ? now : null]);
      switch (spec.ref) {
        case 'daegu-night':
          member('night_owner', 'owner', 'approved');
          member('multi_manager', 'manager', 'approved');
          member('night_recorder', 'recorder', 'approved');
          member('night_member', 'member', 'approved');
          member('applicant', 'member', 'pending');
          db.run('UPDATE players SET account_id = ? WHERE id = ? AND account_id IS NULL '
              'AND NOT EXISTS (SELECT 1 FROM players WHERE club_id = ? AND account_id = ?)',
              [accounts['night_member'], playerIds[3], clubId, accounts['night_member']]);
        case 'chilgok-weekend':
          member('weekend_owner', 'owner', 'approved');
          member('multi_manager', 'member', 'approved');
          if (db.scalar("SELECT 1 FROM player_links WHERE club_id = ? AND account_id = ?", [clubId, accounts['multi_manager']]) == null) {
            db.insert("INSERT INTO player_links (club_id, player_id, account_id, status, requested_at) VALUES (?,?,?, 'pending', ?)",
                [clubId, playerIds[2], accounts['multi_manager'], now]);
          }
        case 'suseong-beginner':
          member('beginner_owner', 'owner', 'approved');
          member('night_member', 'member', 'approved');
          member('applicant', 'member', 'pending');
      }
    }

    const venues = [
      ('demo-moonlight', '예시 달빛 실내 풋살장', true, '5인제', '인조잔디 (실내)', 80000, 10, 24, 'instant', 24,
          {'parking': true, 'shower': false, 'restroom': true, 'ballRental': true},
          '평일 저녁 이용이 많은 실내 구장을 가정한 데모 시설입니다. 예약 즉시 확정되는 흐름을 체험할 수 있습니다.'),
      ('demo-riverside', '예시 리버사이드 풋살파크', false, '6인제', '인조잔디 (야외)', 100000, 8, 22, 'approval', 48,
          {'parking': true, 'shower': true, 'restroom': true, 'ballRental': false},
          '야외 구장을 가정한 데모 시설입니다. 구장 승인 후 확정되는 흐름을 체험할 수 있습니다.'),
      ('demo-central', '예시 센트럴 풋살센터', true, '6인제', '인조잔디 (실내)', 120000, 6, 24, 'payment', 24,
          {'parking': false, 'shower': true, 'restroom': true, 'ballRental': true},
          '결제 완료 후 확정되는 흐름을 체험하는 데모 시설입니다. 데모 결제는 실제 결제가 아닙니다.'),
    ];
    for (final (slug, name, indoor, format, surface, price, open, close, mode, cancelHours, amenities, description) in venues) {
      if (db.scalar('SELECT 1 FROM venues WHERE slug = ?', [slug]) != null) continue;
      db.insert(
          'INSERT INTO venues (slug, name, region, area_label, indoor, play_format, surface, price_per_slot, slot_minutes, open_hour, close_hour, '
          "amenities_json, booking_mode, cancel_deadline_hours, payment_hold_minutes, description, provider, is_demo, created_at) "
          "VALUES (?,?,?,?,?,?,?,?,120,?,?,?,?,?,10,?, 'demo', 1, ?)",
          [slug, name, '대구', '예시 지역 · 실제 위치 아님', indoor ? 1 : 0, format, surface, price, open, close,
           jsonEncode(amenities), mode, cancelHours, description, now]);
      created['venues'] = created['venues']! + 1;
    }
    db.run("DELETE FROM app_state WHERE key = 'demo_inventory_day'");
  });
  ensureDemoInventory(b);
  return created;
}

/// Removes only demo-tagged rows. ARENA imports (`arena_import`) and
/// user-created clubs, players, matches and accounts are never touched.
Json resetDemo(Backend b) {
  final db = b.db;
  final removed = <String, int>{};
  final files = <String>[];
  db.tx(() {
    files.addAll(db.all("SELECT f.path FROM files f JOIN clubs c ON c.id = f.club_id WHERE c.source = 'demo'").map((r) => r['path'] as String));
    removed['clubs'] = db.run("DELETE FROM clubs WHERE source = 'demo'");
    final demoVenues = db.all('SELECT id FROM venues WHERE is_demo = 1').map((r) => r['id']).toList();
    removed['bookings'] = 0;
    for (final id in demoVenues) {
      removed['bookings'] = removed['bookings']! + db.run('DELETE FROM bookings WHERE venue_id = ?', [id]);
      db.run('DELETE FROM venue_slots WHERE venue_id = ?', [id]);
    }
    removed['venues'] = db.run('DELETE FROM venues WHERE is_demo = 1');
    // Demo accounts referenced by real data (e.g. a club they created) are
    // kept rather than deleting someone else's records.
    final keep = db.all(
        "SELECT a.id FROM accounts a WHERE a.source = 'demo' AND (EXISTS (SELECT 1 FROM clubs c WHERE c.created_by = a.id) "
        'OR EXISTS (SELECT 1 FROM memberships m WHERE m.account_id = a.id) '
        'OR EXISTS (SELECT 1 FROM audit_logs l WHERE l.actor_account_id = a.id) '
        'OR EXISTS (SELECT 1 FROM player_links pl WHERE pl.decided_by = a.id OR pl.account_id = a.id) '
        'OR EXISTS (SELECT 1 FROM invites i WHERE i.created_by = a.id))').map((r) => r['id']).toList();
    db.run("DELETE FROM sessions WHERE account_id IN (SELECT id FROM accounts WHERE source = 'demo')");
    db.run("UPDATE bookings SET account_id = NULL WHERE account_id IN (SELECT id FROM accounts WHERE source = 'demo')");
    removed['accounts'] = db.run(
        "DELETE FROM accounts WHERE source = 'demo'${keep.isEmpty ? '' : ' AND id NOT IN (${keep.join(',')})'}");
    removed['accountsKept'] = keep.length;
    db.run("DELETE FROM app_state WHERE key = 'demo_inventory_day'");
  });
  for (final path in files) {
    final f = File('${b.config.storageDir}/$path');
    if (f.existsSync()) f.deleteSync();
  }
  return removed;
}
