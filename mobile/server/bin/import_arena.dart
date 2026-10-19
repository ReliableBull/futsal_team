import 'dart:convert';
import 'dart:io';

import 'package:arena_club_server/arena_club_server.dart';

/// Read-only import of ARENA FC public records into the app database.
///
///   dart run bin/import_arena.dart --source http://49.143.102.211:3932
///   dart run bin/import_arena.dart --from-snapshot data/imports/arena-snapshot.json
///   options: --with-card-art  --dry-run  --save-snapshot
Future<void> main(List<String> args) async {
  String? opt(String name) {
    final i = args.indexOf(name);
    return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
  }

  final config = Config.fromEnvironment();
  final backend = Backend(config, Db.open(config.dbPath));
  final sourceUrl = opt('--source') ?? Platform.environment['ARENA_SOURCE_URL'] ?? 'http://49.143.102.211:3932';
  final importer = ArenaImporter(backend, sourceUrl: sourceUrl, withCardArt: args.contains('--with-card-art'), log: stdout.writeln);
  Json? snapshot;
  final snapshotPath = opt('--from-snapshot');
  if (snapshotPath != null) {
    snapshot = jsonDecode(File(snapshotPath).readAsStringSync()) as Json;
  } else {
    stdout.writeln('ARENA 공개 API에서 읽기 전용으로 가져옵니다: $sourceUrl');
    snapshot = await importer.fetch();
    if (args.contains('--save-snapshot')) {
      final dir = Directory('data/imports')..createSync(recursive: true);
      final file = File('${dir.path}/arena-snapshot-${DateTime.now().toUtc().toIso8601String().replaceAll(':', '').substring(0, 15)}.json');
      file.writeAsStringSync(jsonEncode(snapshot));
      stdout.writeln('원본 스냅샷 저장: ${file.path}');
    }
  }
  final summary = await importer.run(snapshot: snapshot, dryRun: args.contains('--dry-run'));
  if (summary['dryRun'] == true) {
    stdout.writeln('dry-run: $summary');
  } else {
    await writeReport(summary, 'data/imports');
    final v = summary['verification'] as Json;
    stdout.writeln('가져오기 결과: ${summary['counts']}');
    stdout.writeln('충돌(덮어쓰지 않음): ${(summary['conflicts'] as List).length}건');
    stdout.writeln('원본 수량: ${v['source']}');
    stdout.writeln('앱 수량:   ${v['app']}');
    stdout.writeln('수량 불일치 항목: ${v['countMismatches']}');
    stdout.writeln('선수 통계 차이: ${(v['playerStatDifferences'] as List).length}명');
    for (final d in v['playerStatDifferences'] as List) {
      stdout.writeln('  - $d');
    }
    stdout.writeln('명예의 전당 차이: ${(v['hallOfFameDifferences'] as List).length}개 부문');
    for (final d in v['hallOfFameDifferences'] as List) {
      stdout.writeln('  - $d');
    }
    stdout.writeln('원본 데이터 이상: ${(v['sourceAnomalies'] as List).length}건');
    for (final d in v['sourceAnomalies'] as List) {
      stdout.writeln('  - $d');
    }
    stdout.writeln('누락 이미지: ${(summary['missingImages'] as List).length}건');
    stdout.writeln('보고서: data/imports/arena-import-*.json');
  }
  backend.db.close();
  importer.client.close();
}
