import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:http/http.dart' as http;
import 'package:shelf/shelf.dart' hide Handler;
import 'package:sqlite3/sqlite3.dart' show SqliteException;

import 'config.dart';
import 'db.dart';
import 'http.dart';
import 'routes_auth.dart';
import 'routes_clubs.dart';
import 'routes_records.dart';
import 'routes_venues.dart';
import 'security.dart';

const roleRank = {'member': 1, 'recorder': 2, 'manager': 3, 'owner': 4};
const roleLabels = {
  'owner': '소유자',
  'manager': '운영진',
  'recorder': '기록 담당자',
  'member': '일반 회원',
};

/// Membership of the current viewer in one club. Only `approved` memberships
/// carry any authority; pending/rejected/left/banned rows are informational.
class Viewer {
  Viewer(this.account, this.membership);
  final Json? account;
  final Json? membership;
  bool get loggedIn => account != null;
  String? get status => membership?['status'] as String?;
  bool get approved => status == 'approved' && account?['status'] == 'active';
  String? get role => approved ? membership!['role'] as String : null;
  int get rank => role == null ? 0 : roleRank[role]!;
  bool atLeast(String role) => rank >= roleRank[role]!;
}

class Backend {
  Backend(this.config, this.db, {DateTime Function()? clock, http.Client? httpClient})
      : now = clock ?? DateTime.now,
        httpClient = httpClient ?? http.Client() {
    routes = [
      Route('GET', '/health', (_) => {
            'status': 'ok',
            'apiVersion': 1,
            'service': 'arena-club-api',
            'env': config.env,
            'features': {
              'devLogin': config.devLoginEnabled,
              'kakaoLogin': config.kakaoEnabled,
              'phoneVerification': config.demoSmsEnabled ? 'demo' : 'disabled',
            },
          }),
      ...authRoutes(this),
      ...clubRoutes(this),
      ...recordRoutes(this),
      ...venueRoutes(this),
      Route('GET', '/files/:id', serveFile),
    ];
  }

  final Config config;
  final Db db;
  final DateTime Function() now;
  final http.Client httpClient;
  late final List<Route> routes;

  String nowIso() => iso(now());

  Future<Response> Function(Request) get handler => _handle;

  Future<Response> _handle(Request request) async {
    final path = request.url.pathSegments.where((s) => s.isNotEmpty).toList();
    // Accept both /x and /api/v1/x so a reverse proxy can mount either way.
    final segments = path.length >= 2 && path[0] == 'api' && path[1] == 'v1'
        ? path.sublist(2)
        : path;
    try {
      Route? matched;
      Map<String, String>? params;
      var methodMismatch = false;
      for (final route in routes) {
        final p = route.match(segments);
        if (p == null) continue;
        if (route.method != request.method) {
          methodMismatch = true;
          continue;
        }
        matched = route;
        params = p;
        break;
      }
      if (matched == null) {
        final page = methodMismatch ? null : _staticFile(request, segments);
        if (page != null) return page;
        throw methodMismatch
            ? const ApiError(405, '지원하지 않는 요청 방식입니다.')
            : notFound('지원하지 않는 API입니다.');
      }
      final ctx = Ctx(request, params!);
      _resolveSession(ctx);
      final result = await matched.handler(ctx);
      if (result is Response) return result;
      if (result is Created) return jsonResponse(result.data, 201);
      return jsonResponse(result);
    } on ApiError catch (e) {
      return jsonResponse({'error': e.message, 'code': e.code}, e.status);
    } on SqliteException catch (e) {
      if (isUniqueViolation(e)) {
        return jsonResponse({'error': '이미 처리된 요청이거나 중복된 데이터입니다.', 'code': 'duplicate'}, 409);
      }
      if (isCrossClubViolation(e)) {
        return jsonResponse({'error': '다른 동호회의 데이터는 사용할 수 없습니다.', 'code': 'cross_club'}, 400);
      }
      stderr.writeln('[club-api] database error ${e.extendedResultCode}');
      return jsonResponse({'error': '서버에서 요청을 처리하지 못했습니다.'}, 500);
    } catch (e, st) {
      stderr.writeln('[club-api] unexpected ${e.runtimeType}: $e\n$st');
      return jsonResponse({'error': '서버에서 요청을 처리하지 못했습니다.'}, 500);
    }
  }

  // ------------------------------------------------------------ web build

  static const _mime = {
    'html': 'text/html; charset=utf-8', 'js': 'text/javascript; charset=utf-8', 'mjs': 'text/javascript; charset=utf-8',
    'json': 'application/json; charset=utf-8', 'css': 'text/css; charset=utf-8', 'wasm': 'application/wasm',
    'png': 'image/png', 'jpg': 'image/jpeg', 'ico': 'image/x-icon', 'svg': 'image/svg+xml',
    'otf': 'font/otf', 'ttf': 'font/ttf', 'woff': 'font/woff', 'woff2': 'font/woff2', 'bin': 'application/octet-stream',
    'frag': 'application/octet-stream', 'symbols': 'application/octet-stream',
  };

  /// Serves the Flutter web build (same origin as the API, so no CORS).
  /// Only files inside [Config.webRoot]; anything else is a normal 404.
  Response? _staticFile(Request request, List<String> segments) {
    if (config.webRoot.isEmpty || (request.method != 'GET' && request.method != 'HEAD')) return null;
    if (segments.any((s) => s == '..' || s == '.' || s.contains('\\') || s.startsWith('.'))) return null;
    final root = Directory(config.webRoot).absolute.path;
    final file = File([root, ...(segments.isEmpty ? ['index.html'] : segments)].join('/'));
    if (!file.absolute.path.startsWith('$root/') || !file.existsSync()) return null;
    final name = file.path.split('/').last;
    final ext = name.contains('.') ? name.split('.').last : '';
    return Response.ok(request.method == 'HEAD' ? null : file.readAsBytesSync(), headers: {
      'Content-Type': _mime[ext] ?? 'application/octet-stream',
      'Cache-Control': name == 'index.html' || name == 'flutter_service_worker.js' || name == 'flutter_bootstrap.js'
          ? 'no-cache'
          : 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    });
  }

  // ---------------------------------------------------------------- sessions

  /// Invalid or expired tokens make the request anonymous. Public endpoints
  /// keep working; member endpoints answer 401 through [Ctx.requireAccount].
  void _resolveSession(Ctx ctx) {
    final auth = ctx.header('authorization') ?? '';
    if (!auth.startsWith('Bearer ')) return;
    final hash = sha256Hex(auth.substring(7).trim());
    final row = db.one(
        'SELECT a.* FROM sessions s JOIN accounts a ON a.id = s.account_id '
        'WHERE s.token_hash = ? AND s.expires_at > ?',
        [hash, nowIso()]);
    if (row == null || row['status'] != 'active') return;
    row.remove('password_hash');
    ctx.account = row;
    ctx.sessionHash = hash;
  }

  Json publicAccount(Json a) =>
      {'id': a['id'], 'displayName': a['display_name'], 'provider': a['provider']};

  // ------------------------------------------------------------------ policy

  Json loadClub(int id) => db.one('SELECT * FROM clubs WHERE id = ?', [id]) ?? (throw notFound('동호회를 찾을 수 없습니다.'));

  Viewer viewer(Ctx ctx, Json club) {
    final account = ctx.account;
    if (account == null) return Viewer(null, null);
    return Viewer(
        account,
        db.one('SELECT * FROM memberships WHERE club_id = ? AND account_id = ?',
            [club['id'], account['id']]));
  }

  /// Introduction visibility. Private, non-discoverable clubs are hidden
  /// (404) from everyone who has no membership row.
  bool canSeeClub(Json club, Viewer v) =>
      club['visibility'] == 'public' ||
      flag(club['discoverable']) ||
      (v.membership != null && v.status != 'banned' && v.status != 'rejected') ||
      v.approved;

  bool canSeeRecords(Json club, Viewer v) =>
      v.approved ||
      (club['visibility'] == 'public' && club['records_visibility'] == 'public');

  ({Json club, Viewer viewer}) clubFor(Ctx ctx, {bool records = false, String? role}) {
    final club = loadClub(ctx.intParam('clubId'));
    final v = viewer(ctx, club);
    if (!canSeeClub(club, v)) throw notFound('동호회를 찾을 수 없습니다.');
    if (role != null) {
      ctx.requireAccount();
      if (!v.atLeast(role)) {
        throw forbidden(v.approved
            ? '${roleLabels[role]} 이상 권한이 필요합니다.'
            : '승인된 회원만 이용할 수 있습니다.');
      }
    }
    if (records && !canSeeRecords(club, v)) {
      throw ApiError(403, '회원 전용 기록입니다. 가입 승인 후 볼 수 있습니다.', 'members_only');
    }
    return (club: club, viewer: v);
  }

  Json permissions(Json club, Viewer v) => {
        'viewRecords': canSeeRecords(club, v),
        'recordMatches': v.atLeast('recorder'),
        'deleteMatches': v.atLeast('manager'),
        'managePlayers': v.atLeast('manager'),
        'manageMembers': v.atLeast('manager'),
        'editClub': v.atLeast('manager'),
        'assignManagers': v.atLeast('owner'),
        'transferOwnership': v.atLeast('owner'),
      };

  String? fileUrl(Object? fileId) => fileId == null ? null : '/files/$fileId';

  Json clubJson(Json club, [Viewer? v]) {
    final members = db.scalar(
        "SELECT COUNT(*) FROM memberships WHERE club_id = ? AND status = 'approved'",
        [club['id']]) as int;
    final out = <String, dynamic>{
      'id': club['id'],
      'slug': club['slug'],
      'name': club['name'],
      'region': club['region'],
      'description': club['description'],
      'activityNote': club['activity_note'],
      'logoUrl': fileUrl(club['logo_file_id']),
      'visibility': club['visibility'],
      'discoverable': flag(club['discoverable']),
      'recordsVisibility': club['records_visibility'],
      'joinPolicy': club['join_policy'],
      'seasons': jsonDecode(club['seasons_json'] as String),
      'minWinRateMatches': club['min_win_rate_matches'],
      'source': club['source'],
      'isDemo': club['source'] == 'demo',
      'importedAt': club['imported_at'],
      'memberCount': members,
      'hasOwner': db.scalar(
              "SELECT COUNT(*) FROM memberships WHERE club_id = ? AND role = 'owner' AND status = 'approved'",
              [club['id']]) ==
          1,
    };
    if (v != null) {
      out['viewer'] = {
        'loggedIn': v.loggedIn,
        'membershipId': v.membership?['id'],
        'status': v.status,
        'role': v.role,
        'requestedRole': v.membership?['role'],
        'permissions': permissions(club, v),
        'linkedPlayerId': v.loggedIn
            ? db.scalar('SELECT id FROM players WHERE club_id = ? AND account_id = ?',
                [club['id'], v.account!['id']])
            : null,
        'pendingLinkPlayerId': v.loggedIn
            ? db.scalar(
                "SELECT player_id FROM player_links WHERE club_id = ? AND account_id = ? AND status = 'pending'",
                [club['id'], v.account!['id']])
            : null,
      };
    }
    return out;
  }

  void audit(int? clubId, int? actor, String action, String targetType,
      Object? targetId, [Object? detail]) {
    db.insert(
        'INSERT INTO audit_logs (club_id, actor_account_id, action, target_type, target_id, detail_json, created_at) '
        'VALUES (?, ?, ?, ?, ?, ?, ?)',
        [clubId, actor, action, targetType, targetId?.toString(),
         detail == null ? null : jsonEncode(detail), nowIso()]);
  }

  // ------------------------------------------------------------------- files

  static String? sniffImage(Uint8List b) {
    if (b.length > 3 && b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF) return 'image/jpeg';
    if (b.length > 8 && b[0] == 0x89 && b[1] == 0x50 && b[2] == 0x4E && b[3] == 0x47) return 'image/png';
    if (b.length > 12 &&
        ascii.decode(b.sublist(0, 4), allowInvalid: true) == 'RIFF' &&
        ascii.decode(b.sublist(8, 12), allowInvalid: true) == 'WEBP') {
      return 'image/webp';
    }
    return null;
  }

  /// Stores validated image bytes. File names are random; the database row
  /// carries the owning club so that serving can apply the club's policy.
  String saveFile(Uint8List bytes, {required int? clubId, required String kind,
      String source = 'user_created', String? sourceRef}) {
    final mime = sniffImage(bytes);
    if (mime == null) throw badRequest('JPG, PNG, WebP 이미지만 올릴 수 있습니다.');
    if (bytes.length > 10 * 1024 * 1024) throw const ApiError(413, '10MB 이하 이미지만 올릴 수 있습니다.');
    final id = randomToken(18);
    final rel = '${clubId ?? 'shared'}/$kind/$id';
    final file = File('${config.storageDir}/$rel');
    file.parent.createSync(recursive: true);
    file.writeAsBytesSync(bytes, flush: true);
    db.insert(
        'INSERT INTO files (id, club_id, kind, mime, path, size, source, source_ref, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
        [id, clubId, kind, mime, rel, bytes.length, source, sourceRef, nowIso()]);
    return id;
  }

  Future<Uint8List> readImageUpload(Ctx ctx) async {
    final type = ctx.header('content-type') ?? '';
    if (!type.startsWith('image/')) throw const ApiError(415, '이미지 파일을 전송해주세요.');
    return ctx.readBytes(10 * 1024 * 1024);
  }

  FutureOr<Object?> serveFile(Ctx ctx) {
    final id = ctx.params['id']!;
    if (!RegExp(r'^[A-Za-z0-9_-]{10,64}$').hasMatch(id)) throw notFound();
    final row = db.one('SELECT * FROM files WHERE id = ?', [id]) ?? (throw notFound());
    final club = row['club_id'] == null ? null : loadClub(row['club_id'] as int);
    if (club != null) {
      final v = viewer(ctx, club);
      final allowed = row['kind'] == 'club_logo' ? canSeeClub(club, v) : canSeeClub(club, v) && canSeeRecords(club, v);
      if (!allowed) throw notFound();
    }
    final file = File('${config.storageDir}/${row['path']}');
    if (!file.existsSync()) throw notFound();
    return Response.ok(file.readAsBytesSync(), headers: {
      'Content-Type': row['mime'] as String,
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    });
  }
}
