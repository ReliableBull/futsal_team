import 'dart:convert';

import 'backend.dart';
import 'db.dart';
import 'http.dart';
import 'security.dart';

const liveStatuses = ['pending_approval', 'pending_payment', 'confirmed'];
const seoulOffset = Duration(hours: 9); // Asia/Seoul has no DST.

String seoulDay(DateTime utc) => utc.toUtc().add(seoulOffset).toIso8601String().substring(0, 10);

/// Rolling 14-day inventory for demo venues, based on today's date in Seoul.
/// Idempotent: existing slots and bookings are never touched.
void ensureDemoInventory(Backend b) {
  final today = seoulDay(b.now());
  final db = b.db;
  if (db.scalar("SELECT value FROM app_state WHERE key = 'demo_inventory_day'") == today) return;
  db.tx(() {
    final venues = db.all("SELECT * FROM venues WHERE is_demo = 1 AND provider = 'demo'");
    final base = DateTime.parse('${today}T00:00:00Z');
    for (final v in venues) {
      for (var d = 0; d < 14; d++) {
        final day = base.add(Duration(days: d));
        final date = day.toIso8601String().substring(0, 10);
        for (var hour = v['open_hour'] as int; hour + 2 <= (v['close_hour'] as int); hour += 2) {
          final startUtc = day.add(Duration(hours: hour)).subtract(seoulOffset);
          final local = '${hour.toString().padLeft(2, '0')}:00';
          // Deterministic mix so every screen shows each state.
          final mix = (date.codeUnits.fold<int>(0, (h, c) => h * 31 + c) + (v['id'] as int) * 131 + hour * 7).abs() % 12;
          final blocked = mix == 0 && d > 0;
          db.run('INSERT OR IGNORE INTO venue_slots (venue_id, local_date, local_start, starts_at, ends_at, price, status) VALUES (?,?,?,?,?,?,?)',
              [v['id'], date, local, iso(startUtc), iso(startUtc.add(Duration(minutes: v['slot_minutes'] as int))),
               v['price_per_slot'], blocked ? 'blocked' : 'open']);
          if (blocked || d == 0 || mix > 3) continue;
          final slot = db.one('SELECT id, status FROM venue_slots WHERE venue_id = ? AND starts_at = ?', [v['id'], iso(startUtc)])!;
          if (slot['status'] != 'open') continue;
          final status = mix <= 2 ? 'confirmed' : (v['booking_mode'] == 'payment' ? 'pending_payment' : 'pending_approval');
          final ref = 'demo:${v['id']}:${iso(startUtc)}';
          if (db.scalar('SELECT 1 FROM bookings WHERE slot_id = ? AND status IN (${liveStatuses.map((_) => '?').join(',')})', [slot['id'], ...liveStatuses]) != null) continue;
          db.run(
              'INSERT OR IGNORE INTO bookings (code, venue_id, slot_id, booker_name, phone_hmac, phone_masked, price, status, idempotency_key, '
              'hold_expires_at, is_demo, seed_ref, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,1,?,?,?)',
              ['DEMO-${randomCode(6)}', v['id'], slot['id'], '예시 예약자', 'demo-seed-not-a-phone', '010-****-0000',
               v['price_per_slot'], status, 'seed:$ref', status == 'pending_payment' ? iso(startUtc.subtract(const Duration(hours: 1))) : null,
               ref, b.nowIso(), b.nowIso()]);
        }
      }
    }
    db.run("INSERT OR REPLACE INTO app_state (key, value) VALUES ('demo_inventory_day', ?)", [today]);
  });
}

List<Route> venueRoutes(Backend b) {
  final db = b.db;

  void expireHolds() {
    final now = b.nowIso();
    final expired = db.all("SELECT id FROM bookings WHERE status = 'pending_payment' AND hold_expires_at <= ?", [now]);
    if (expired.isEmpty) return;
    db.tx(() {
      for (final row in expired) {
        db.run("UPDATE bookings SET status = 'expired', updated_at = ? WHERE id = ?", [now, row['id']]);
        db.insert("INSERT INTO booking_events (booking_id, from_status, to_status, actor, detail, created_at) VALUES (?, 'pending_payment', 'expired', 'system', '결제 시간 초과', ?)",
            [row['id'], now]);
      }
    });
  }

  Json venueJson(Json v, {bool detail = false}) => {
        'id': v['id'],
        'slug': v['slug'],
        'name': v['name'],
        'region': v['region'],
        'areaLabel': v['area_label'],
        'indoor': flag(v['indoor']),
        'playFormat': v['play_format'],
        'surface': v['surface'],
        'pricePerSlot': v['price_per_slot'],
        'slotMinutes': v['slot_minutes'],
        'amenities': jsonDecode(v['amenities_json'] as String),
        'bookingMode': v['booking_mode'],
        'cancelDeadlineHours': v['cancel_deadline_hours'],
        'paymentHoldMinutes': v['payment_hold_minutes'],
        'isDemo': flag(v['is_demo']),
        'provider': v['provider'],
        'openHour': v['open_hour'],
        'closeHour': v['close_hour'],
        if (detail) 'description': v['description'],
        if (flag(v['is_demo'])) 'demoNotice': '예시 풋살장 · 실제 예약 아님',
      };

  Json loadVenue(int id) => db.one('SELECT * FROM venues WHERE id = ?', [id]) ?? (throw notFound('풋살장을 찾을 수 없습니다.'));

  /// Verified phone from X-Guest-Token. Used by guests and signed-in users.
  Json? guestToken(Ctx ctx) {
    final token = ctx.header('x-guest-token');
    if (token == null || token.length < 20) return null;
    return db.one('SELECT * FROM guest_tokens WHERE token_hash = ? AND expires_at > ?', [sha256Hex(token), b.nowIso()]);
  }

  Json bookingJson(Json bk) {
    final venue = loadVenue(bk['venue_id'] as int);
    final slot = db.one('SELECT * FROM venue_slots WHERE id = ?', [bk['slot_id']])!;
    final start = DateTime.parse(slot['starts_at'] as String);
    final deadline = start.subtract(Duration(hours: venue['cancel_deadline_hours'] as int));
    final live = liveStatuses.contains(bk['status']);
    final beforeDeadline = b.now().isBefore(deadline);
    return {
      'code': bk['code'],
      'status': bk['status'],
      'venue': {'id': venue['id'], 'name': venue['name'], 'isDemo': flag(venue['is_demo']), 'bookingMode': venue['booking_mode']},
      'slot': {'id': slot['id'], 'date': slot['local_date'], 'start': slot['local_start'], 'startsAt': slot['starts_at'], 'endsAt': slot['ends_at']},
      'bookerName': bk['booker_name'],
      'phoneMasked': bk['phone_masked'],
      'headcount': bk['headcount'],
      'note': bk['note'],
      'price': bk['price'],
      'holdExpiresAt': bk['hold_expires_at'],
      'cancelDeadline': iso(deadline),
      'canCancel': live && beforeDeadline,
      'canChange': (bk['status'] == 'confirmed' || bk['status'] == 'pending_approval') && beforeDeadline,
      'canPayDemo': bk['status'] == 'pending_payment' && flag(venue['is_demo']),
      'linkedToAccount': bk['account_id'] != null,
      'isDemo': flag(bk['is_demo']),
      'createdAt': bk['created_at'],
      'cancelledAt': bk['cancelled_at'],
      'events': [
        for (final e in db.all('SELECT * FROM booking_events WHERE booking_id = ? ORDER BY id', [bk['id']]))
          {'from': e['from_status'], 'to': e['to_status'], 'actor': e['actor'], 'detail': e['detail'], 'at': e['created_at']}
      ],
    };
  }

  /// Booking owner check. Unknown and foreign codes answer the same 404 so
  /// codes cannot be probed.
  Json ownedBooking(Ctx ctx) {
    expireHolds();
    final code = ctx.params['code']!.toUpperCase();
    final bk = db.one('SELECT * FROM bookings WHERE code = ?', [code]);
    final guest = guestToken(ctx);
    final ok = bk != null &&
        ((guest != null && constantTimeEquals(guest['phone_hmac'] as String, bk['phone_hmac'] as String)) ||
            (ctx.account != null && bk['account_id'] == ctx.account!['id']));
    if (!ok) throw notFound('예약을 찾을 수 없습니다. 예약자 본인 확인 후 다시 조회해주세요.');
    return bk;
  }

  void event(int bookingId, String? from, String to, String actor, [String? detail]) => db.insert(
      'INSERT INTO booking_events (booking_id, from_status, to_status, actor, detail, created_at) VALUES (?,?,?,?,?,?)',
      [bookingId, from, to, actor, detail, b.nowIso()]);

  Json requireOpenSlot(Json venue, int slotId) {
    final slot = db.one('SELECT * FROM venue_slots WHERE id = ? AND venue_id = ?', [slotId, venue['id']]) ??
        (throw notFound('예약 시간을 찾을 수 없습니다.'));
    if (slot['status'] != 'open') throw conflict('운영하지 않는 시간입니다.', 'slot_closed');
    if ((slot['starts_at'] as String).compareTo(b.nowIso()) <= 0) throw conflict('이미 지난 시간입니다.', 'slot_past');
    if (db.scalar("SELECT 1 FROM bookings WHERE slot_id = ? AND status IN ('pending_approval','pending_payment','confirmed')", [slotId]) != null) {
      throw conflict('방금 다른 사용자가 먼저 예약했습니다. 다른 시간을 선택해주세요.', 'slot_taken');
    }
    return slot;
  }

  void requireDemoProvider(Json venue) {
    if (venue['provider'] != 'demo') {
      // Integration point for a real reservation provider.
      throw const ApiError(501, '이 구장의 예약 연동은 아직 준비되지 않았습니다.', 'provider_not_integrated');
    }
  }

  return [
    Route('GET', '/venues', (ctx) {
      ensureDemoInventory(b);
      final q = (ctx.query['q'] ?? '').trim();
      final region = (ctx.query['region'] ?? '').trim();
      final indoor = ctx.query['indoor'];
      final wanted = (ctx.query['amenities'] ?? '').split(',').where((s) => s.isNotEmpty).toSet();
      final rows = db.all('SELECT * FROM venues ORDER BY is_demo, name');
      final venues = rows.map((v) => venueJson(v)).where((v) {
        if (q.isNotEmpty && !'${v['name']} ${v['region']} ${v['areaLabel']}'.contains(q)) return false;
        if (region.isNotEmpty && v['region'] != region) return false;
        if (indoor == 'true' && v['indoor'] != true) return false;
        if (indoor == 'false' && v['indoor'] != false) return false;
        final amenities = v['amenities'] as Map;
        return wanted.every((a) => amenities[a] == true);
      }).toList();
      return {
        'venues': venues,
        'regions': rows.map((v) => v['region']).toSet().toList(),
      };
    }),

    Route('GET', '/venues/:id', (ctx) {
      ensureDemoInventory(b);
      final venue = loadVenue(ctx.intParam('id'));
      final today = seoulDay(b.now());
      final days = db.all(
          "SELECT local_date FROM venue_slots WHERE venue_id = ? AND local_date >= ? GROUP BY local_date ORDER BY local_date LIMIT 14",
          [venue['id'], today]);
      return {'venue': venueJson(venue, detail: true), 'dates': days.map((d) => d['local_date']).toList(), 'today': today};
    }),

    Route('GET', '/venues/:id/slots', (ctx) {
      ensureDemoInventory(b);
      expireHolds();
      final venue = loadVenue(ctx.intParam('id'));
      final date = parseDay(ctx.query['date'], '예약') ?? seoulDay(b.now());
      final rows = db.all(
          'SELECT s.*, (SELECT status FROM bookings bk WHERE bk.slot_id = s.id AND bk.status IN '
          "('pending_approval','pending_payment','confirmed')) AS booking_status "
          'FROM venue_slots s WHERE s.venue_id = ? AND s.local_date = ? ORDER BY s.starts_at',
          [venue['id'], date]);
      final now = b.nowIso();
      return {
        'date': date,
        'slots': [
          for (final s in rows)
            {
              'id': s['id'],
              'start': s['local_start'],
              'startsAt': s['starts_at'],
              'endsAt': s['ends_at'],
              'price': s['price'],
              // Never reveals who booked.
              'availability': s['status'] == 'blocked'
                  ? 'closed'
                  : (s['starts_at'] as String).compareTo(now) <= 0
                      ? 'past'
                      : switch (s['booking_status']) {
                          'confirmed' => 'booked',
                          'pending_approval' || 'pending_payment' => 'pending',
                          _ => 'available',
                        },
            }
        ],
      };
    }),

    // --------------------------------------------------- phone verification
    Route('POST', '/guest/verify/start', (ctx) async {
      final String phone;
      try {
        phone = normalizePhone((await ctx.json()).str('phone', max: 20));
      } on FormatException catch (e) {
        throw badRequest(e.message);
      }
      if (!b.config.demoSmsEnabled) {
        // Integration point for a real SMS provider.
        throw const ApiError(503, '휴대폰 인증 문자 발송이 아직 연동되지 않았습니다.', 'sms_not_configured');
      }
      final hmac = hmacHex(b.config.secret, 'phone:$phone');
      final hourAgo = iso(b.now().subtract(const Duration(hours: 1)));
      if ((db.scalar('SELECT COUNT(*) FROM phone_verifications WHERE phone_hmac = ? AND created_at > ?', [hmac, hourAgo]) as int) >= 5) {
        throw const ApiError(429, '인증 요청이 너무 많습니다. 1시간 후 다시 시도해주세요.');
      }
      final id = randomToken(16);
      final code = randomDigits(6);
      final expires = iso(b.now().add(const Duration(minutes: 5)));
      db.insert('INSERT INTO phone_verifications (id, phone_hmac, code_hash, expires_at, created_at) VALUES (?,?,?,?,?)',
          [id, hmac, hmacHex(b.config.secret, '$id:$code'), expires, b.nowIso()]);
      return {
        'verificationId': id,
        'expiresAt': expires,
        'delivery': 'demo',
        // Development only: no SMS is sent; the code is shown in the app.
        'demoCode': code,
      };
    }),

    Route('POST', '/guest/verify/confirm', (ctx) async {
      final body = await ctx.json();
      final id = body.str('verificationId', max: 64);
      final code = body.str('code', max: 6);
      final phone = body.str('phone', max: 20);
      final result = db.tx(() {
        final v = db.one('SELECT * FROM phone_verifications WHERE id = ?', [id]);
        if (v == null || v['verified_at'] != null || (v['expires_at'] as String).compareTo(b.nowIso()) <= 0) {
          throw const ApiError(410, '인증 시간이 지났습니다. 인증번호를 다시 요청해주세요.', 'verification_expired');
        }
        if ((v['attempts'] as int) >= 5) throw const ApiError(429, '인증 시도 횟수를 초과했습니다. 다시 요청해주세요.');
        db.run('UPDATE phone_verifications SET attempts = attempts + 1 WHERE id = ?', [id]);
        String digits;
        try {
          digits = normalizePhone(phone);
        } on FormatException catch (e) {
          throw badRequest(e.message);
        }
        if (!constantTimeEquals(v['code_hash'] as String, hmacHex(b.config.secret, '$id:$code')) ||
            v['phone_hmac'] != hmacHex(b.config.secret, 'phone:$digits')) {
          return null;
        }
        db.run('UPDATE phone_verifications SET verified_at = ? WHERE id = ?', [b.nowIso(), id]);
        final token = randomToken();
        final expires = iso(b.now().add(const Duration(hours: 24)));
        db.insert('INSERT INTO guest_tokens VALUES (?,?,?,?,?)', [sha256Hex(token), v['phone_hmac'], maskPhone(digits), expires, b.nowIso()]);
        return {'guestToken': token, 'expiresAt': expires, 'phoneMasked': maskPhone(digits)};
      });
      if (result == null) throw const ApiError(400, '인증번호가 올바르지 않습니다.', 'wrong_code');
      return result;
    }),

    // ----------------------------------------------------------- bookings
    Route('POST', '/venues/:id/bookings', (ctx) async {
      final venue = loadVenue(ctx.intParam('id'));
      requireDemoProvider(venue);
      final guest = guestToken(ctx) ?? (throw const ApiError(401, '예약자 연락처 확인이 필요합니다.', 'phone_verification_required'));
      final body = await ctx.json();
      final slotId = body.optInt('slotId', min: 1) ?? (throw badRequest('예약 시간을 선택해주세요.'));
      final name = body.str('bookerName', max: 20);
      final key = body.str('idempotencyKey', max: 100, min: 16);
      if (body['agreePolicy'] != true) throw badRequest('요금과 취소 규정에 동의해주세요.');
      final headcount = body.optInt('headcount', min: 1, max: 30);
      final note = body.optStr('note', max: 200);
      expireHolds();
      final result = db.tx(() {
        // Retried request (e.g. response lost on a flaky network).
        final replay = db.one('SELECT * FROM bookings WHERE idempotency_key = ?', [key]);
        if (replay != null) {
          if (replay['phone_hmac'] != guest['phone_hmac'] || replay['slot_id'] != slotId) {
            throw conflict('이미 사용된 요청 번호입니다. 다시 시도해주세요.', 'idempotency_mismatch');
          }
          return (replay, false);
        }
        final slot = requireOpenSlot(venue, slotId);
        final status = switch (venue['booking_mode']) {
          'instant' => 'confirmed',
          'approval' => 'pending_approval',
          _ => 'pending_payment',
        };
        final hold = status == 'pending_payment'
            ? iso(b.now().add(Duration(minutes: venue['payment_hold_minutes'] as int)))
            : null;
        final id = db.insert(
            'INSERT INTO bookings (code, venue_id, slot_id, account_id, booker_name, phone_hmac, phone_masked, headcount, note, price, '
            'status, idempotency_key, hold_expires_at, is_demo, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
            ['BK-${randomCode(8)}', venue['id'], slot['id'], ctx.account?['id'], name, guest['phone_hmac'], guest['phone_masked'],
             headcount, note, slot['price'], status, key, hold, venue['is_demo'], b.nowIso(), b.nowIso()]);
        event(id, null, status, ctx.account == null ? 'guest' : 'member');
        return (db.one('SELECT * FROM bookings WHERE id = ?', [id])!, true);
      });
      final json = {'booking': bookingJson(result.$1), 'replayed': !result.$2};
      return result.$2 ? Created(json) : json;
    }),

    Route('GET', '/guest/bookings', (ctx) {
      expireHolds();
      final guest = guestToken(ctx) ?? (throw const ApiError(401, '예약자 연락처 확인이 필요합니다.', 'phone_verification_required'));
      final rows = db.all('SELECT * FROM bookings WHERE phone_hmac = ? ORDER BY created_at DESC LIMIT 100', [guest['phone_hmac']]);
      return {'phoneMasked': guest['phone_masked'], 'bookings': rows.map(bookingJson).toList()};
    }),

    Route('GET', '/bookings/:code', (ctx) => {'booking': bookingJson(ownedBooking(ctx))}),

    Route('POST', '/bookings/:code/cancel', (ctx) async {
      final bk = ownedBooking(ctx);
      final reason = ctx.header('content-type')?.contains('json') == true ? (await ctx.json()).optStr('reason', max: 200) : null;
      final json = bookingJson(bk);
      if (json['canCancel'] != true) {
        throw conflict(liveStatuses.contains(bk['status']) ? '취소 가능 시간이 지났습니다.' : '이미 취소되었거나 만료된 예약입니다.', 'cannot_cancel');
      }
      db.tx(() {
        final n = db.run("UPDATE bookings SET status = 'cancelled', cancelled_at = ?, cancel_reason = ?, updated_at = ? "
            "WHERE id = ? AND status IN ('pending_approval','pending_payment','confirmed')", [b.nowIso(), reason, b.nowIso(), bk['id']]);
        if (n == 0) throw conflict('이미 처리된 예약입니다.');
        event(bk['id'] as int, bk['status'] as String, 'cancelled', ctx.account == null ? 'guest' : 'member', reason);
      });
      return {'booking': bookingJson(db.one('SELECT * FROM bookings WHERE id = ?', [bk['id']])!)};
    }),

    Route('POST', '/bookings/:code/change', (ctx) async {
      final bk = ownedBooking(ctx);
      if (bookingJson(bk)['canChange'] != true) throw conflict('변경할 수 없는 예약입니다.', 'cannot_change');
      final slotId = (await ctx.json()).optInt('slotId', min: 1) ?? (throw badRequest('변경할 시간을 선택해주세요.'));
      final venue = loadVenue(bk['venue_id'] as int);
      db.tx(() {
        final slot = requireOpenSlot(venue, slotId);
        db.run('UPDATE bookings SET slot_id = ?, price = ?, updated_at = ? WHERE id = ?', [slot['id'], slot['price'], b.nowIso(), bk['id']]);
        event(bk['id'] as int, bk['status'] as String, bk['status'] as String, ctx.account == null ? 'guest' : 'member',
            '시간 변경 → ${slot['local_date']} ${slot['local_start']}');
      });
      return {'booking': bookingJson(db.one('SELECT * FROM bookings WHERE id = ?', [bk['id']])!)};
    }),

    // Demo venues only: simulates the payment step. No money moves.
    Route('POST', '/bookings/:code/demo-payment', (ctx) {
      final bk = ownedBooking(ctx);
      final venue = loadVenue(bk['venue_id'] as int);
      if (!flag(venue['is_demo'])) throw forbidden('실제 결제는 아직 연동되지 않았습니다.');
      db.tx(() {
        final n = db.run("UPDATE bookings SET status = 'confirmed', hold_expires_at = NULL, updated_at = ? WHERE id = ? AND status = 'pending_payment'",
            [b.nowIso(), bk['id']]);
        if (n == 0) throw conflict('결제 대기 중인 예약이 아닙니다. 결제 시간이 지났다면 다시 예약해주세요.', 'not_payable');
        event(bk['id'] as int, 'pending_payment', 'confirmed', 'demo_payment', '데모 결제 (실제 결제 없음)');
      });
      return {'booking': bookingJson(db.one('SELECT * FROM bookings WHERE id = ?', [bk['id']])!)};
    }),

    Route('GET', '/me/bookings', (ctx) {
      expireHolds();
      final rows = db.all('SELECT * FROM bookings WHERE account_id = ? ORDER BY created_at DESC LIMIT 100', [ctx.accountId]);
      return {'bookings': rows.map(bookingJson).toList()};
    }),

    // Linking requires a fresh phone verification (proof of ownership),
    // never a name or typed-in phone match.
    Route('POST', '/me/bookings/link', (ctx) {
      final accountId = ctx.accountId;
      final guest = guestToken(ctx) ?? (throw const ApiError(401, '예약에 사용한 휴대폰 번호를 먼저 인증해주세요.', 'phone_verification_required'));
      final n = db.tx(() {
        final rows = db.all('SELECT id FROM bookings WHERE phone_hmac = ? AND account_id IS NULL', [guest['phone_hmac']]);
        for (final r in rows) {
          db.run('UPDATE bookings SET account_id = ?, updated_at = ? WHERE id = ?', [accountId, b.nowIso(), r['id']]);
          event(r['id'] as int, null, db.scalar('SELECT status FROM bookings WHERE id = ?', [r['id']]) as String, 'member', '회원 계정에 연결');
        }
        return rows.length;
      });
      return {'linked': n};
    }),
  ];
}
