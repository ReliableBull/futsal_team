import 'dart:io';

import 'package:arena_club_server/arena_club_server.dart';

/// Creates (or completes) the fictional demo clubs, venues and test accounts.
/// Safe to re-run: existing demo rows are kept, nothing is duplicated.
void main(List<String> args) {
  final config = Config.fromEnvironment();
  if (config.isProduction) {
    stderr.writeln('운영 환경(APP_ENV=production)에는 예시 데이터를 만들 수 없습니다.');
    exit(1);
  }
  final backend = Backend(config, Db.open(config.dbPath));
  final created = seedDemo(backend);
  stdout.writeln('예시 데이터 생성 완료: $created');
  stdout.writeln('테스트 계정 비밀번호: $demoPassword (개발·테스트 서버 전용)');
  for (final (user, name) in demoAccounts) {
    stdout.writeln('  $user  $name');
  }
  backend.db.close();
}
