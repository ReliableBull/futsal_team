import 'dart:io';

import 'package:arena_club_server/arena_club_server.dart';

/// Deletes demo-tagged data only (source = demo / is_demo = 1).
/// ARENA imports and user-created data are not touched.
void main(List<String> args) {
  final config = Config.fromEnvironment();
  if (!args.contains('--yes')) {
    stderr.writeln('예시 데이터(예시 동호회·예시 풋살장·예시 계정)만 삭제합니다. 실행하려면 --yes 를 붙여주세요.');
    exit(2);
  }
  final backend = Backend(config, Db.open(config.dbPath));
  stdout.writeln('예시 데이터 삭제: ${resetDemo(backend)}');
  if (args.contains('--reseed')) stdout.writeln('예시 데이터 재생성: ${seedDemo(backend)}');
  backend.db.close();
}
