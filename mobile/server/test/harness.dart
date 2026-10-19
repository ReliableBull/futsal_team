import 'dart:convert';
import 'dart:io';

import 'package:arena_club_server/arena_club_server.dart';
import 'package:shelf/shelf.dart';

class Res {
  Res(this.status, this.body);
  final int status;
  final dynamic body;
  Json get json => body as Json;
  @override
  String toString() => 'Res($status, $body)';
}

/// In-process backend with an in-memory database and a movable clock.
class Harness {
  Harness({String env = 'test', DateTime? start}) {
    clock = start ?? DateTime.utc(2026, 10, 13, 3); // 12:00 in Seoul
    storage = Directory.systemTemp.createTempSync('club-test-');
    config = Config(env: env, dbPath: ':memory:', storageDir: storage.path, secret: 'test-secret-test-secret-test-secret!', smsMode: 'demo');
    backend = Backend(config, Db.open(':memory:'), clock: () => clock);
  }

  late DateTime clock;
  late Directory storage;
  late Config config;
  late Backend backend;
  Db get db => backend.db;

  Future<Res> call(String method, String path, {Object? body, String? token, String? guest, List<int>? bytes, String? contentType}) async {
    final headers = <String, String>{
      if (token != null) 'authorization': 'Bearer $token',
      'x-guest-token': ?guest,
      if (body != null) 'content-type': 'application/json',
      'content-type': ?contentType,
    };
    final response = await backend.handler(Request(method, Uri.parse('http://localhost$path'),
        headers: headers, body: bytes ?? (body == null ? null : jsonEncode(body))));
    final bytes0 = await response.read().expand((c) => c).toList();
    final text = utf8.decode(bytes0, allowMalformed: true);
    dynamic decoded;
    try {
      decoded = jsonDecode(text);
    } catch (_) {
      decoded = text;
    }
    return Res(response.statusCode, decoded);
  }

  Future<Res> get(String path, {String? token, String? guest}) => call('GET', path, token: token, guest: guest);
  Future<Res> post(String path, [Object? body, String? token, String? guest]) =>
      call('POST', path, body: body ?? {}, token: token, guest: guest);

  Future<String> login(String username) async {
    final r = await post('/auth/dev-login', {'username': username, 'password': demoPassword});
    if (r.status != 200) throw StateError('login failed $r');
    return r.json['token'] as String;
  }

  int clubId(String ref) => db.scalar("SELECT id FROM clubs WHERE source_ref = ?", [ref]) as int;
  int membershipId(String ref, String user) => db.scalar(
      'SELECT m.id FROM memberships m JOIN accounts a ON a.id = m.account_id WHERE m.club_id = ? AND a.provider_subject = ?',
      [clubId(ref), user]) as int;
  int playerId(String clubRef, int index) =>
      db.scalar('SELECT id FROM players WHERE club_id = ? AND source_ref = ?', [clubId(clubRef), '$clubRef:p$index']) as int;

  Future<String> verifiedGuest([String phone = '010-1234-5678']) async {
    final start = await post('/guest/verify/start', {'phone': phone});
    final confirm = await post('/guest/verify/confirm',
        {'verificationId': start.json['verificationId'], 'code': start.json['demoCode'], 'phone': phone});
    if (confirm.status != 200) throw StateError('verify failed $confirm');
    return confirm.json['guestToken'] as String;
  }

  void dispose() {
    backend.db.close();
    storage.deleteSync(recursive: true);
  }
}
