import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

typedef Json = Map<String, dynamic>;
List<Json> rows(dynamic value) => (value as List? ?? [])
    .map((e) => Map<String, dynamic>.from(e as Map))
    .toList();
String day(dynamic value) => value?.toString().split('T').first ?? '';

class ApiException implements Exception {
  final String message;
  final int? status;
  const ApiException(this.message, [this.status]);
  @override
  String toString() => message;
}

Uri validateServer(String value, {bool release = kReleaseMode}) {
  final uri = Uri.tryParse(value);
  if (uri == null ||
      !uri.hasAuthority ||
      uri.host.isEmpty ||
      uri.userInfo.isNotEmpty ||
      uri.hasQuery ||
      uri.hasFragment ||
      (uri.path.isNotEmpty && uri.path != '/') ||
      !['http', 'https'].contains(uri.scheme)) {
    throw const ApiException('서버 주소를 http://IP:포트 또는 https://도메인 형식으로 입력해주세요.');
  }
  if (release && uri.scheme != 'https') {
    throw const ApiException('배포용 앱은 HTTPS 서버 주소가 필요합니다.');
  }
  return uri.replace(path: '');
}

class ArenaApi extends ChangeNotifier {
  ArenaApi({http.Client? client, FlutterSecureStorage? storage})
    : _client = client ?? http.Client(),
      _storage = storage ?? const FlutterSecureStorage();
  final http.Client _client;
  final FlutterSecureStorage _storage;
  Uri? server;
  String? _token;
  Json? admin;
  bool get loggedIn => admin != null && _token != null;
  static const configuredServer = String.fromEnvironment('API_BASE_URL');
  String? startupError;
  String get _tokenKey => 'arena.session.${server.toString()}';

  Future<void> initialize() async {
    try {
      final saved = kReleaseMode
          ? configuredServer
          : (configuredServer.isNotEmpty
                ? configuredServer
                : await _storage.read(key: 'arena.server') ?? '');
      if (saved.isEmpty) return;
      server = validateServer(saved);
      _token = await _storage.read(key: _tokenKey);
      if (_token != null) {
        try {
          admin = (await request('GET', 'auth/me'))['admin'] as Json;
        } on ApiException catch (e) {
          if (e.status != 401) startupError = e.message;
        }
      }
    } catch (e) {
      startupError = e.toString();
    }
  }

  Future<void> connect(String value) async {
    final candidate = validateServer(value.trim());
    // Verify before replacing a working connection or persisting configuration.
    final response = await _client
        .get(candidate.resolve('/api/v1/health'))
        .timeout(const Duration(seconds: 15));
    if (response.statusCode != 200 ||
        (jsonDecode(response.body) as Json)['apiVersion'] != 1) {
      throw const ApiException('모바일 API를 찾을 수 없습니다. 서버에 최신 코드를 배포해주세요.');
    }
    if (server != null) await _storage.delete(key: _tokenKey);
    _token = null;
    admin = null;
    server = candidate;
    await _storage.write(key: 'arena.server', value: candidate.toString());
    startupError = null;
    notifyListeners();
  }

  Uri endpoint(String path, [Map<String, String>? query]) {
    if (server == null) throw const ApiException('서버 주소를 먼저 설정해주세요.');
    return server!.resolve('/api/v1/$path').replace(queryParameters: query);
  }

  String? imageUrl(dynamic value) {
    if (value == null || value.toString().isEmpty || server == null) {
      return null;
    }
    final uri = server!.resolve(value.toString());
    if (!['http', 'https'].contains(uri.scheme) ||
        (kReleaseMode && uri.scheme != 'https')) {
      return null;
    }
    return uri.toString();
  }

  Future<Json> request(
    String method,
    String path, {
    Json? body,
    Map<String, String>? query,
  }) async {
    try {
      final request = http.Request(method, endpoint(path, query));
      request.followRedirects = false;
      request.headers['Accept'] = 'application/json';
      if (_token != null) request.headers['Authorization'] = 'Bearer $_token';
      if (body != null) {
        request.headers['Content-Type'] = 'application/json';
        request.body = jsonEncode(body);
      }
      final response = await (() async => http.Response.fromStream(
        await _client.send(request),
      ))().timeout(const Duration(seconds: 20));
      return await _decode(response);
    } on TimeoutException {
      throw const ApiException('서버 응답이 지연되고 있습니다. 연결을 확인하고 다시 시도해주세요.');
    } on SocketException {
      throw const ApiException('서버에 연결할 수 없습니다. 네트워크와 서버 주소를 확인해주세요.');
    } on http.ClientException {
      throw const ApiException('연결에 실패했습니다. 네트워크와 서버 주소를 확인해주세요.');
    } on FormatException {
      throw const ApiException('서버 응답 형식이 올바르지 않습니다. 모바일 API 배포 여부를 확인해주세요.');
    }
  }

  Future<Json> _decode(http.Response response) async {
    if (response.statusCode == 401) {
      _token = null;
      admin = null;
      await _storage.delete(key: _tokenKey);
      notifyListeners();
    }
    Json data;
    try {
      data = jsonDecode(utf8.decode(response.bodyBytes)) as Json;
    } catch (_) {
      throw ApiException(
        '서버에서 올바른 응답을 받지 못했습니다. (${response.statusCode})',
        response.statusCode,
      );
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(
        data['error']?.toString() ?? '요청을 처리하지 못했습니다.',
        response.statusCode,
      );
    }
    return data;
  }

  Future<void> login(String username, String password) async {
    final data = await request(
      'POST',
      'auth/login',
      body: {'username': username, 'password': password},
    );
    await _storage.write(key: _tokenKey, value: data['token'] as String);
    _token = data['token'] as String;
    admin = data['admin'] as Json;
    notifyListeners();
  }

  Future<void> logout() async {
    // Keep the token if the server cannot confirm revocation, so logout is retryable.
    try {
      await request('POST', 'auth/logout');
    } on ApiException catch (e) {
      if (e.status != 401) rethrow;
    }
    await _storage.delete(key: _tokenKey);
    _token = null;
    admin = null;
    notifyListeners();
  }

  Future<Json> uploadImage(
    String path,
    List<int> bytes,
    String filename,
  ) async {
    if (bytes.length > 10 * 1024 * 1024) {
      throw const ApiException('10MB 이하 이미지를 선택해주세요.');
    }
    final request = http.MultipartRequest('POST', endpoint(path))
      ..followRedirects = false;
    if (_token != null) request.headers['Authorization'] = 'Bearer $_token';
    request.files.add(
      http.MultipartFile.fromBytes('image', bytes, filename: filename),
    );
    try {
      return await _decode(
        await (() async => http.Response.fromStream(
          await _client.send(request),
        ))().timeout(const Duration(seconds: 45)),
      );
    } on TimeoutException {
      throw const ApiException('업로드 시간이 초과되었습니다. 새로고침 후 업로드 여부를 확인해주세요.');
    } on http.ClientException {
      throw const ApiException('이미지 업로드 연결에 실패했습니다.');
    }
  }

  @override
  void dispose() {
    _client.close();
    super.dispose();
  }
}
