import 'dart:convert';
import 'dart:io';

import 'package:sqlite3/sqlite3.dart';

import 'schema.dart';

typedef Json = Map<String, dynamic>;

/// Thin synchronous wrapper. All handlers run in one isolate, so a
/// transaction body without `await` cannot interleave with other requests.
class Db {
  Db._(this.raw);
  final Database raw;

  static Db open(String path) {
    if (path != ':memory:') {
      final dir = File(path).parent;
      if (!dir.existsSync()) dir.createSync(recursive: true);
    }
    final db = Db._(path == ':memory:' ? sqlite3.openInMemory() : sqlite3.open(path));
    db.raw.execute('PRAGMA foreign_keys = ON');
    db.raw.execute('PRAGMA busy_timeout = 5000');
    if (path != ':memory:') db.raw.execute('PRAGMA journal_mode = WAL');
    db.migrate();
    return db;
  }

  void migrate() {
    raw.execute('CREATE TABLE IF NOT EXISTS schema_migrations '
        '(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
    final done = raw
        .select('SELECT version FROM schema_migrations')
        .map((r) => r['version'] as int)
        .toSet();
    for (final entry in migrations.entries) {
      if (done.contains(entry.key)) continue;
      tx(() {
        raw.execute(entry.value);
        raw.execute('INSERT INTO schema_migrations VALUES (?, ?)',
            [entry.key, DateTime.now().toUtc().toIso8601String()]);
      });
    }
  }

  int get schemaVersion =>
      raw.select('SELECT MAX(version) v FROM schema_migrations').first['v'] as int;

  T tx<T>(T Function() body) {
    if (raw.autocommit == false) return body(); // nested: join outer tx
    raw.execute('BEGIN IMMEDIATE');
    try {
      final result = body();
      raw.execute('COMMIT');
      return result;
    } catch (_) {
      raw.execute('ROLLBACK');
      rethrow;
    }
  }

  List<Json> all(String sql, [List<Object?> params = const []]) => raw
      .select(sql, params)
      .map((row) => Map<String, dynamic>.from(row))
      .toList();

  Json? one(String sql, [List<Object?> params = const []]) {
    final rows = all(sql, params);
    return rows.isEmpty ? null : rows.first;
  }

  Object? scalar(String sql, [List<Object?> params = const []]) {
    final rows = raw.select(sql, params);
    return rows.isEmpty ? null : rows.first.values.first;
  }

  int insert(String sql, [List<Object?> params = const []]) {
    raw.execute(sql, params);
    return raw.lastInsertRowId;
  }

  int run(String sql, [List<Object?> params = const []]) {
    raw.execute(sql, params);
    return raw.updatedRows;
  }

  void close() => raw.close();
}

bool isUniqueViolation(Object error) =>
    error is SqliteException &&
    (error.extendedResultCode == 2067 || error.extendedResultCode == 1555);

bool isCrossClubViolation(Object error) =>
    error is SqliteException && error.message.contains('cross_club_reference');

String iso(DateTime value) => value.toUtc().toIso8601String();
String encodeJson(Object? value) => jsonEncode(value);
bool flag(Object? value) => value == 1 || value == true;
