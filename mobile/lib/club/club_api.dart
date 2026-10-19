import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

import '../core/api.dart' show Json, rows, validateServer;

export '../core/api.dart' show Json, rows, day;

class ClubApiException implements Exception {
  const ClubApiException(this.message, [this.status, this.code]);
  final String message;
  final int? status;
  final String? code;
  bool get membersOnly => code == 'members_only';
  bool get network => status == null;
  @override
  String toString() => message;
}

/// Client for the club/booking backend (mobile/server), which is separate
/// from the ARENA website API used by the legacy screens.
///
/// * Nothing requires login by default; the session token is attached when
///   present and dropped when the server reports it as expired.
/// * The guest token proves a verified phone number for non-member bookings
///   and is stored in secure storage, so bookings survive app restarts and
///   can be found again on another device after re-verification.
class ClubApi extends ChangeNotifier {
  ClubApi({http.Client? client, FlutterSecureStorage? storage})
      : _client = client ?? http.Client(),
        _storage = storage ?? const FlutterSecureStorage();

  final http.Client _client;
  final FlutterSecureStorage _storage;
  static const configuredServer = String.fromEnvironment('CLUB_API_BASE_URL');

  Uri? server;
  String? _token;
  Json? account;
  List<Json> memberships = [];
  Json features = {};
  String? guestToken;
  String? guestPhone;
  DateTime? guestExpires;
  String? pendingInvite;
  int? selectedClubId;

  bool get loggedIn => _token != null && account != null;
  bool get hasGuest => guestToken != null && (guestExpires?.isAfter(DateTime.now()) ?? false);
  bool get devLoginAvailable => !kReleaseMode && features['devLogin'] == true;
  bool get kakaoAvailable => features['kakaoLogin'] == true;
  List<Json> get approvedMemberships => memberships.where((m) => m['status'] == 'approved').toList();

  /// Persists a value; null deletes. Storage can be unavailable (e.g. a web
  /// page on plain-HTTP LAN addresses has no WebCrypto). The app then keeps
  /// working with in-memory state for this session.
  Future<void> _put(String key, String? value) async {
    try {
      if (value == null) {
        await _storage.delete(key: key);
      } else {
        await _storage.write(key: key, value: value);
      }
    } catch (_) {}
  }

  static Uri defaultServer() {
    if (configuredServer.isNotEmpty) return validateServer(configuredServer);
    // Web build is served by the club server itself: use the page's origin.
    if (kIsWeb) return Uri(scheme: Uri.base.scheme, host: Uri.base.host, port: Uri.base.port);
    // Development fallback: Android emulator reaches the host via 10.0.2.2.
    final host = !kIsWeb && Platform.isAndroid ? '10.0.2.2' : '127.0.0.1';
    return Uri.parse('http://$host:8791');
  }

  Future<void> initialize() async {
    try {
      final saved = kReleaseMode ? null : await _storage.read(key: 'club.server');
      server = saved == null || saved.isEmpty ? defaultServer() : validateServer(saved);
    } catch (_) {
      server = defaultServer();
    }
    try {
      _token = await _storage.read(key: _tokenKey);
      guestToken = await _storage.read(key: 'club.guest.token');
      guestPhone = await _storage.read(key: 'club.guest.phone');
      guestExpires = DateTime.tryParse(await _storage.read(key: 'club.guest.expires') ?? '');
      pendingInvite = await _storage.read(key: 'club.pendingInvite');
      selectedClubId = int.tryParse(await _storage.read(key: 'club.selected') ?? '');
    } catch (_) {
      /* Secure storage unavailable: continue as a guest. */
    }
    // Never block startup on the network: public browsing must still open.
    unawaited(refreshSession());
  }

  String get _tokenKey => 'club.session.$server';

  Future<void> refreshSession() async {
    try {
      features = (await request('GET', 'health'))['features'] as Json? ?? {};
    } catch (_) {
      /* Shown later by the screen that needs the server. */
    }
    if (_token != null) {
      try {
        final me = await request('GET', 'auth/me');
        account = me['account'] as Json;
        memberships = rows(me['memberships']);
      } on ClubApiException catch (e) {
        if (e.status == 401) await _clearSession();
      }
    }
    notifyListeners();
  }

  Future<void> setServer(String value) async {
    final candidate = validateServer(value.trim());
    final res = await _client.get(candidate.resolve('/health')).timeout(const Duration(seconds: 10));
    if (res.statusCode != 200 || (jsonDecode(res.body) as Json)['service'] != 'arena-club-api') {
      throw const ClubApiException('동호회 앱 서버를 찾을 수 없습니다.');
    }
    await _clearSession();
    server = candidate;
    await _put('club.server', candidate.toString());
    await refreshSession();
  }

  Uri endpoint(String path, [Map<String, String>? query]) =>
      server!.resolve('/$path').replace(queryParameters: query == null || query.isEmpty ? null : query);

  String? fileUrl(Object? path) {
    if (path == null || server == null || '$path'.isEmpty) return null;
    return server!.resolve('$path').toString();
  }

  Map<String, String> get imageHeaders => _token == null ? const {} : {'Authorization': 'Bearer $_token'};

  Map<String, String> _headers({bool guest = false}) => {
        'Accept': 'application/json',
        if (_token != null) 'Authorization': 'Bearer $_token',
        if (guest && guestToken != null) 'X-Guest-Token': guestToken!,
      };

  Future<Json> request(String method, String path,
      {Object? body, Map<String, String>? query, bool guest = false}) async {
    if (server == null) throw const ClubApiException('서버 주소가 설정되지 않았습니다.');
    try {
      final req = http.Request(method, endpoint(path, query))
        ..followRedirects = false
        ..headers.addAll(_headers(guest: guest));
      if (body != null) {
        req.headers['Content-Type'] = 'application/json';
        req.body = jsonEncode(body);
      }
      final res = await http.Response.fromStream(await _client.send(req)).timeout(const Duration(seconds: 20));
      return await _decode(res, sentToken: req.headers.containsKey('Authorization'));
    } on TimeoutException {
      throw const ClubApiException('서버 응답이 지연되고 있습니다. 네트워크를 확인하고 다시 시도해주세요.');
    } on SocketException {
      throw const ClubApiException('서버에 연결할 수 없습니다. 네트워크를 확인하고 다시 시도해주세요.');
    } on http.ClientException {
      throw const ClubApiException('연결에 실패했습니다. 네트워크를 확인하고 다시 시도해주세요.');
    }
  }

  Future<Json> upload(String path, Uint8List bytes, String filename) async {
    final lower = filename.toLowerCase();
    final mime = lower.endsWith('.png') ? 'image/png' : lower.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
    try {
      final req = http.Request('POST', endpoint(path))
        ..headers.addAll(_headers())
        ..headers['Content-Type'] = mime
        ..bodyBytes = bytes;
      final res = await http.Response.fromStream(await _client.send(req)).timeout(const Duration(seconds: 45));
      return await _decode(res, sentToken: true);
    } on TimeoutException {
      throw const ClubApiException('업로드 시간이 초과되었습니다. 새로고침 후 업로드 여부를 확인해주세요.');
    } on SocketException {
      throw const ClubApiException('이미지 업로드 연결에 실패했습니다.');
    }
  }

  Future<Json> _decode(http.Response res, {required bool sentToken}) async {
    Json data;
    try {
      data = jsonDecode(utf8.decode(res.bodyBytes)) as Json;
    } catch (_) {
      throw ClubApiException('서버에서 올바른 응답을 받지 못했습니다. (${res.statusCode})', res.statusCode);
    }
    if (res.statusCode >= 200 && res.statusCode < 300) return data;
    final code = data['code'] as String?;
    if (res.statusCode == 401 && code == 'login_required' && sentToken) {
      // Session expired: only member features need to re-authenticate.
      await _clearSession();
      notifyListeners();
    }
    if (code == 'phone_verification_required') await clearGuest();
    throw ClubApiException(data['error']?.toString() ?? '요청을 처리하지 못했습니다.', res.statusCode, code);
  }

  // ------------------------------------------------------------ session
  Future<void> _storeSession(Json data) async {
    _token = data['token'] as String;
    await _put(_tokenKey, _token);
    await refreshSession();
  }

  Future<void> devLogin(String username, String password) async =>
      _storeSession(await request('POST', 'auth/dev-login', body: {'username': username, 'password': password}));

  Future<void> kakaoLogin(String accessToken) async =>
      _storeSession(await request('POST', 'auth/kakao', body: {'accessToken': accessToken}));

  Future<void> logout() async {
    try {
      await request('POST', 'auth/logout');
    } on ClubApiException catch (e) {
      if (e.status != 401 && !e.network) rethrow;
    }
    await _clearSession();
    notifyListeners();
  }

  Future<void> _clearSession() async {
    _token = null;
    account = null;
    memberships = [];
    try {
      await _put(_tokenKey, null);
    } catch (_) {}
  }

  Json? membershipFor(int clubId) =>
      memberships.where((m) => m['clubId'] == clubId).firstOrNull;

  Future<void> selectClub(int? id) async {
    selectedClubId = id;
    await _put('club.selected', id?.toString() ?? '');
    notifyListeners();
  }

  // --------------------------------------------------------------- guest
  Future<Json> startPhoneVerification(String phone) =>
      request('POST', 'guest/verify/start', body: {'phone': phone});

  Future<void> confirmPhoneVerification(String verificationId, String phone, String code) async {
    final data = await request('POST', 'guest/verify/confirm',
        body: {'verificationId': verificationId, 'phone': phone, 'code': code});
    guestToken = data['guestToken'] as String;
    guestPhone = data['phoneMasked'] as String;
    guestExpires = DateTime.tryParse(data['expiresAt'] as String);
    await _put('club.guest.token', guestToken);
    await _put('club.guest.phone', guestPhone);
    await _put('club.guest.expires', data['expiresAt'] as String);
    notifyListeners();
  }

  Future<void> clearGuest() async {
    guestToken = null;
    guestPhone = null;
    guestExpires = null;
    try {
      await _put('club.guest.token', null);
      await _put('club.guest.phone', null);
      await _put('club.guest.expires', null);
    } catch (_) {}
    notifyListeners();
  }

  // -------------------------------------------------------------- invite
  Future<void> setPendingInvite(String? token) async {
    pendingInvite = token;
    if (token == null) {
      await _put('club.pendingInvite', null);
    } else {
      await _put('club.pendingInvite', token);
    }
  }

  static String newIdempotencyKey() {
    final r = Random.secure();
    return List.generate(24, (_) => r.nextInt(36).toRadixString(36)).join();
  }

  @override
  void dispose() {
    _client.close();
    super.dispose();
  }
}

/// Extracts an invite token from `arenaclub://app/invite/<token>`, an
/// `/invite/<token>` route, or a bare token.
String? parseInvite(String input) {
  final text = input.trim();
  final match = RegExp(r'invite/([A-Za-z0-9_-]{16,80})').firstMatch(text);
  if (match != null) return match.group(1);
  return RegExp(r'^[A-Za-z0-9_-]{16,80}$').hasMatch(text) ? text : null;
}
