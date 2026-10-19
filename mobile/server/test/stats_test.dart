import 'package:arena_club_server/arena_club_server.dart';
import 'package:arena_club_server/src/http.dart' show Period;
import 'package:test/test.dart';

import 'harness.dart';

StatMatch m(int id, String date, int a, int b, List<StatLine> lines, {String status = 'completed'}) => StatMatch(
    id: id, date: date, status: status, teamAName: 'A', teamBName: 'B', scoreA: a, scoreB: b, lines: lines);

void main() {
  group('집계 규칙', () {
    final players = [const StatPlayer(1, '가', null, true, false), const StatPlayer(2, '나', null, true, false)];

    test('진행 중·취소·예정 경기는 무승부나 확정 통계로 처리되지 않는다', () {
      final matches = [
        m(1, '2026-01-01', 1, 0, [const StatLine(1, 'A', 1, 0, true)]),
        m(2, '2026-01-02', 0, 0, [const StatLine(1, 'A', 0, 0, false)], status: 'in_progress'),
        m(3, '2026-01-03', 0, 0, [const StatLine(1, 'A', 0, 0, false)], status: 'cancelled'),
        StatMatch(id: 4, date: '2026-01-04', status: 'scheduled', teamAName: 'A', teamBName: 'B', scoreA: null, scoreB: null,
            lines: const [StatLine(1, 'A', 0, 0, false)]),
      ];
      final a = aggregatePlayers(players, matches, const Period(null, null)).first.summary();
      expect(a['matches'], 1);
      expect(a['draws'], 0);
      expect(a['winRate'], 100.0);
    });

    test('승률 분모에 무승부를 포함한다', () {
      final matches = [
        m(1, '2026-01-01', 1, 0, [const StatLine(1, 'A', 0, 0, false)]),
        m(2, '2026-01-02', 1, 1, [const StatLine(1, 'A', 0, 0, false)]),
        m(3, '2026-01-03', 0, 2, [const StatLine(1, 'A', 0, 0, false)]),
      ];
      final a = aggregatePlayers(players, matches, const Period(null, null)).first;
      expect([a.wins, a.draws, a.losses, a.rate], [1, 1, 1, 33.3]);
    });

    test('결장은 연속 기록을 끊지 않고, 출전 후 미달성은 끊는다', () {
      final matches = [
        m(1, '2026-01-01', 1, 0, [const StatLine(1, 'A', 1, 0, false), const StatLine(2, 'B', 0, 0, false)]),
        m(2, '2026-01-02', 1, 0, [const StatLine(2, 'A', 1, 0, false)]), // player 1 absent
        m(3, '2026-01-03', 2, 0, [const StatLine(1, 'A', 2, 0, false)]),
        m(4, '2026-01-04', 0, 1, [const StatLine(1, 'A', 0, 0, false)]),
        m(5, '2026-01-05', 1, 0, [const StatLine(1, 'A', 1, 0, false)]),
      ];
      final a = aggregatePlayers(players, matches, const Period(null, null)).first;
      expect(a.best('goal'), 2);
      expect(a.current('goal'), 1);
      final best = a.detail()['bestStreaks']['goal'] as List;
      expect(best.single, containsPair('startDate', '2026-01-01'));
      expect(best.single, containsPair('endDate', '2026-01-03'));
    });

    test('공동 순위는 1, 1, 3 방식으로 처리한다', () {
      final matches = [
        m(1, '2026-01-01', 3, 0, [const StatLine(1, 'A', 2, 0, false), const StatLine(2, 'A', 1, 0, false)]),
        m(2, '2026-01-02', 1, 0, [const StatLine(2, 'A', 1, 0, false)]),
      ];
      final agg = aggregatePlayers([...players, const StatPlayer(3, '다', null, true, false)],
          [...matches, m(3, '2026-01-03', 1, 0, [const StatLine(3, 'A', 1, 0, false)])], const Period(null, null));
      final ranking = rankBy(agg, (a) => a.goals);
      expect(ranking.map((r) => r['rank']), [1, 1, 3]);
      expect(ranking.first['tied'], isTrue);
    });
  });

  group('예시 동호회 집계 일관성', () {
    late Harness h;
    setUp(() {
      h = Harness();
      seedDemo(h.backend);
    });
    tearDown(() => h.dispose());

    test('진행 중 경기는 확정 통계에서 빠지고 목록·상세·랭킹·명예의 전당 수치가 일치한다', () async {
      final night = h.clubId('daegu-night');
      final list = await h.get('/clubs/$night/players');
      expect(list.json['countedMatches'], 6);
      final players = {for (final p in list.json['players'] as List) p['id']: p};
      final p0 = h.playerId('daegu-night', 0), p1 = h.playerId('daegu-night', 1), p2 = h.playerId('daegu-night', 2);
      // In-progress match today has a goal by p0; it must not count.
      expect(players[p0]['goals'], 6);
      expect(players[p1]['goals'], 6);
      for (final id in players.keys) {
        final detail = (await h.get('/clubs/$night/players/$id')).json['player'] as Map;
        for (final key in ['matches', 'wins', 'draws', 'losses', 'goals', 'assists', 'mom', 'winRate']) {
          expect(detail[key], players[id][key], reason: 'player $id $key');
        }
        expect((detail['history'] as List).length, detail['matches']);
      }
      final dash = (await h.get('/clubs/$night/dashboard')).json;
      final goals = dash['rankings']['goals'] as List;
      expect(goals.take(2).map((r) => r['rank']), [1, 1]);
      expect(goals.take(2).map((r) => r['value']), [6, 6]);
      expect((dash['rankings']['winStreak'] as List).first['player']['id'], p2);
      expect((dash['rankings']['winStreak'] as List).first['value'], 4);
      final hall = (await h.get('/clubs/$night/hall-of-fame')).json['hallOfFame'];
      final mostGoals = (hall['categories'] as List).firstWhere((c) => c['key'] == 'mostGoals');
      expect((mostGoals['entries'] as List).where((e) => e['rank'] == 1).length, 2);
      final scoring = (hall['categories'] as List).firstWhere((c) => c['key'] == 'longestScoringStreak');
      expect((scoring['entries'] as List).first['player']['id'], p0);
      expect((scoring['entries'] as List).first['value'], 5);
      final p0Detail = (await h.get('/clubs/$night/players/$p0')).json['player'];
      expect(p0Detail['currentGoalStreak'], 0);
    });

    test('경기 스코어와 득점·도움 기록이 정합하다', () {
      for (final match in h.db.all("SELECT * FROM matches WHERE source = 'demo' AND team_a_score IS NOT NULL")) {
        for (final (team, score) in [('A', match['team_a_score'] as int), ('B', match['team_b_score'] as int)]) {
          final sum = h.db.scalar('SELECT IFNULL(SUM(goals),0) FROM match_players WHERE match_id = ? AND team = ?', [match['id'], team]) as int;
          expect(sum, lessThanOrEqualTo(score));
        }
        final goals = h.db.scalar('SELECT IFNULL(SUM(goals),0) FROM match_players WHERE match_id = ?', [match['id']]);
        expect(h.db.scalar('SELECT COUNT(*) FROM match_goals WHERE match_id = ?', [match['id']]), goals);
        final assists = h.db.scalar('SELECT IFNULL(SUM(assists),0) FROM match_players WHERE match_id = ?', [match['id']]);
        expect(h.db.scalar('SELECT COUNT(*) FROM match_goals WHERE match_id = ? AND assist_player_id IS NOT NULL', [match['id']]), assists);
        final crossTeam = h.db.scalar(
            'SELECT COUNT(*) FROM match_goals g JOIN match_players s ON s.match_id = g.match_id AND s.player_id = g.scorer_player_id '
            'JOIN match_players a ON a.match_id = g.match_id AND a.player_id = g.assist_player_id WHERE g.match_id = ? AND s.team <> a.team',
            [match['id']]);
        expect(crossTeam, 0);
      }
      for (final ref in ['daegu-night', 'chilgok-weekend', 'suseong-beginner']) {
        final id = h.clubId(ref);
        expect(h.db.scalar("SELECT COUNT(*) FROM matches WHERE club_id = ? AND status = 'completed'", [id]), 6);
        expect(h.db.scalar("SELECT COUNT(*) FROM matches WHERE club_id = ? AND status = 'scheduled'", [id]), 2);
        expect(h.db.scalar('SELECT COUNT(*) FROM players WHERE club_id = ?', [id]), inInclusiveRange(10, 12));
      }
    });

    test('기록 입력 검증: 다른 팀 도움, 자기 도움, 점수보다 많은 득점은 거절한다', () async {
      final night = h.clubId('daegu-night');
      final token = await h.login('night_recorder');
      Map<String, dynamic> base(List goals, {int a = 2}) => {
            'status': 'completed', 'matchDate': '2026-10-12', 'teamAName': '블루', 'teamBName': '레드', 'teamAScore': a, 'teamBScore': 0,
            'players': [
              {'playerId': h.playerId('daegu-night', 0), 'team': 'A'},
              {'playerId': h.playerId('daegu-night', 1), 'team': 'A'},
              {'playerId': h.playerId('daegu-night', 2), 'team': 'B'},
            ],
            'goals': goals,
          };
      final p0 = h.playerId('daegu-night', 0), p1 = h.playerId('daegu-night', 1), p2 = h.playerId('daegu-night', 2);
      expect((await h.call('POST', '/clubs/$night/matches', token: token, body: base([{'scorerId': p0, 'assistId': p2}]))).status, 400);
      expect((await h.call('POST', '/clubs/$night/matches', token: token, body: base([{'scorerId': p0, 'assistId': p0}]))).status, 400);
      expect((await h.call('POST', '/clubs/$night/matches', token: token,
          body: base([{'scorerId': p0, 'assistId': p1}, {'scorerId': p0, 'assistId': null}], a: 1))).status, 400);
      final ok = await h.call('POST', '/clubs/$night/matches', token: token,
          body: base([{'scorerId': p0, 'assistId': p1}, {'scorerId': p1, 'assistId': null}], a: 3));
      expect(ok.status, 201);
      final players = {for (final p in ok.json['match']['players'] as List) p['playerId']: p};
      expect(players[p0]['goals'], 1);
      expect(players[p1]['assists'], 1);
      // Optimistic concurrency: an editor holding an old version is rejected.
      final id = ok.json['match']['id'];
      final first = await h.call('PUT', '/clubs/$night/matches/$id', token: token, body: {...base([], a: 0), 'version': 1});
      expect(first.status, 200);
      final stale = await h.call('PUT', '/clubs/$night/matches/$id', token: token, body: {...base([], a: 0), 'version': 1});
      expect(stale.status, 409);
    });

    test('조합 분석: 표본 경기 수와 최소 경기 필터, 미상 연결 구분', () async {
      final night = h.clubId('daegu-night');
      final p0 = h.playerId('daegu-night', 0);
      final c = (await h.get('/clubs/$night/chemistry?playerId=$p0&minMatches=3')).json['chemistry'];
      expect(c['totalMatches'], 6);
      expect(c['unknownGoalLinks'], 0);
      for (final t in c['teammates'] as List) {
        expect(t['matches'], greaterThanOrEqualTo(3));
      }
      expect((c['connections'] as List).isNotEmpty, isTrue);
      expect((await h.get('/clubs/$night/chemistry?playerId=$p0&minMatches=2')).status, 400);
    });
  });
}
