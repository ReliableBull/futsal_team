import 'dart:io';

import 'package:arena_club_server/arena_club_server.dart';
import 'package:shelf/shelf_io.dart' as io;

Future<void> main() async {
  final config = Config.fromEnvironment();
  final db = Db.open(config.dbPath);
  final backend = Backend(config, db);
  ensureDemoInventory(backend);
  final server = await io.serve(backend.handler, config.host, config.port);
  stdout.writeln('[club-api] ${config.env} · http://${server.address.host}:${server.port} · db ${config.dbPath} (schema v${db.schemaVersion})');
  if (!config.isProduction) {
    stdout.writeln('[club-api] 개발 모드: 테스트 계정 로그인과 데모 인증번호가 활성화되어 있습니다.');
  }
  ProcessSignal.sigint.watch().listen((_) async {
    await server.close();
    db.close();
    exit(0);
  });
}
