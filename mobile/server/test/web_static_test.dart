import 'dart:io';

import 'package:arena_club_server/arena_club_server.dart';
import 'package:test/test.dart';

import 'harness.dart';

void main() {
  late Harness h;
  late Directory web;
  setUp(() {
    h = Harness();
    web = Directory.systemTemp.createTempSync('club-web-');
    File('${web.path}/index.html').writeAsStringSync('<html>app</html>');
    Directory('${web.path}/assets').createSync();
    File('${web.path}/assets/a.js').writeAsStringSync('x');
    File('${h.storage.path}/secret.txt').writeAsStringSync('secret');
    h.backend = Backend(
        Config(env: 'test', dbPath: ':memory:', storageDir: h.storage.path, secret: h.config.secret, smsMode: 'demo', webRoot: web.path),
        h.db);
  });
  tearDown(() {
    web.deleteSync(recursive: true);
    h.dispose();
  });

  test('웹 빌드는 같은 주소에서 제공되고 API가 우선한다', () async {
    final index = await h.get('/');
    expect(index.status, 200);
    expect(index.body, '<html>app</html>');
    expect((await h.get('/assets/a.js')).status, 200);
    expect((await h.get('/health')).json['service'], 'arena-club-api');
    expect((await h.get('/clubs')).json.containsKey('clubs'), isTrue);
    expect((await h.get('/missing.js')).status, 404);
  });

  test('웹 루트 밖의 파일은 제공하지 않는다', () async {
    for (final path in ['/../secret.txt', '/%2e%2e/secret.txt', '/assets/%2e%2e/%2e%2e/secret.txt', '/.dart_tool/x']) {
      expect((await h.get(path)).status, 404, reason: path);
    }
  });
}
