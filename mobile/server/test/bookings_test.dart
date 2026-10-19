import 'package:arena_club_server/arena_club_server.dart';
import 'package:test/test.dart';

import 'harness.dart';

void main() {
  late Harness h;
  setUp(() {
    h = Harness();
    seedDemo(h.backend);
  });
  tearDown(() => h.dispose());

  int venue(String slug) => h.db.scalar('SELECT id FROM venues WHERE slug = ?', [slug]) as int;

  Future<int> openSlot(int venueId, {int dayOffset = 3}) async {
    final date = seoulDay(h.clock.add(Duration(days: dayOffset)));
    final slots = (await h.get('/venues/$venueId/slots?date=$date')).json['slots'] as List;
    return slots.firstWhere((s) => s['availability'] == 'available')['id'] as int;
  }

  Map<String, dynamic> booking(int slot, String key) =>
      {'slotId': slot, 'bookerName': '홍길동', 'agreePolicy': true, 'idempotencyKey': key, 'headcount': 10};

  test('예약 슬롯은 서울 날짜 기준 향후 14일이며 상태가 섞여 있다', () async {
    final v = venue('demo-moonlight');
    final detail = await h.get('/venues/$v');
    final dates = detail.json['dates'] as List;
    expect(dates.length, 14);
    expect(dates.first, seoulDay(h.clock));
    expect(detail.json['venue']['demoNotice'], '예시 풋살장 · 실제 예약 아님');
    final all = <String>{};
    for (final d in dates) {
      for (final s in (await h.get('/venues/$v/slots?date=$d')).json['slots'] as List) {
        all.add(s['availability'] as String);
        expect(s.containsKey('bookerName'), isFalse);
      }
    }
    expect(all, containsAll(['available', 'booked', 'pending', 'closed']));
    final next = h.clock.add(const Duration(days: 20));
    h.clock = next;
    expect(((await h.get('/venues/$v')).json['dates'] as List).first, seoulDay(next));
  });

  test('필터: 실내·샤워실', () async {
    final r = await h.get('/venues?indoor=true&amenities=shower');
    expect((r.json['venues'] as List).map((v) => v['slug']), ['demo-central']);
  });

  test('비회원 예약: 연락처 인증 → 저장 → 본인만 조회·취소 → 슬롯 재오픈', () async {
    final v = venue('demo-moonlight');
    final slot = await openSlot(v);
    expect((await h.post('/venues/$v/bookings', booking(slot, 'key-0000000000000001'))).status, 401);
    final guest = await h.verifiedGuest();
    final created = await h.post('/venues/$v/bookings', booking(slot, 'key-0000000000000001'), null, guest);
    expect(created.status, 201);
    final code = created.json['booking']['code'] as String;
    expect(created.json['booking']['status'], 'confirmed');
    expect(created.json['booking']['phoneMasked'], '010-****-5678');
    expect(h.db.scalar('SELECT account_id FROM bookings WHERE code = ?', [code]), isNull);
    expect(h.db.scalar("SELECT COUNT(*) FROM accounts WHERE source = 'user_created'"), 0); // no hidden account

    // Booking code alone is not enough.
    expect((await h.get('/bookings/$code')).status, 404);
    final other = await h.verifiedGuest('010-9999-0000');
    expect((await h.get('/bookings/$code', guest: other)).status, 404);
    expect((await h.post('/bookings/$code/cancel', {}, null, other)).status, 404);
    // Same phone on "another device": a fresh verification finds it.
    final secondDevice = await h.verifiedGuest();
    final list = await h.get('/guest/bookings', guest: secondDevice);
    expect((list.json['bookings'] as List).map((b) => b['code']), contains(code));

    final cancelled = await h.post('/bookings/$code/cancel', {'reason': '일정 변경'}, null, secondDevice);
    expect(cancelled.json['booking']['status'], 'cancelled');
    final date = seoulDay(h.clock.add(const Duration(days: 3)));
    final slots = (await h.get('/venues/$v/slots?date=$date')).json['slots'] as List;
    expect(slots.firstWhere((s) => s['id'] == slot)['availability'], 'available');
  });

  test('잘못된 인증번호와 시도 횟수 제한', () async {
    final start = await h.post('/guest/verify/start', {'phone': '01012345678'});
    final wrong = start.json['demoCode'] == '000000' ? '111111' : '000000';
    final r = await h.post('/guest/verify/confirm', {'verificationId': start.json['verificationId'], 'code': wrong, 'phone': '01012345678'});
    expect(r.status, 400);
    final otherPhone = await h.post('/guest/verify/confirm',
        {'verificationId': start.json['verificationId'], 'code': start.json['demoCode'], 'phone': '01099998888'});
    expect(otherPhone.status, 400);
    for (var i = 0; i < 3; i++) {
      await h.post('/guest/verify/confirm', {'verificationId': start.json['verificationId'], 'code': wrong, 'phone': '01012345678'});
    }
    expect((await h.post('/guest/verify/confirm', {'verificationId': start.json['verificationId'], 'code': start.json['demoCode'], 'phone': '01012345678'})).status, 429);
    expect((await h.post('/guest/verify/start', {'phone': '12345'})).status, 400);
  });

  test('동시 요청과 재시도: 같은 슬롯은 하나만 성공, 같은 요청 번호는 중복 생성 없음', () async {
    final v = venue('demo-riverside');
    final slot = await openSlot(v);
    final g1 = await h.verifiedGuest('010-1111-2222'), g2 = await h.verifiedGuest('010-3333-4444');
    final results = await Future.wait([
      h.post('/venues/$v/bookings', booking(slot, 'race-a-000000000001'), null, g1),
      h.post('/venues/$v/bookings', booking(slot, 'race-b-000000000001'), null, g2),
    ]);
    expect(results.map((r) => r.status).toList()..sort(), [201, 409]);
    expect(results.firstWhere((r) => r.status == 409).json['code'], 'slot_taken');
    final winner = results.firstWhere((r) => r.status == 201);
    expect(winner.json['booking']['status'], 'pending_approval');
    final winnerToken = identical(winner, results[0]) ? g1 : g2;
    final key = identical(winner, results[0]) ? 'race-a-000000000001' : 'race-b-000000000001';
    final retry = await h.post('/venues/$v/bookings', booking(slot, key), null, winnerToken);
    expect(retry.status, 200);
    expect(retry.json['replayed'], isTrue);
    expect(retry.json['booking']['code'], winner.json['booking']['code']);
    expect(h.db.scalar('SELECT COUNT(*) FROM bookings WHERE slot_id = ?', [slot]), 1);
    // Database guard independent of application checks.
    expect(() => h.db.run(
        "INSERT INTO bookings (code, venue_id, slot_id, booker_name, phone_hmac, phone_masked, price, status, idempotency_key, created_at, updated_at) "
        "VALUES ('X1', ?, ?, 'x', 'x', 'x', 1, 'confirmed', 'dup-key-x', 'now', 'now')", [v, slot]), throwsA(anything));
  });

  test('결제 대기 예약은 데모 결제 전까지 확정되지 않고, 시간이 지나면 만료되어 슬롯이 열린다', () async {
    final v = venue('demo-central');
    final slot = await openSlot(v);
    final guest = await h.verifiedGuest();
    final created = await h.post('/venues/$v/bookings', booking(slot, 'pay-00000000000001'), null, guest);
    expect(created.json['booking']['status'], 'pending_payment');
    expect(created.json['booking']['canPayDemo'], isTrue);
    h.clock = h.clock.add(const Duration(minutes: 11));
    final code = created.json['booking']['code'];
    final after = await h.get('/bookings/$code', guest: guest);
    expect(after.json['booking']['status'], 'expired');
    expect((await h.post('/bookings/$code/demo-payment', {}, null, guest)).status, 409);
    final again = await h.post('/venues/$v/bookings', booking(slot, 'pay-00000000000002'), null, guest);
    expect(again.status, 201);
    final paid = await h.post('/bookings/${again.json['booking']['code']}/demo-payment', {}, null, guest);
    expect(paid.json['booking']['status'], 'confirmed');
    expect((paid.json['booking']['events'] as List).last['actor'], 'demo_payment');
  });

  test('취소 마감 이후에는 취소·변경할 수 없고, 변경은 같은 구장의 빈 시간만 가능', () async {
    final v = venue('demo-moonlight');
    final guest = await h.verifiedGuest();
    final slot = await openSlot(v, dayOffset: 2);
    final created = await h.post('/venues/$v/bookings', booking(slot, 'chg-00000000000001'), null, guest);
    final code = created.json['booking']['code'];
    final target = await openSlot(v, dayOffset: 4);
    final changed = await h.post('/bookings/$code/change', {'slotId': target}, null, guest);
    expect(changed.status, 200);
    expect(changed.json['booking']['slot']['id'], target);
    final otherVenueSlot = await openSlot(venue('demo-riverside'));
    expect((await h.post('/bookings/$code/change', {'slotId': otherVenueSlot}, null, guest)).status, 404);
    h.clock = h.clock.add(const Duration(days: 4));
    // The 24h guest token has expired: the code alone is not accepted.
    expect((await h.post('/bookings/$code/cancel', {}, null, guest)).status, 404);
    final late = await h.post('/bookings/$code/cancel', {}, null, await h.verifiedGuest());
    expect(late.status, 409);
    expect(late.json['code'], 'cannot_cancel');
  });

  test('로그인 후 비회원 예약 연결은 연락처 재인증을 거친 경우에만 가능', () async {
    final v = venue('demo-moonlight');
    final guest = await h.verifiedGuest();
    final slot = await openSlot(v);
    final code = (await h.post('/venues/$v/bookings', booking(slot, 'link-0000000000001'), null, guest)).json['booking']['code'];
    final token = await h.login('newbie');
    expect((await h.post('/me/bookings/link', {}, token)).status, 401);
    expect(((await h.get('/me/bookings', token: token)).json['bookings'] as List), isEmpty);
    final otherPhone = await h.verifiedGuest('010-5555-6666');
    expect((await h.post('/me/bookings/link', {}, token, otherPhone)).json['linked'], 0);
    expect((await h.post('/me/bookings/link', {}, token, guest)).json['linked'], 1);
    expect(((await h.get('/me/bookings', token: token)).json['bookings'] as List).single['code'], code);
    // Owner by account now, even without the guest token.
    expect((await h.get('/bookings/$code', token: token)).status, 200);
    expect((await h.get('/bookings/$code', token: await h.login('night_member'))).status, 404);
  });

  test('운영 환경 설정에서는 데모 인증·테스트 로그인이 꺼진다', () async {
    expect(() => Config.fromEnvironment({'APP_ENV': 'production', 'APP_SECRET': 'x' * 40, 'SMS_MODE': 'demo'}), throwsStateError);
    expect(() => Config.fromEnvironment({'APP_ENV': 'production'}), throwsStateError);
    final prod = Config.fromEnvironment({'APP_ENV': 'production', 'APP_SECRET': 'x' * 40});
    expect(prod.devLoginEnabled, isFalse);
    expect(prod.demoSmsEnabled, isFalse);
    final ph = Harness(env: 'production');
    ph.backend = Backend(prod, ph.db, clock: () => ph.clock);
    expect((await ph.post('/auth/dev-login', {'username': 'x', 'password': 'y'})).status, 404);
    expect((await ph.post('/guest/verify/start', {'phone': '01012345678'})).status, 503);
    expect(() => seedDemo(ph.backend), throwsStateError);
    ph.dispose();
  });
}
