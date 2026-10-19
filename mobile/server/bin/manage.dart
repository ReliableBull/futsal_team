import 'dart:io';

import 'package:arena_club_server/arena_club_server.dart';

/// Operator commands that intentionally have no API endpoint.
///
///   `accounts` list accounts (id, provider, name)
///   `grant-owner CLUB_ID ACCOUNT_ID` give an unowned club (e.g. imported ARENA FC) a verified owner
///   `approve-booking CODE` demo venue operator approval (pending_approval → confirmed)
void main(List<String> args) {
  final config = Config.fromEnvironment();
  final b = Backend(config, Db.open(config.dbPath));
  final db = b.db;
  switch (args) {
    case ['accounts']:
      for (final a in db.all('SELECT id, provider, display_name, status FROM accounts ORDER BY id')) {
        stdout.writeln('${a['id']}\t${a['provider']}\t${a['status']}\t${a['display_name']}');
      }
    case ['grant-owner', final club, final account]:
      db.tx(() {
        if (db.scalar("SELECT 1 FROM memberships WHERE club_id = ? AND role = 'owner' AND status = 'approved'", [int.parse(club)]) != null) {
          throw StateError('이미 소유자가 있는 동호회입니다. 앱에서 소유권 이전을 사용하세요.');
        }
        db.run(
            "INSERT INTO memberships (club_id, account_id, role, status, requested_at, decided_at) VALUES (?, ?, 'owner', 'approved', ?, ?) "
            "ON CONFLICT (club_id, account_id) DO UPDATE SET role = 'owner', status = 'approved', decided_at = excluded.decided_at",
            [int.parse(club), int.parse(account), b.nowIso(), b.nowIso()]);
        b.audit(int.parse(club), null, 'club.owner_granted_by_operator', 'account', account);
      });
      stdout.writeln('소유자 지정 완료');
    case ['approve-booking', final code]:
      final n = db.tx(() {
        final bk = db.one("SELECT b.id FROM bookings b JOIN venues v ON v.id = b.venue_id WHERE b.code = ? AND b.status = 'pending_approval' AND v.is_demo = 1", [code]);
        if (bk == null) return 0;
        db.run("UPDATE bookings SET status = 'confirmed', updated_at = ? WHERE id = ?", [b.nowIso(), bk['id']]);
        db.insert("INSERT INTO booking_events (booking_id, from_status, to_status, actor, detail, created_at) VALUES (?, 'pending_approval', 'confirmed', 'demo_operator', '데모 구장 승인', ?)", [bk['id'], b.nowIso()]);
        return 1;
      });
      stdout.writeln(n == 1 ? '승인 완료' : '승인 대기 중인 데모 예약을 찾지 못했습니다.');
    default:
      stderr.writeln('사용법: manage.dart accounts | grant-owner <clubId> <accountId> | approve-booking <code>');
      exit(2);
  }
  db.close();
}
