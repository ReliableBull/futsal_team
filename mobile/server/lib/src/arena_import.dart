import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:http/http.dart' as http;

import 'backend.dart';
import 'db.dart';
import 'http.dart' show Period;
import 'stats.dart';
import 'routes_records.dart' show loadClubData;

/// One-way, read-only copy of ARENA FC's public records into this backend.
///
/// * Only HTTP GET against ARENA's public mobile API and public image paths.
///   Nothing is ever written to ARENA.
/// * Rows keep `source = 'arena_import'` and `source_ref = <ARENA id>`, so a
///   re-run updates instead of duplicating.
/// * Three-way merge per row: if the app copy was edited since the last
///   import and the source also changed, the row is NOT overwritten; a
///   conflict is recorded and reported instead.
class ArenaImporter {
  ArenaImporter(this.b, {required String sourceUrl, http.Client? client, this.withCardArt = false, this.log = print})
      : source = Uri.parse(sourceUrl.endsWith('/') ? sourceUrl.substring(0, sourceUrl.length - 1) : sourceUrl),
        client = client ?? http.Client();

  final Backend b;
  final Uri source;
  final http.Client client;
  final bool withCardArt;
  final void Function(String) log;

  static const clubRef = 'arena-fc';

  Future<Json> _get(String path) async {
    final res = await client.get(source.resolve('/api/v1/$path'), headers: {'Accept': 'application/json'});
    if (res.statusCode != 200) throw StateError('GET /api/v1/$path → ${res.statusCode}');
    return jsonDecode(utf8.decode(res.bodyBytes)) as Json;
  }

  Future<Uint8List?> _image(String url) async {
    if (url.startsWith('data:image/')) {
      final comma = url.indexOf(',');
      if (comma < 0 || !url.substring(0, comma).endsWith(';base64')) return null;
      return base64Decode(url.substring(comma + 1));
    }
    final uri = source.resolve(url);
    if (uri.host != source.host) return null; // never follow foreign hosts
    final res = await client.get(uri);
    if (res.statusCode != 200) return null;
    return Backend.sniffImage(res.bodyBytes) == null ? null : res.bodyBytes;
  }

  /// Fetches everything first so the database write is one transaction.
  Future<Json> fetch() async {
    final health = await _get('health');
    if (health['apiVersion'] != 1) throw StateError('ARENA 모바일 API 버전이 다릅니다.');
    final players = (await _get('players'))['players'] as List;
    final summaries = <Json>[];
    for (var page = 1;; page++) {
      final data = await _get('matches?page=$page&limit=100');
      summaries.addAll((data['matches'] as List).cast<Json>());
      if ((data['pagination'] as Map)['hasMore'] != true) break;
    }
    final matches = <Json>[];
    for (final m in summaries) {
      matches.add((await _get('matches/${m['id']}'))['match'] as Json);
    }
    final hall = (await _get('hall-of-fame'))['hallOfFame'] as Json;
    final cardArt = <String, Json>{};
    if (withCardArt) {
      for (final kind in ['player-portraits', 'player-cartoons']) {
        final res = await client.get(source.resolve('/images/$kind/20261005/manifest.json'));
        if (res.statusCode == 200) cardArt[kind] = jsonDecode(utf8.decode(res.bodyBytes)) as Json;
      }
    }
    return {
      'fetchedAt': b.nowIso(),
      'players': players,
      'matchCount': summaries.length,
      'matches': matches,
      'hallOfFame': hall,
      'cardArt': cardArt,
    };
  }

  Future<Json> run({Json? snapshot, bool dryRun = false}) async {
    final data = snapshot ?? await fetch();
    final db = b.db;
    final runId = dryRun
        ? 0
        : db.insert("INSERT INTO import_runs (source, source_url, started_at, status) VALUES ('arena', ?, ?, 'running')",
            [source.toString(), b.nowIso()]);

    // ---- collect every player visible in public data (active list + match rosters)
    final sourcePlayers = <int, Json>{};
    for (final p in (data['players'] as List).cast<Json>()) {
      sourcePlayers[p['id'] as int] = p;
    }
    final matches = (data['matches'] as List).cast<Json>();
    for (final m in matches) {
      for (final mp in (m['matchPlayers'] as List).cast<Json>()) {
        sourcePlayers.putIfAbsent(mp['playerId'] as int, () => mp['player'] as Json);
      }
    }

    // ---- download images before the transaction (skip ones already stored)
    final existingRefs = db.all("SELECT source_ref FROM files WHERE source = 'arena_import'").map((r) => r['source_ref']).toSet();
    final images = <String, Uint8List>{};
    final missingImages = <String>[];
    Future<void> want(String ref, String url) async {
      if (existingRefs.contains(ref) || images.containsKey(ref)) return;
      final bytes = await _image(url);
      if (bytes == null) {
        missingImages.add(url.startsWith('data:') ? 'data-uri($ref)' : url);
      } else {
        images[ref] = bytes;
      }
    }
    if (!dryRun) {
      for (final p in sourcePlayers.values) {
        final url = p['profileImageUrl'] as String?;
        await want('player:${p['id']}:profile', url == null || url.isEmpty ? '/images/players/${p['id']}.jpg' : url);
      }
      for (final m in matches) {
        for (final poster in (m['posters'] as List).cast<Json>()) {
          await want('poster:${poster['id']}', poster['imageUrl'] as String);
        }
      }
      for (final entry in Map<String, dynamic>.from(data['cardArt'] as Map? ?? const {}).entries) {
        for (final p in ((entry.value as Json)['players'] as List).cast<Json>()) {
          for (final pose in (p['poses'] as Map).entries) {
            await want('card:${entry.key}:${p['id']}:${pose.key}', pose.value as String);
          }
        }
      }
    }

    final conflicts = <Json>[];
    final counts = <String, int>{'playersCreated': 0, 'playersUpdated': 0, 'matchesCreated': 0, 'matchesUpdated': 0,
      'postersCreated': 0, 'imagesStored': 0, 'unchanged': 0};

    void body() {
      final now = b.nowIso();
      var clubId = db.scalar("SELECT id FROM clubs WHERE source = 'arena_import' AND source_ref = ?", [clubRef]) as int?;
      clubId ??= db.insert(
          'INSERT INTO clubs (slug, name, region, description, visibility, discoverable, records_visibility, join_policy, seasons_json, '
          "min_win_rate_matches, source, source_ref, created_at, updated_at) VALUES ('arena-fc', 'ARENA FC', NULL, ?, 'public', 1, 'public', "
          "'approval', ?, 3, 'arena_import', ?, ?, ?)",
          [
            'ARENA FC 웹사이트(${source.host})의 공개 경기 기록을 가져온 동호회입니다.',
            // ARENA's own season rule (1~5월 / 6~11월), stored as this club's
            // setting rather than as a global rule.
            jsonEncode([
              {'label': '2026 상반기', 'startDate': '2026-01-01', 'endDate': '2026-05-31'},
              {'label': '2026 하반기', 'startDate': '2026-06-01', 'endDate': '2026-11-30'},
            ]),
            clubRef, now, now,
          ]);

      String? storeImage(String ref, String kind) {
        final existing = db.scalar("SELECT id FROM files WHERE source = 'arena_import' AND source_ref = ?", [ref]) as String?;
        if (existing != null) return existing;
        final bytes = images[ref];
        if (bytes == null) return null;
        counts['imagesStored'] = counts['imagesStored']! + 1;
        return b.saveFile(bytes, clubId: clubId, kind: kind, source: 'arena_import', sourceRef: ref);
      }

      // ---- players
      final idByRef = <int, int>{};
      for (final p in sourcePlayers.values) {
        final ref = p['id'] as int;
        final snap = {'name': p['name'], 'nickname': p['nickname'], 'number': p['number'], 'position': p['position'], 'is_active': p['isActive'] == true ? 1 : 0};
        final row = db.one("SELECT * FROM players WHERE club_id = ? AND source = 'arena_import' AND source_ref = ?", [clubId, '$ref']);
        final photo = storeImage('player:$ref:profile', 'player_photo');
        if (row == null) {
          idByRef[ref] = db.insert(
              'INSERT INTO players (club_id, name, nickname, number, position, is_active, photo_file_id, source, source_ref, import_snapshot, created_at, updated_at) '
              "VALUES (?,?,?,?,?,?,?, 'arena_import', ?, ?, ?, ?)",
              [clubId, snap['name'], snap['nickname'], snap['number'], snap['position'], snap['is_active'], photo, '$ref', jsonEncode(snap), now, now]);
          counts['playersCreated'] = counts['playersCreated']! + 1;
        } else {
          idByRef[ref] = row['id'] as int;
          final previous = jsonDecode(row['import_snapshot'] as String? ?? '{}') as Map;
          final current = {for (final k in snap.keys) k: row[k]};
          if (jsonEncode(snap) == jsonEncode(previous)) {
            counts['unchanged'] = counts['unchanged']! + 1;
          } else if (jsonEncode(current) == jsonEncode(previous)) {
            db.run('UPDATE players SET name = ?, nickname = ?, number = ?, position = ?, is_active = ?, import_snapshot = ?, updated_at = ? WHERE id = ?',
                [snap['name'], snap['nickname'], snap['number'], snap['position'], snap['is_active'], jsonEncode(snap), now, row['id']]);
            counts['playersUpdated'] = counts['playersUpdated']! + 1;
          } else {
            conflicts.add({'entity': 'player', 'entityId': row['id'], 'sourceRef': '$ref', 'app': current, 'source': snap, 'lastImported': previous});
          }
          if (row['photo_file_id'] == null && photo != null) {
            db.run('UPDATE players SET photo_file_id = ? WHERE id = ?', [photo, row['id']]);
          }
        }
        for (final kind in Map<String, dynamic>.from(data['cardArt'] as Map? ?? const {}).keys) {
          for (final pose in ['arms-crossed', 'cheering']) {
            final file = storeImage('card:$kind:$ref:$pose', 'player_photo');
            if (file == null) continue;
            db.run('INSERT OR IGNORE INTO player_photos (club_id, player_id, file_id, label, fit, source_ref) VALUES (?,?,?,?,?,?)',
                [clubId, idByRef[ref], file, '${kind == 'player-cartoons' ? '카툰 ' : ''}${pose == 'cheering' ? '화이팅' : '팔짱'}', 'contain', 'card:$kind:$pose']);
          }
        }
      }

      // ---- matches (match + roster + goals form one unit for conflict checks)
      Json matchSnapshot(Json m) {
        final teamA = m['teamAName'];
        return {
          'match_date': (m['matchDate'] as String).substring(0, 10),
          'location': m['location'],
          'status': m['status'] == 'COMPLETED' ? 'completed' : (m['status'] == 'IN_PROGRESS' ? 'in_progress' : 'scheduled'),
          'team_a_name': m['teamAName'],
          'team_b_name': m['teamBName'],
          'team_a_score': m['teamAScore'],
          'team_b_score': m['teamBScore'],
          'memo': m['memo'],
          'players': ([for (final mp in (m['matchPlayers'] as List).cast<Json>())
            [mp['playerId'], mp['teamName'] == teamA ? 'A' : 'B', mp['goals'], mp['assists'], mp['isMvp'] == true ? 1 : 0]]
            ..sort((x, y) => (x[0] as int) - (y[0] as int))),
          'goals': ([for (final g in (m['goals'] as List).cast<Json>())
            [g['scorerId'], g['assisterId'], g['assistKnown'] == false ? 0 : 1, g['sequence']]]
            ..sort((x, y) => '${x[0]}-${x[3]}'.compareTo('${y[0]}-${y[3]}'))),
        };
      }

      Json currentSnapshot(int matchId) {
        final m = db.one('SELECT * FROM matches WHERE id = ?', [matchId])!;
        final refOf = {for (final p in db.all('SELECT id, source_ref FROM players WHERE club_id = ?', [clubId])) p['id']: int.tryParse('${p['source_ref']}') ?? -(p['id'] as int)};
        return {
          for (final k in ['match_date', 'location', 'status', 'team_a_name', 'team_b_name', 'team_a_score', 'team_b_score', 'memo']) k: m[k],
          'players': ([for (final r in db.all('SELECT * FROM match_players WHERE match_id = ?', [matchId]))
            [refOf[r['player_id']], r['team'], r['goals'], r['assists'], r['is_mom']]]..sort((x, y) => (x[0] as int) - (y[0] as int))),
          'goals': ([for (final g in db.all('SELECT * FROM match_goals WHERE match_id = ?', [matchId]))
            [refOf[g['scorer_player_id']], g['assist_player_id'] == null ? null : refOf[g['assist_player_id']], g['assist_known'], g['sequence']]]
            ..sort((x, y) => '${x[0]}-${x[3]}'.compareTo('${y[0]}-${y[3]}'))),
        };
      }

      void writeMatch(int matchId, Json snap) {
        db.run('DELETE FROM match_goals WHERE match_id = ?', [matchId]);
        db.run('DELETE FROM match_players WHERE match_id = ?', [matchId]);
        for (final p in snap['players'] as List) {
          db.insert('INSERT INTO match_players (club_id, match_id, player_id, team, goals, assists, is_mom) VALUES (?,?,?,?,?,?,?)',
              [clubId, matchId, idByRef[p[0]], p[1], p[2], p[3], p[4]]);
        }
        for (final g in snap['goals'] as List) {
          db.insert('INSERT INTO match_goals (club_id, match_id, scorer_player_id, assist_player_id, assist_known, sequence) VALUES (?,?,?,?,?,?)',
              [clubId, matchId, idByRef[g[0]], g[1] == null ? null : idByRef[g[1]], g[2], g[3]]);
        }
      }

      for (final m in matches) {
        final ref = '${m['id']}';
        final snap = matchSnapshot(m);
        final row = db.one("SELECT * FROM matches WHERE club_id = ? AND source = 'arena_import' AND source_ref = ?", [clubId, ref]);
        int matchId;
        if (row == null) {
          matchId = db.insert(
              'INSERT INTO matches (club_id, match_date, location, status, team_a_name, team_b_name, team_a_score, team_b_score, memo, '
              "source, source_ref, import_snapshot, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?, 'arena_import', ?, ?, ?, ?)",
              [clubId, snap['match_date'], snap['location'], snap['status'], snap['team_a_name'], snap['team_b_name'],
               snap['team_a_score'], snap['team_b_score'], snap['memo'], ref, jsonEncode(snap), now, now]);
          writeMatch(matchId, snap);
          counts['matchesCreated'] = counts['matchesCreated']! + 1;
        } else {
          matchId = row['id'] as int;
          final previous = row['import_snapshot'] as String? ?? '{}';
          if (jsonEncode(snap) == previous) {
            counts['unchanged'] = counts['unchanged']! + 1;
          } else if (jsonEncode(currentSnapshot(matchId)) == previous) {
            db.run('UPDATE matches SET match_date = ?, location = ?, status = ?, team_a_name = ?, team_b_name = ?, team_a_score = ?, '
                'team_b_score = ?, memo = ?, import_snapshot = ?, version = version + 1, updated_at = ? WHERE id = ?',
                [snap['match_date'], snap['location'], snap['status'], snap['team_a_name'], snap['team_b_name'],
                 snap['team_a_score'], snap['team_b_score'], snap['memo'], jsonEncode(snap), now, matchId]);
            writeMatch(matchId, snap);
            counts['matchesUpdated'] = counts['matchesUpdated']! + 1;
          } else {
            conflicts.add({'entity': 'match', 'entityId': matchId, 'sourceRef': ref,
              'note': '앱에서 수정된 경기이며 원본도 변경되어 덮어쓰지 않았습니다.', 'source': snap});
          }
        }
        for (final poster in (m['posters'] as List).cast<Json>()) {
          final file = storeImage('poster:${poster['id']}', 'poster');
          if (file == null) continue;
          final n = db.run('INSERT OR IGNORE INTO posters (club_id, match_id, file_id, source_ref, created_at) VALUES (?,?,?,?,?)',
              [clubId, matchId, file, 'poster:${poster['id']}', poster['createdAt'] ?? now]);
          counts['postersCreated'] = counts['postersCreated']! + n;
        }
      }
      db.run('UPDATE clubs SET imported_at = ?, updated_at = ? WHERE id = ?', [now, now, clubId]);
      if (!dryRun) {
        for (final c in conflicts) {
          db.insert('INSERT INTO import_conflicts (run_id, entity, entity_id, source_ref, detail_json) VALUES (?,?,?,?,?)',
              [runId, c['entity'], c['entityId'], c['sourceRef'], jsonEncode(c)]);
        }
      }
      if (dryRun) throw _DryRun();
    }

    try {
      db.tx(body);
    } on _DryRun {
      return {'dryRun': true, 'counts': counts, 'conflicts': conflicts.length};
    } catch (e) {
      db.run("UPDATE import_runs SET status = 'failed', finished_at = ?, summary_json = ? WHERE id = ?",
          [b.nowIso(), jsonEncode({'error': '$e'}), runId]);
      rethrow;
    }

    final verification = verify(data);
    final summary = {
      'runId': runId,
      'fetchedAt': data['fetchedAt'],
      'counts': counts,
      'conflicts': conflicts,
      'missingImages': missingImages,
      'verification': verification,
      'notAvailableFromPublicSource': [
        'MOM 투표 원본(투표자별 기록)은 관리자 전용이라 가져오지 않았습니다. 경기별 MOM 결과는 가져왔습니다.',
        '관리자 계정·비밀번호·세션은 가져오지 않았습니다. 앱의 운영 권한은 확인된 계정에만 별도로 부여해야 합니다.',
        '어떤 경기에도 출전하지 않은 비활성 선수는 공개 API에 노출되지 않아 가져오지 못했습니다.',
        '선수-계정 연결 정보는 원본에 없으므로 모든 선수는 계정 미연결 상태입니다.',
        '동호회 활동 지역은 원본에 등록된 값이 없어 비워 두었습니다.',
        if (!withCardArt) '선수 카드용 포즈/카툰 이미지(약 150MB)는 --with-card-art 옵션을 사용할 때만 가져옵니다.',
      ],
    };
    db.run("UPDATE import_runs SET status = 'completed', finished_at = ?, summary_json = ? WHERE id = ?",
        [b.nowIso(), jsonEncode(summary), runId]);
    return summary;
  }

  /// Compares source numbers with what the app computes from the imported
  /// rows. Differences are reported, never "fixed" by editing numbers.
  Json verify(Json data) {
    final db = b.db;
    final clubId = db.scalar("SELECT id FROM clubs WHERE source = 'arena_import' AND source_ref = ?", [clubRef]) as int;
    final matches = (data['matches'] as List).cast<Json>();
    final sourceGoalRows = matches.fold<int>(0, (s, m) => s + (m['goals'] as List).length);
    final lines = [for (final m in matches) ...(m['matchPlayers'] as List).cast<Json>()];
    final dates = matches.map((m) => (m['matchDate'] as String).substring(0, 10)).toList()..sort();
    final appDates = db.one('SELECT MIN(match_date) min, MAX(match_date) max FROM matches WHERE club_id = ?', [clubId])!;

    final source = {
      'activePlayersListed': (data['players'] as List).length,
      'playersInMatches': lines.map((l) => l['playerId']).toSet().length,
      'matches': data['matchCount'],
      'completedMatches': matches.where((m) => m['status'] == 'COMPLETED').length,
      'dateRange': dates.isEmpty ? null : [dates.first, dates.last],
      'appearances': lines.length,
      'goals': lines.fold<int>(0, (s, l) => s + (l['goals'] as int)),
      'assists': lines.fold<int>(0, (s, l) => s + (l['assists'] as int)),
      'mom': lines.where((l) => l['isMvp'] == true).length,
      'goalRows': sourceGoalRows,
      'goalRowsWithUnknownAssist': matches.fold<int>(0, (s, m) => s + (m['goals'] as List).where((g) => (g as Map)['assistKnown'] == false).length),
      'posters': matches.fold<int>(0, (s, m) => s + (m['posters'] as List).length),
    };
    int count(String sql) => db.scalar(sql, [clubId]) as int;
    final app = {
      'players': count('SELECT COUNT(*) FROM players WHERE club_id = ?'),
      'activePlayers': count('SELECT COUNT(*) FROM players WHERE club_id = ? AND is_active = 1'),
      'matches': count('SELECT COUNT(*) FROM matches WHERE club_id = ?'),
      'completedMatches': count("SELECT COUNT(*) FROM matches WHERE club_id = ? AND status = 'completed'"),
      'dateRange': [appDates['min'], appDates['max']],
      'appearances': count('SELECT COUNT(*) FROM match_players WHERE club_id = ?'),
      'goals': count('SELECT IFNULL(SUM(goals),0) FROM match_players WHERE club_id = ?'),
      'assists': count('SELECT IFNULL(SUM(assists),0) FROM match_players WHERE club_id = ?'),
      'mom': count('SELECT COUNT(*) FROM match_players WHERE club_id = ? AND is_mom = 1'),
      'goalRows': count('SELECT COUNT(*) FROM match_goals WHERE club_id = ?'),
      'goalRowsWithUnknownAssist': count('SELECT COUNT(*) FROM match_goals WHERE club_id = ? AND assist_known = 0'),
      'posters': count('SELECT COUNT(*) FROM posters WHERE club_id = ?'),
    };

    // Source data anomalies (reported as-is).
    final anomalies = <Json>[];
    for (final m in matches) {
      final mps = (m['matchPlayers'] as List).cast<Json>();
      for (final (team, score) in [(m['teamAName'], m['teamAScore'] as int), (m['teamBName'], m['teamBScore'] as int)]) {
        final sum = mps.where((p) => p['teamName'] == team).fold<int>(0, (s, p) => s + (p['goals'] as int));
        if (sum > score) {
          anomalies.add({'matchRef': m['id'], 'date': (m['matchDate'] as String).substring(0, 10),
            'issue': '$team 선수 득점 합계($sum)가 팀 점수($score)보다 큽니다.'});
        }
      }
      for (final p in mps) {
        final rows = (m['goals'] as List).where((g) => (g as Map)['scorerId'] == p['playerId']).length;
        if (rows != p['goals']) {
          anomalies.add({'matchRef': m['id'], 'playerRef': p['playerId'], 'issue': '골별 기록 $rows건 ≠ 선수 득점 ${p['goals']}'});
        }
      }
    }

    // Per-player totals: source /players (active players, all completed
    // matches) vs app aggregation with the shared rules.
    final data2 = loadClubData(b, clubId);
    final aggregates = aggregatePlayers(data2.players.values.toList(), data2.matches, const Period(null, null));
    final refOf = {for (final p in db.all('SELECT id, source_ref FROM players WHERE club_id = ?', [clubId])) p['id']: p['source_ref']};
    final byRef = {for (final a in aggregates) refOf[a.player.id]: a};
    final playerDiffs = <Json>[];
    const fields = {
      'totalMatches': 'matches', 'wins': 'wins', 'losses': 'losses', 'draws': 'draws', 'goals': 'goals',
      'assists': 'assists', 'mvpCount': 'mom', 'winRate': 'winRate',
      'currentWinStreak': 'currentWinStreak', 'currentGoalStreak': 'currentGoalStreak', 'currentAssistStreak': 'currentAssistStreak',
    };
    for (final p in (data['players'] as List).cast<Json>()) {
      final a = byRef['${p['id']}']?.summary();
      if (a == null) continue;
      final diff = <String, dynamic>{};
      fields.forEach((s, appKey) {
        if ((p[s] as num?)?.toDouble() != (a[appKey] as num?)?.toDouble()) diff[s] = {'source': p[s], 'app': a[appKey]};
      });
      if (diff.isNotEmpty) playerDiffs.add({'playerRef': p['id'], 'name': p['name'], 'diff': diff});
    }

    // Hall of fame comparison (source ranks active players only; so does the app).
    final appHall = hallOfFame(aggregates, countedMatches(data2.matches, const Period(null, null)).length);
    final hallDiffs = <Json>[];
    final sourceCats = {for (final c in ((data['hallOfFame'] as Json)['categories'] as List).cast<Json>()) c['key']: c};
    for (final c in (appHall['categories'] as List).cast<Json>()) {
      final s = sourceCats[c['key']];
      if (s == null) continue;
      String key(Iterable<Json> entries, String id, String value) =>
          (entries.map((e) => '${e[id]}:${e[value]}').toList()..sort()).join(',');
      final appKey = key((c['entries'] as List).cast<Json>().map((e) => {'id': refOf[(e['player'] as Json)['id']], 'v': e['value']}), 'id', 'v');
      final srcKey = key((s['entries'] as List).cast<Json>(), 'playerId', 'value');
      if (appKey != srcKey) hallDiffs.add({'category': c['key'], 'source': srcKey, 'app': appKey});
    }

    final countMismatches = <String>[
      if (source['matches'] != app['matches']) 'matches',
      if (source['completedMatches'] != app['completedMatches']) 'completedMatches',
      if (source['appearances'] != app['appearances']) 'appearances',
      if (source['goals'] != app['goals']) 'goals',
      if (source['assists'] != app['assists']) 'assists',
      if (source['mom'] != app['mom']) 'mom',
      if (source['goalRows'] != app['goalRows']) 'goalRows',
      if (source['playersInMatches'] != count('SELECT COUNT(DISTINCT player_id) FROM match_players WHERE club_id = ?')) 'playersInMatches',
    ];
    return {
      'source': source,
      'app': app,
      'countMismatches': countMismatches,
      'playerStatDifferences': playerDiffs,
      'hallOfFameDifferences': hallDiffs,
      'sourceAnomalies': anomalies,
    };
  }
}

class _DryRun implements Exception {}

Future<void> writeReport(Json summary, String dir) async {
  final d = Directory(dir)..createSync(recursive: true);
  final stamp = DateTime.now().toUtc().toIso8601String().replaceAll(':', '').substring(0, 15);
  await File('${d.path}/arena-import-$stamp.json').writeAsString(const JsonEncoder.withIndent('  ').convert(summary));
}
