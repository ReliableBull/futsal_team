import 'dart:convert';

import 'package:arena_fc/core/api.dart';
import 'package:arena_fc/core/match_draft.dart';
import 'package:arena_fc/core/widgets.dart';
import 'package:arena_fc/features/browse.dart';
import 'package:arena_fc/features/editor.dart';
import 'package:arena_fc/main.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));

  test('release requires HTTPS and a server origin', () {
    expect(
      validateServer('http://203.0.113.10:3000', release: false).port,
      3000,
    );
    for (final url in [
      'http://203.0.113.10:3000',
      'https://user:pass@arena.test',
      'https://arena.test/api',
      'ftp://arena.test',
    ]) {
      expect(
        () => validateServer(url, release: true),
        throwsA(isA<ApiException>()),
      );
    }
    expect(
      validateServer('https://arena.test', release: true).host,
      'arena.test',
    );
  });
  test('assignment prevents duplicates and removes invalid assist links', () {
    final draft = MatchDraft();
    draft.assign(1, 'A');
    draft.assign(2, 'A');
    draft.assign(3, 'B');
    draft.setGoals(1, 1);
    draft.links[1]![0] = 2;
    expect(draft.toJson()['assistsByPlayerId']['2'], 1);
    draft.assign(2, 'B');
    expect(draft.members('A'), [1]);
    expect(draft.assistCandidates(1), isEmpty);
    expect(draft.links[1]![0], isNull);
    draft.links[1]![0] = 3;
    expect(draft.toJson, throwsA(isA<ApiException>()));
  });
  test('editing unknown historical assists preserves their totals', () {
    final draft = MatchDraft({
      'teamAName': 'A',
      'matchPlayers': [
        {
          'playerId': 1,
          'teamName': 'A',
          'goals': 1,
          'assists': 0,
          'isMvp': true,
        },
        {
          'playerId': 2,
          'teamName': 'A',
          'goals': 0,
          'assists': 2,
          'isMvp': false,
        },
        {
          'playerId': 3,
          'teamName': 'B',
          'goals': 0,
          'assists': 0,
          'isMvp': false,
        },
      ],
      'goals': [],
    });
    expect(draft.toJson()['assistsByPlayerId']['2'], 2);
    draft.links[1]![0] = 2;
    expect(draft.toJson()['assistsByPlayerId']['2'], 1);
  });
  test('bearer storage, UTF-8 and expiration', () async {
    final api = ArenaApi(
      client: MockClient((request) async {
        if (request.url.path.endsWith('/login')) {
          return http.Response(
            jsonEncode({
              'token': 'token',
              'admin': {'id': 1, 'username': 'admin'},
            }),
            200,
          );
        }
        expect(request.headers['Authorization'], 'Bearer token');
        return http.Response.bytes(
          utf8.encode(jsonEncode({'error': '로그인 만료'})),
          401,
        );
      }),
    )..server = Uri.parse('https://arena.test');
    await api.login('admin', 'secret');
    expect(api.loggedIn, isTrue);
    await expectLater(
      api.request('GET', 'auth/me'),
      throwsA(
        isA<ApiException>().having((e) => e.message, 'message', '로그인 만료'),
      ),
    );
    expect(api.loggedIn, isFalse);
    expect(
      await const FlutterSecureStorage().read(
        key: 'arena.session.https://arena.test',
      ),
      isNull,
    );
    api.dispose();
  });
  test('invalid JSON and failed logout are actionable', () async {
    final api = ArenaApi(
      client: MockClient((r) async {
        if (r.url.path.endsWith('/login')) {
          return http.Response(
            jsonEncode({
              'token': 'token',
              'admin': {'id': 1, 'username': 'admin'},
            }),
            200,
          );
        }
        return http.Response('<html>bad gateway</html>', 502);
      }),
    )..server = Uri.parse('https://arena.test');
    await api.login('admin', 'secret');
    await expectLater(api.logout(), throwsA(isA<ApiException>()));
    expect(api.loggedIn, isTrue);
    api.dispose();
  });
  testWidgets('unconfigured app presents IP connection form', (tester) async {
    final api = ArenaApi();
    await tester.pumpWidget(ArenaApp(api: api));
    expect(find.text('연결하기'), findsOneWidget);
    expect(find.text('서버 주소'), findsOneWidget);
    api.dispose();
  });
  testWidgets('request failure can be retried into empty state', (
    tester,
  ) async {
    var calls = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: DataView(
            load: () async {
              if (calls++ == 0) throw const ApiException('연결 실패');
              return {};
            },
            builder: (data, refresh) => ListView(children: const [EmptyCard()]),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('연결 실패'), findsOneWidget);
    await tester.tap(find.text('다시 시도'));
    await tester.pumpAndSettle();
    expect(find.text('아직 등록된 기록이 없습니다.'), findsOneWidget);
  });
  testWidgets('player list renders and filters on a small screen', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(360, 740);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final api = ArenaApi(
      client: MockClient(
        (_) async => http.Response.bytes(
          utf8.encode(
            jsonEncode({
              'players': [
                {
                  'id': 1,
                  'name': '홍길동',
                  'position': '미드필더',
                  'totalMatches': 3,
                  'goals': 2,
                  'assists': 1,
                  'mvpCount': 0,
                },
              ],
            }),
          ),
          200,
        ),
      ),
    )..server = Uri.parse('https://arena.test');
    await tester.pumpWidget(
      MaterialApp(home: Scaffold(body: PlayersScreen(api))),
    );
    await tester.pumpAndSettle();
    expect(find.textContaining('홍길동'), findsOneWidget);
    await tester.enterText(find.byType(TextField), '없는선수');
    await tester.pumpAndSettle();
    expect(find.text('조건에 맞는 선수가 없습니다.'), findsOneWidget);
    expect(tester.takeException(), isNull);
    api.dispose();
  });
  testWidgets('match editor validates missing teams without saving', (
    tester,
  ) async {
    final requests = <String>[];
    final api = ArenaApi(
      client: MockClient((r) async {
        requests.add(r.method);
        return http.Response('{"players":[]}', 200);
      }),
    )..server = Uri.parse('https://arena.test');
    await tester.pumpWidget(MaterialApp(home: MatchEditor(api)));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextFormField, '장소'), '테스트 구장');
    await tester.scrollUntilVisible(
      find.text('경기 저장'),
      400,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.text('경기 저장'));
    await tester.pumpAndSettle();
    expect(find.text('각 팀에 최소 1명의 선수를 배정해주세요.'), findsOneWidget);
    expect(requests, ['GET']);
    api.dispose();
  });
}
