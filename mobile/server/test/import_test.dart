import 'dart:convert';

import 'package:arena_club_server/arena_club_server.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:test/test.dart';

import 'harness.dart';

Json player(int id, String name, {bool active = true}) =>
    {'id': id, 'name': name, 'nickname': null, 'profileImageUrl': null, 'position': '미드필더', 'number': id, 'isActive': active};

Json fixture({int scoreA = 2, String memo = '원본 메모'}) {
  final p1 = player(1, '원본A'), p2 = player(2, '원본B'), p3 = player(3, '용병C', active: false);
  return {
    'fetchedAt': '2026-10-13T00:00:00Z',
    'players': [
      {...p1, 'totalMatches': 1, 'wins': 1, 'losses': 0, 'draws': 0, 'winRate': 100.0, 'goals': 1, 'assists': 0, 'mvpCount': 1,
       'currentWinStreak': 1, 'currentGoalStreak': 1, 'currentAssistStreak': 0},
      {...p2, 'totalMatches': 1, 'wins': 1, 'losses': 0, 'draws': 0, 'winRate': 100.0, 'goals': 0, 'assists': 1, 'mvpCount': 0,
       'currentWinStreak': 1, 'currentGoalStreak': 0, 'currentAssistStreak': 1},
    ],
    'matchCount': 1,
    'matches': [
      {
        'id': 10, 'status': 'COMPLETED', 'matchDate': '2026-09-01T00:00:00.000Z', 'location': '구장', 'teamAName': '회장팀',
        'teamBName': '총무팀', 'teamAScore': scoreA, 'teamBScore': 0, 'memo': memo, 'posters': [],
        'goals': [{'scorerId': 1, 'assisterId': 2, 'sequence': 1, 'assistKnown': true}],
        'matchPlayers': [
          {'playerId': 1, 'teamName': '회장팀', 'result': 'WIN', 'goals': 1, 'assists': 0, 'isMvp': true, 'player': p1},
          {'playerId': 2, 'teamName': '회장팀', 'result': 'WIN', 'goals': 0, 'assists': 1, 'isMvp': false, 'player': p2},
          {'playerId': 3, 'teamName': '총무팀', 'result': 'LOSS', 'goals': 0, 'assists': 0, 'isMvp': false, 'player': p3},
        ],
      }
    ],
    'hallOfFame': {'categories': []},
    'cardArt': {},
  };
}

void main() {
  late Harness h;
  late ArenaImporter importer;
  setUp(() {
    h = Harness();
    importer = ArenaImporter(h.backend, sourceUrl: 'http://arena.invalid',
        client: MockClient((_) async => http.Response('not found', 404)), log: (_) {});
  });
  tearDown(() => h.dispose());

  test('재실행해도 중복 생성되지 않고 수량·집계를 대조한다', () async {
    final first = await importer.run(snapshot: fixture());
    expect(first['counts']['playersCreated'], 3);
    expect(first['counts']['matchesCreated'], 1);
    final v = first['verification'] as Json;
    expect(v['countMismatches'], isEmpty);
    expect(v['playerStatDifferences'], isEmpty);
    final second = await importer.run(snapshot: fixture());
    expect(second['counts']['playersCreated'], 0);
    expect(second['counts']['matchesCreated'], 0);
    expect(h.db.scalar('SELECT COUNT(*) FROM players'), 3);
    expect(h.db.scalar('SELECT COUNT(*) FROM matches'), 1);
    // Imported club is public and has no owner/accounts assigned.
    final club = (await h.get('/clubs')).json['clubs'].single;
    expect(club['source'], 'arena_import');
    expect(club['isDemo'], isFalse);
    expect(club['hasOwner'], isFalse);
    expect(h.db.scalar('SELECT COUNT(*) FROM players WHERE account_id IS NOT NULL'), 0);
    expect((await h.get('/clubs/${club['id']}/players')).status, 200);
  });

  test('원본이 바뀌면 앱에서 수정하지 않은 행만 갱신하고, 양쪽 수정은 충돌로 보고한다', () async {
    await importer.run(snapshot: fixture());
    final updated = await importer.run(snapshot: fixture(memo: '원본 메모 수정'));
    expect(updated['counts']['matchesUpdated'], 1);
    expect(h.db.scalar('SELECT memo FROM matches'), '원본 메모 수정');

    h.db.run("UPDATE matches SET memo = '앱에서 고친 메모'");
    final conflict = await importer.run(snapshot: fixture(scoreA: 3, memo: '원본 메모 수정'));
    expect((conflict['conflicts'] as List).length, 1);
    expect(h.db.scalar('SELECT memo FROM matches'), '앱에서 고친 메모');
    expect(h.db.scalar('SELECT team_a_score FROM matches'), 2);
    expect(h.db.scalar('SELECT COUNT(*) FROM import_conflicts'), 1);
  });

  test('원본 이상(선수 득점 합계 > 팀 점수)은 고치지 않고 보고한다', () async {
    final data = fixture(scoreA: 0);
    final summary = await importer.run(snapshot: data);
    final anomalies = (summary['verification'] as Json)['sourceAnomalies'] as List;
    expect(anomalies.map((a) => a['issue']), anyElement(contains('팀 점수(0)')));
    expect(h.db.scalar('SELECT team_a_score FROM matches'), 0);
  });

  test('예시 데이터 초기화는 ARENA·사용자 데이터를 건드리지 않는다', () async {
    await importer.run(snapshot: fixture());
    seedDemo(h.backend);
    final newbie = await h.login('newbie');
    final created = await h.post('/clubs', {'name': '사용자 동호회'}, newbie);
    final userClub = created.json['club']['id'];
    final arenaClub = h.db.scalar("SELECT id FROM clubs WHERE source = 'arena_import'");
    final before = jsonEncode(h.db.all('SELECT * FROM matches WHERE club_id = ?', [arenaClub]));

    final removed = resetDemo(h.backend);
    expect(removed['clubs'], 3);
    expect(removed['venues'], 3);
    expect(h.db.scalar("SELECT COUNT(*) FROM clubs WHERE source = 'demo'"), 0);
    expect(h.db.scalar('SELECT COUNT(*) FROM clubs WHERE id = ?', [userClub]), 1);
    expect(jsonEncode(h.db.all('SELECT * FROM matches WHERE club_id = ?', [arenaClub])), before);
    // The demo account that owns a real club is kept with its club.
    expect(h.db.scalar("SELECT COUNT(*) FROM accounts WHERE provider_subject = 'newbie'"), 1);
    expect(removed['accountsKept'], 1);

    seedDemo(h.backend);
    expect(h.db.scalar("SELECT COUNT(*) FROM clubs WHERE source = 'demo'"), 3);
    seedDemo(h.backend);
    expect(h.db.scalar("SELECT COUNT(*) FROM clubs WHERE source = 'demo'"), 3);
    expect(h.db.scalar("SELECT COUNT(*) FROM matches WHERE source = 'demo'"), 25);
  });
}
