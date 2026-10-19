import 'dart:convert';

import 'backend.dart';
import 'db.dart';
import 'http.dart';
import 'security.dart';

const sessionDays = 14;

/// Signing in creates (or finds) an account only. It never creates a club
/// membership; joining a club is a separate, explicit request.
List<Route> authRoutes(Backend b) {
  final attempts = <String, List<DateTime>>{};

  void limit(String key) {
    final now = b.now();
    final list = attempts.putIfAbsent(key, () => [])
      ..removeWhere((t) => now.difference(t).inMinutes >= 15);
    if (list.length >= 10) {
      throw const ApiError(429, '로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요.');
    }
    list.add(now);
  }

  Json issueSession(Json account) {
    final token = randomToken();
    final expires = b.now().add(const Duration(days: sessionDays));
    b.db.tx(() {
      b.db.run('DELETE FROM sessions WHERE expires_at <= ?', [b.nowIso()]);
      b.db.insert('INSERT INTO sessions VALUES (?, ?, ?, ?)',
          [sha256Hex(token), account['id'], iso(expires), b.nowIso()]);
    });
    return {'token': token, 'expiresAt': iso(expires), 'account': b.publicAccount(account)};
  }

  return [
    // Development/test only: seeded demo accounts with passwords.
    Route('POST', '/auth/dev-login', (ctx) async {
      if (!b.config.devLoginEnabled) throw notFound('지원하지 않는 API입니다.');
      final body = await ctx.json();
      final username = body.str('username', max: 60);
      limit('dev:$username');
      final account = b.db.one(
          "SELECT * FROM accounts WHERE provider = 'dev' AND provider_subject = ?",
          [username]);
      final hash = account?['password_hash'] as String?;
      if (account == null || hash == null || !verifyPassword(body.str('password', max: 200), hash)) {
        throw const ApiError(401, '아이디 또는 비밀번호가 올바르지 않습니다.', 'bad_credentials');
      }
      if (account['status'] != 'active') throw forbidden('이용이 제한된 계정입니다.');
      return issueSession(account);
    }),

    // Kakao: the app obtains an access token with the Kakao SDK; the server
    // verifies it belongs to our Kakao app before trusting the user id.
    Route('POST', '/auth/kakao', (ctx) async {
      if (!b.config.kakaoEnabled) {
        throw const ApiError(503, '카카오 로그인이 서버에 아직 설정되지 않았습니다.', 'kakao_not_configured');
      }
      final token = (await ctx.json()).str('accessToken', max: 500);
      final headers = {'Authorization': 'Bearer $token'};
      final info = await b.httpClient
          .get(Uri.parse('https://kapi.kakao.com/v1/user/access_token_info'), headers: headers);
      if (info.statusCode != 200 ||
          '${(jsonDecode(info.body) as Map)['app_id']}' != b.config.kakaoAppId) {
        throw const ApiError(401, '카카오 인증을 확인하지 못했습니다.', 'bad_credentials');
      }
      final me = await b.httpClient
          .get(Uri.parse('https://kapi.kakao.com/v2/user/me'), headers: headers);
      if (me.statusCode != 200) throw const ApiError(401, '카카오 사용자 정보를 확인하지 못했습니다.');
      final profile = jsonDecode(me.body) as Map;
      final subject = '${profile['id']}';
      final nickname = ((profile['kakao_account'] as Map?)?['profile'] as Map?)?['nickname'] as String?;
      final account = b.db.tx(() {
        final existing = b.db.one(
            "SELECT * FROM accounts WHERE provider = 'kakao' AND provider_subject = ?", [subject]);
        if (existing != null) return existing;
        final id = b.db.insert(
            "INSERT INTO accounts (display_name, provider, provider_subject, created_at) VALUES (?, 'kakao', ?, ?)",
            [nickname ?? '카카오 사용자', subject, b.nowIso()]);
        return b.db.one('SELECT * FROM accounts WHERE id = ?', [id])!;
      });
      if (account['status'] != 'active') throw forbidden('이용이 제한된 계정입니다.');
      return issueSession(account);
    }),

    Route('GET', '/auth/me', (ctx) {
      final account = ctx.requireAccount();
      final memberships = b.db.all(
          'SELECT m.id, m.role, m.status, m.club_id, c.name, c.source, c.logo_file_id '
          'FROM memberships m JOIN clubs c ON c.id = m.club_id WHERE m.account_id = ? ORDER BY c.name',
          [account['id']]);
      return {
        'account': b.publicAccount(account),
        'memberships': [
          for (final m in memberships)
            {
              'membershipId': m['id'],
              'clubId': m['club_id'],
              'clubName': m['name'],
              'isDemo': m['source'] == 'demo',
              'logoUrl': b.fileUrl(m['logo_file_id']),
              'role': m['role'],
              'status': m['status'],
            }
        ],
      };
    }),

    Route('POST', '/auth/logout', (ctx) {
      ctx.requireAccount();
      b.db.run('DELETE FROM sessions WHERE token_hash = ?', [ctx.sessionHash]);
      return {'ok': true};
    }),
  ];
}
