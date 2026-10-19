import 'dart:io';

import 'package:arena_club_server/arena_club_server.dart' as server;
import 'package:arena_fc/club/club_api.dart';
import 'package:arena_fc/club/clubs.dart';
import 'package:arena_fc/club/shell.dart';
import 'package:arena_fc/core/api.dart' show ArenaApi;
import 'package:arena_fc/main.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shelf/shelf.dart' as shelf;

/// Real club backend (in-memory SQLite + demo seed) behind the app's HTTP
/// client, so widget tests exercise the actual server rules.
class LocalServer {
  LocalServer() {
    storage = Directory.systemTemp.createTempSync('club-widget-');
    backend = server.Backend(
      server.Config(env: 'test', dbPath: ':memory:', storageDir: storage.path, secret: 'widget-test-secret-widget-test-secret', smsMode: 'demo'),
      server.Db.open(':memory:'),
    );
    server.seedDemo(backend);
  }
  late final Directory storage;
  late final server.Backend backend;

  http.Client client() => MockClient((req) async {
        final res = await backend.handler(shelf.Request(req.method, Uri.parse('http://localhost${req.url.path}${req.url.hasQuery ? '?${req.url.query}' : ''}'),
            headers: req.headers, body: req.bodyBytes));
        return http.Response.bytes(await res.read().expand((c) => c).toList(), res.statusCode, headers: res.headers);
      });

  void dispose() {
    backend.db.close();
    storage.deleteSync(recursive: true);
  }
}

Future<ClubApi> startApi(LocalServer s) async {
  final api = ClubApi(client: s.client());
  await api.initialize();
  await api.refreshSession();
  return api;
}

Future<void> pumpApp(WidgetTester tester, ClubApi api) async {
  await tester.pumpWidget(ClubApp(api: api, legacy: ArenaApi()));
  await tester.pumpAndSettle();
}

/// Scrolls lazily built lists until [finder] exists, then into view.
Future<void> reveal(WidgetTester tester, Finder finder) async {
  for (var i = 0; i < 40 && finder.evaluate().isEmpty; i++) {
    await tester.drag(find.byType(Scrollable).first, const Offset(0, -250));
    await tester.pumpAndSettle();
  }
  await tester.ensureVisible(finder.first);
  await tester.pumpAndSettle();
}

Future<void> tapText(WidgetTester tester, String text, {bool last = false}) async {
  if (find.text(text).evaluate().isEmpty) await reveal(tester, find.text(text));
  final finder = last ? find.text(text).last : find.text(text).first;
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late LocalServer s;
  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
    s = LocalServer();
  });
  tearDown(() => s.dispose());

  test('invite links and codes are parsed', () {
    final token = 'A' * 32;
    expect(parseInvite('arenaclub://app/invite/$token'), token);
    expect(parseInvite('/invite/$token'), token);
    expect(parseInvite(token), token);
    expect(parseInvite('https://evil/invite/short'), isNull);
  });

  testWidgets('first launch opens public browsing without a login gate', (tester) async {
    final api = await tester.runAsync(() => startApi(s));
    await pumpApp(tester, api!);
    expect(find.text('로그인'), findsNothing);
    expect(find.text('대구 나이트 FC'), findsWidgets);
    expect(find.text('예시 동호회'), findsWidgets);
    await tester.tap(find.text('풋살장').last);
    await tester.pumpAndSettle();
    expect(find.text('예시 달빛 실내 풋살장'), findsOneWidget);
    expect(find.text('예시 풋살장 · 실제 예약 아님'), findsWidgets);
  });

  testWidgets('guest books a demo venue, finds it after restart, and cancels it', (tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final api = await tester.runAsync(() => startApi(s));
    await pumpApp(tester, api!);
    await tester.tap(find.text('풋살장').last);
    await tester.pumpAndSettle();
    await tapText(tester, '예시 달빛 실내 풋살장');
    // Second date chip: always has open future slots.
    final dates = find.byType(ChoiceChip);
    await reveal(tester, dates);
    await tester.tap(dates.at(2));
    await tester.pumpAndSettle();
    await tapText(tester, '80,000원');
    expect(find.text('예약 신청'), findsOneWidget);
    await tester.enterText(find.widgetWithText(TextFormField, '예약자 이름'), '홍길동');
    await tapText(tester, '확인하기');
    await tester.enterText(find.widgetWithText(TextField, '휴대폰 번호'), '010-1234-5678');
    await tapText(tester, '인증번호 받기');
    final demo = find.textContaining('데모 인증번호');
    expect(demo, findsOneWidget);
    final code = RegExp(r'(\d{6})').firstMatch((tester.widget<Text>(demo)).data!)!.group(1)!;
    await tester.enterText(find.widgetWithText(TextField, '인증번호 6자리'), code);
    await tapText(tester, '확인');
    expect(find.textContaining('010-****-5678 확인 완료'), findsOneWidget);
    await tapText(tester, '요금과 취소 규정을 확인했습니다.');
    await tapText(tester, '예약하기');
    expect(find.text('예약 상세'), findsOneWidget);
    expect(find.text('예약 확정'), findsWidgets);
    final codeText = s.backend.db.scalar("SELECT code FROM bookings WHERE booker_name = '홍길동'") as String;
    expect(s.backend.db.scalar("SELECT account_id FROM bookings WHERE code = ?", [codeText]), isNull);

    // Simulated restart: a fresh client restores the verified phone from secure storage.
    final restarted = await tester.runAsync(() => startApi(s));
    await tester.pumpWidget(const SizedBox());
    await pumpApp(tester, restarted!);
    await tester.tap(find.text('내 예약').last);
    await tester.pumpAndSettle();
    expect(find.textContaining(codeText), findsOneWidget);
    await tapText(tester, '예시 달빛 실내 풋살장');
    await tapText(tester, '예약 취소');
    await tapText(tester, '예약 취소', last: true);
    expect(find.text('취소됨'), findsWidgets);
    expect(s.backend.db.scalar('SELECT status FROM bookings WHERE code = ?', [codeText]), 'cancelled');
  });

  testWidgets('join asks for login only on demand and returns to the club', (tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final api = await tester.runAsync(() => startApi(s));
    final night = s.backend.db.scalar("SELECT id FROM clubs WHERE source_ref = 'daegu-night'") as int;
    await tester.pumpWidget(MaterialApp(theme: arenaTheme(), home: ClubScreen(api!, night)));
    await tester.pumpAndSettle();
    expect(find.text('최신 경기 결과'), findsOneWidget); // public records, no login
    await tapText(tester, '가입 신청');
    expect(find.text('대구 나이트 FC에 가입 신청하려면 로그인하세요'), findsOneWidget);
    await tester.tap(find.byTooltip('취소'));
    await tester.pumpAndSettle();
    expect(find.text('대구 나이트 FC'), findsWidgets); // back on the club

    await tapText(tester, '가입 신청');
    await reveal(tester, find.widgetWithText(TextField, '테스트 계정 아이디'));
    await tester.enterText(find.widgetWithText(TextField, '테스트 계정 아이디'), 'newbie');
    await tester.enterText(find.widgetWithText(TextField, '비밀번호'), server.demoPassword);
    await tester.runAsync(() async {
      await tester.tap(find.text('테스트 계정으로 로그인'));
      await Future<void>.delayed(const Duration(milliseconds: 500));
    });
    await tester.pumpAndSettle();
    expect(find.text('가입 신청').first, findsOneWidget); // dialog title
    await tapText(tester, '신청');
    expect(find.text('가입 승인 대기 중'), findsWidgets);
    expect(s.backend.db.scalar(
        "SELECT m.status FROM memberships m JOIN accounts a ON a.id = m.account_id WHERE a.provider_subject = 'newbie' AND m.club_id = ?", [night]), 'pending');
  });

  testWidgets('members-only club shows a lock instead of records, on a small screen', (tester) async {
    tester.view.physicalSize = const Size(320 * 2, 568 * 2);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);
    final api = await tester.runAsync(() => startApi(s));
    final beginner = s.backend.db.scalar("SELECT id FROM clubs WHERE source_ref = 'suseong-beginner'") as int;
    await tester.pumpWidget(MaterialApp(theme: arenaTheme(), home: ClubScreen(api!, beginner)));
    await tester.pumpAndSettle();
    expect(find.text('회원 전용 기록입니다. 가입 승인 후 볼 수 있습니다.'), findsOneWidget);
    expect(find.text('최신 경기 결과'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('club home on a small screen renders rankings with ties', (tester) async {
    tester.view.physicalSize = const Size(320 * 2, 568 * 2);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);
    final api = await tester.runAsync(() => startApi(s));
    final night = s.backend.db.scalar("SELECT id FROM clubs WHERE source_ref = 'daegu-night'") as int;
    await tester.pumpWidget(MaterialApp(theme: arenaTheme(), home: ClubScreen(api!, night)));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('득점 랭킹'), 300, scrollable: find.byType(Scrollable).at(2));
    await tester.pumpAndSettle();
    expect(find.text('1='), findsWidgets);
    expect(tester.takeException(), isNull);
  });

  testWidgets('logged-in shell shows different roles per club', (tester) async {
    final api = await tester.runAsync(() async {
      final a = await startApi(s);
      await a.devLogin('multi_manager', server.demoPassword);
      return a;
    });
    await tester.pumpWidget(MaterialApp(theme: arenaTheme(), home: Scaffold(body: MyPageTab(api!, ArenaApi()))));
    await tester.pumpAndSettle();
    expect(find.text('운영진'), findsOneWidget);
    expect(find.text('일반 회원'), findsOneWidget);
  });
}
