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

  group('비로그인 공개 조회', () {
    test('공개 동호회 목록과 공개 기록은 로그인 없이 볼 수 있다', () async {
      final clubs = await h.get('/clubs');
      expect(clubs.status, 200);
      expect((clubs.json['clubs'] as List).map((c) => c['name']), containsAll(['대구 나이트 FC', '칠곡 위켄드 FC', '수성 비기너 FC']));
      expect((clubs.json['clubs'] as List).every((c) => c['isDemo'] == true), isTrue);
      final night = h.clubId('daegu-night');
      expect((await h.get('/clubs/$night/dashboard')).status, 200);
      expect((await h.get('/clubs/$night/players')).status, 200);
      expect((await h.get('/clubs/$night/hall-of-fame')).status, 200);
    });

    test('회원 전용 기록은 소개만 공개하고 기록은 403', () async {
      final beginner = h.clubId('suseong-beginner');
      final info = await h.get('/clubs/$beginner');
      expect(info.status, 200);
      expect(info.json['club']['viewer']['permissions']['viewRecords'], isFalse);
      for (final path in ['dashboard', 'players', 'matches', 'hall-of-fame', 'chemistry', 'posters']) {
        final r = await h.get('/clubs/$beginner/$path');
        expect(r.status, 403, reason: path);
        expect(r.json['code'], 'members_only');
      }
    });

    test('만료되거나 잘못된 토큰은 공개 조회를 막지 않는다', () async {
      final r = await h.get('/clubs', token: 'expired-or-garbage-token');
      expect(r.status, 200);
      expect((await h.get('/auth/me', token: 'garbage')).status, 401);
    });
  });

  group('가입과 권한', () {
    test('가입 신청자는 승인 전 회원 전용 기록을 볼 수 없고 승인 후 볼 수 있다', () async {
      final beginner = h.clubId('suseong-beginner');
      final applicant = await h.login('applicant');
      final before = await h.get('/clubs/$beginner/players', token: applicant);
      expect(before.status, 403);
      final dup = await h.post('/clubs/$beginner/join', {}, applicant);
      expect(dup.status, 409);
      expect(dup.json['code'], 'already_pending');

      final owner = await h.login('beginner_owner');
      final decision = await h.post('/clubs/$beginner/members/${h.membershipId('suseong-beginner', 'applicant')}/decision', {'action': 'approve'}, owner);
      expect(decision.status, 200);
      expect((await h.get('/clubs/$beginner/players', token: applicant)).status, 200);
    });

    test('한 계정이 A동호회 운영진, B동호회 일반 회원으로 각각 동작한다', () async {
      final token = await h.login('multi_manager');
      final night = h.clubId('daegu-night'), weekend = h.clubId('chilgok-weekend');
      final me = await h.get('/auth/me', token: token);
      final roles = {for (final m in me.json['memberships'] as List) m['clubName']: m['role']};
      expect(roles, {'대구 나이트 FC': 'manager', '칠곡 위켄드 FC': 'member'});

      expect((await h.get('/clubs/$night/members', token: token)).json['members'], anyElement(containsPair('status', 'pending')));
      expect((await h.get('/clubs/$night/link-requests', token: token)).status, 200);
      final weekendLinks = await h.get('/clubs/$weekend/link-requests', token: token);
      expect(weekendLinks.status, 403);
      final match = await h.call('POST', '/clubs/$weekend/matches', token: token, body: {
        'status': 'scheduled', 'matchDate': '2026-10-20', 'teamAName': 'A', 'teamBName': 'B',
      });
      expect(match.status, 403);
    });

    test('운영진은 운영진을 지정하거나 소유자를 바꿀 수 없다', () async {
      final night = h.clubId('daegu-night');
      final manager = await h.login('multi_manager');
      final member = h.membershipId('daegu-night', 'night_member');
      expect((await h.post('/clubs/$night/members/$member/role', {'role': 'manager'}, manager)).status, 403);
      expect((await h.post('/clubs/$night/members/$member/role', {'role': 'recorder'}, manager)).status, 200);
      expect((await h.post('/clubs/$night/members/${h.membershipId('daegu-night', 'night_owner')}/role', {'role': 'member'}, manager)).status, 403);
      expect((await h.post('/clubs/$night/members/${h.membershipId('daegu-night', 'multi_manager')}/role', {'role': 'member'}, manager)).status, 403);
      expect((await h.post('/clubs/$night/members/$member/role', {'role': 'owner'}, manager)).status, 400);
      expect((await h.post('/clubs/$night/transfer-ownership', {'membershipId': h.membershipId('daegu-night', 'multi_manager')}, manager)).status, 403);
    });

    test('일반 회원과 기록 담당자는 권한을 넘을 수 없다', () async {
      final night = h.clubId('daegu-night');
      final member = await h.login('night_member');
      final recorder = await h.login('night_recorder');
      final applicant = h.membershipId('daegu-night', 'applicant');
      for (final token in [member, recorder]) {
        expect((await h.post('/clubs/$night/members/$applicant/decision', {'action': 'approve'}, token)).status, 403);
        expect((await h.post('/clubs/$night/members/${h.membershipId('daegu-night', 'night_member')}/role', {'role': 'manager'}, token)).status, 403);
        expect((await h.call('PATCH', '/clubs/$night', token: token, body: {'name': '바꾼 이름'})).status, 403);
        expect((await h.post('/clubs/$night/players', {'name': '새 선수'}, token)).status, 403);
      }
      // A member cannot record matches; a recorder can, but cannot delete.
      final payload = {
        'status': 'completed', 'matchDate': '2026-10-12', 'teamAName': '블루', 'teamBName': '레드', 'teamAScore': 1, 'teamBScore': 0,
        'players': [{'playerId': h.playerId('daegu-night', 0), 'team': 'A'}, {'playerId': h.playerId('daegu-night', 1), 'team': 'B'}],
        'goals': [{'scorerId': h.playerId('daegu-night', 0), 'assistId': null}],
      };
      expect((await h.call('POST', '/clubs/$night/matches', token: member, body: payload)).status, 403);
      final created = await h.call('POST', '/clubs/$night/matches', token: recorder, body: payload);
      expect(created.status, 201);
      expect((await h.call('DELETE', '/clubs/$night/matches/${created.json['match']['id']}', token: recorder)).status, 403);
      // A member may edit only the profile linked to their own account.
      expect((await h.call('PATCH', '/clubs/$night/players/${h.playerId('daegu-night', 3)}', token: member, body: {'nickname': '새 별명'})).status, 200);
      expect((await h.call('PATCH', '/clubs/$night/players/${h.playerId('daegu-night', 4)}', token: member, body: {'nickname': '남의 별명'})).status, 403);
      expect((await h.call('PATCH', '/clubs/$night/players/${h.playerId('daegu-night', 3)}', token: member, body: {'number': 99})).status, 403);
    });

    test('소유자는 소유권 이전 후에만 탈퇴할 수 있다', () async {
      final night = h.clubId('daegu-night');
      final owner = await h.login('night_owner');
      expect((await h.post('/clubs/$night/leave', {}, owner)).json['code'], 'owner_must_transfer');
      expect((await h.post('/clubs/$night/transfer-ownership', {'membershipId': h.membershipId('daegu-night', 'multi_manager')}, owner)).status, 200);
      expect((await h.post('/clubs/$night/leave', {}, owner)).status, 200);
      final roles = h.db.all('SELECT role FROM memberships WHERE club_id = ? AND status = ? ', [night, 'approved']).map((r) => r['role']);
      expect(roles.where((r) => r == 'owner').length, 1);
    });

    test('탈퇴 후 재가입은 신청 상태로 시작하고, 이용 제한 회원은 재가입할 수 없다', () async {
      final night = h.clubId('daegu-night');
      final member = await h.login('night_member');
      final linked = h.playerId('daegu-night', 3);
      final appearancesBefore = h.db.scalar('SELECT COUNT(*) FROM match_players WHERE player_id = ?', [linked]);
      expect((await h.post('/clubs/$night/leave', {}, member)).status, 200);
      // Records stay, only the link is removed.
      expect(h.db.scalar('SELECT account_id FROM players WHERE id = ?', [linked]), isNull);
      expect(h.db.scalar('SELECT COUNT(*) FROM match_players WHERE player_id = ?', [linked]), appearancesBefore);
      expect((await h.get('/clubs/$night/members', token: member)).status, 403);
      final again = await h.post('/clubs/$night/join', {}, member);
      expect(again.json['membership']['status'], 'pending');
      expect(again.json['membership']['role'], 'member');

      final manager = await h.login('multi_manager');
      expect((await h.post('/clubs/$night/members/${h.membershipId('daegu-night', 'night_member')}/status', {'action': 'ban'}, manager)).status, 200);
      expect((await h.post('/clubs/$night/join', {}, member)).status, 403);
    });

    test('동호회 개설은 로그인이 필요하고 생성자가 소유자가 되며 기록은 기본 회원 전용', () async {
      expect((await h.post('/clubs', {'name': '새 동호회'})).status, 401);
      final newbie = await h.login('newbie');
      final r = await h.post('/clubs', {'name': '새 동호회'}, newbie);
      expect(r.status, 201);
      expect(r.json['club']['viewer']['role'], 'owner');
      expect(r.json['club']['recordsVisibility'], 'members');
      expect(r.json['club']['source'], 'user_created');
      expect((await h.get('/clubs/${r.json['club']['id']}/players')).status, 403);
    });

    test('비공개·검색 비노출 동호회는 비회원에게 존재 자체를 숨긴다', () async {
      final newbie = await h.login('newbie');
      final r = await h.post('/clubs', {'name': '비밀 동호회', 'visibility': 'private', 'discoverable': false}, newbie);
      final id = r.json['club']['id'];
      expect((await h.get('/clubs')).json['clubs'], isNot(anyElement(containsPair('id', id))));
      expect((await h.get('/clubs/$id')).status, 404);
      expect((await h.get('/clubs/$id/matches')).status, 404);
      expect((await h.get('/clubs/$id', token: await h.login('night_member'))).status, 404);
      expect((await h.get('/clubs/$id', token: newbie)).status, 200);
    });
  });

  group('초대 링크', () {
    test('초대 전용 동호회는 직접 신청이 막히고, 링크는 일반 회원 권한만 준다', () async {
      final weekend = h.clubId('chilgok-weekend');
      final newbie = await h.login('newbie');
      expect((await h.post('/clubs/$weekend/join', {}, newbie)).status, 403);
      final owner = await h.login('weekend_owner');
      final invite = await h.post('/clubs/$weekend/invites', {'days': 7, 'maxUses': 2}, owner);
      expect(invite.status, 201);
      final token = invite.json['token'] as String;
      final preview = await h.get('/invites/$token');
      expect(preview.json['valid'], isTrue);
      expect((await h.post('/invites/$token/accept', {})).status, 401); // login first
      final accepted = await h.post('/invites/$token/accept', {}, newbie);
      expect(accepted.status, 201);
      expect(accepted.json['membership'], containsPair('role', 'member'));
      expect(accepted.json['membership'], containsPair('status', 'approved'));
      expect((await h.post('/invites/$token/accept', {}, newbie)).status, 409);
    });

    test('폐기·만료된 초대 링크는 사용할 수 없다', () async {
      final weekend = h.clubId('chilgok-weekend');
      final owner = await h.login('weekend_owner');
      final newbie = await h.login('newbie');
      final a = await h.post('/clubs/$weekend/invites', {'days': 1}, owner);
      expect((await h.post('/clubs/$weekend/invites/${a.json['id']}/revoke', {}, owner)).status, 200);
      expect((await h.post('/invites/${a.json['token']}/accept', {}, newbie)).status, 410);
      final b = await h.post('/clubs/$weekend/invites', {'days': 1}, owner);
      h.clock = h.clock.add(const Duration(days: 2));
      expect((await h.post('/invites/${b.json['token']}/accept', {}, await h.login('newbie'))).status, 410);
      expect((await h.get('/invites/not-a-real-token-1234567')).status, 404);
    });
  });

  group('다른 동호회 데이터 격리', () {
    test('ID를 바꿔 다른 동호회 경기·선수·회원에 접근할 수 없다', () async {
      final night = h.clubId('daegu-night'), beginner = h.clubId('suseong-beginner');
      final beginnerMatch = h.db.scalar('SELECT id FROM matches WHERE club_id = ? LIMIT 1', [beginner]);
      final beginnerPlayer = h.playerId('suseong-beginner', 0);
      expect((await h.get('/clubs/$night/matches/$beginnerMatch')).status, 404);
      expect((await h.get('/clubs/$night/players/$beginnerPlayer')).status, 404);
      expect((await h.get('/clubs/$night/chemistry?playerId=$beginnerPlayer')).status, 404);
      final manager = await h.login('multi_manager');
      final foreignMembership = h.membershipId('suseong-beginner', 'applicant');
      expect((await h.post('/clubs/$night/members/$foreignMembership/decision', {'action': 'approve'}, manager)).status, 404);
      // A night recorder cannot record a beginner player in a night match.
      final r = await h.call('POST', '/clubs/$night/matches', token: manager, body: {
        'status': 'scheduled', 'matchDate': '2026-10-20', 'teamAName': 'A', 'teamBName': 'B',
        'players': [{'playerId': beginnerPlayer, 'team': 'A'}],
      });
      expect(r.status, 400);
      for (final id in ['0', '-1', '1abc', '99999999999']) {
        expect((await h.get('/clubs/$id')).status, 404);
      }
    });

    test('회원 전용 동호회의 이미지 파일은 비회원에게 제공되지 않는다', () async {
      final beginner = h.clubId('suseong-beginner');
      final owner = await h.login('beginner_owner');
      final png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0];
      final up = await h.call('POST', '/clubs/$beginner/players/${h.playerId('suseong-beginner', 0)}/photo',
          token: owner, bytes: png, contentType: 'image/png');
      expect(up.status, 200);
      final fileId = h.db.scalar('SELECT photo_file_id FROM players WHERE id = ?', [h.playerId('suseong-beginner', 0)]);
      expect((await h.get('/files/$fileId')).status, 404);
      expect((await h.get('/files/$fileId', token: await h.login('night_member'))).status, 200);
      expect((await h.get('/files/$fileId', token: await h.login('night_owner'))).status, 404);
      final bad = await h.call('POST', '/clubs/$beginner/players/${h.playerId('suseong-beginner', 0)}/photo',
          token: owner, bytes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], contentType: 'image/png');
      expect(bad.status, 400);
    });
  });

  group('기존 선수 연결', () {
    test('한 계정은 한 동호회에서 하나의 선수에만 연결되고 승인 후에만 연결된다', () async {
      final weekend = h.clubId('chilgok-weekend');
      final manager = await h.login('multi_manager');
      final owner = await h.login('weekend_owner');
      // Seed: pending request for player 2.
      expect((await h.post('/clubs/$weekend/players/${h.playerId('chilgok-weekend', 4)}/link-requests', {}, manager)).status, 409);
      expect(h.db.scalar('SELECT account_id FROM players WHERE id = ?', [h.playerId('chilgok-weekend', 2)]), isNull);
      final requests = await h.get('/clubs/$weekend/link-requests', token: owner);
      final id = (requests.json['requests'] as List).single['id'];
      expect((await h.post('/clubs/$weekend/link-requests/$id/decision', {'action': 'approve'}, owner)).status, 200);
      expect(h.db.scalar('SELECT account_id FROM players WHERE id = ?', [h.playerId('chilgok-weekend', 2)]), isNotNull);
      expect((await h.post('/clubs/$weekend/players/${h.playerId('chilgok-weekend', 4)}/link-requests', {}, manager)).status, 409);
      // Another account cannot claim an already linked player.
      final newbie = await h.login('newbie');
      final invite = await h.post('/clubs/$weekend/invites', {}, owner);
      await h.post('/invites/${invite.json['token']}/accept', {}, newbie);
      expect((await h.post('/clubs/$weekend/players/${h.playerId('chilgok-weekend', 2)}/link-requests', {}, newbie)).status, 409);
      // Database-level guard as well.
      expect(() => h.db.run('UPDATE players SET account_id = ? WHERE id = ?',
          [h.db.scalar("SELECT id FROM accounts WHERE provider_subject = 'multi_manager'"), h.playerId('chilgok-weekend', 5)]), throwsA(anything));
    });

    test('가입 신청 중인 계정은 선수 연결을 신청할 수 없다', () async {
      final night = h.clubId('daegu-night');
      final applicant = await h.login('applicant');
      expect((await h.post('/clubs/$night/players/${h.playerId('daegu-night', 5)}/link-requests', {}, applicant)).status, 403);
    });
  });
}
