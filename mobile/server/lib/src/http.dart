import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:shelf/shelf.dart';

import 'db.dart';

class ApiError implements Exception {
  const ApiError(this.status, this.message, [this.code]);
  final int status;
  final String message;
  final String? code;
  @override
  String toString() => 'ApiError($status, $message)';
}

ApiError badRequest(String message) => ApiError(400, message, 'invalid');
ApiError notFound([String message = '대상을 찾을 수 없습니다.']) =>
    ApiError(404, message, 'not_found');
ApiError forbidden([String message = '권한이 없습니다.']) =>
    ApiError(403, message, 'forbidden');
ApiError conflict(String message, [String code = 'conflict']) =>
    ApiError(409, message, code);
const unauthorized =
    ApiError(401, '로그인이 필요합니다. 다시 로그인해주세요.', 'login_required');

const _headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

Response jsonResponse(Object? data, [int status = 200]) =>
    Response(status, body: jsonEncode(data), headers: _headers);

/// Request context handed to route handlers.
class Ctx {
  Ctx(this.request, this.params);
  final Request request;
  final Map<String, String> params;
  Json? account;
  String? sessionHash;
  Object? _body;

  Map<String, String> get query => request.url.queryParameters;
  String? header(String name) => request.headers[name];

  int intParam(String name) {
    final value = params[name] ?? '';
    final parsed = int.tryParse(value);
    if (parsed == null || parsed <= 0 || !RegExp(r'^[1-9]\d{0,9}$').hasMatch(value)) {
      throw notFound();
    }
    return parsed;
  }

  Json requireAccount() {
    final a = account;
    if (a == null) throw unauthorized;
    return a;
  }

  int get accountId => requireAccount()['id'] as int;

  Future<Json> json() async {
    if (_body != null) return _body as Json;
    if (!(request.headers['content-type'] ?? '').contains('application/json')) {
      throw const ApiError(415, 'JSON 형식으로 전송해주세요.');
    }
    final bytes = await readBytes(128 * 1024);
    try {
      final decoded = jsonDecode(utf8.decode(bytes));
      if (decoded is! Map) throw const FormatException();
      return _body = Map<String, dynamic>.from(decoded);
    } on FormatException {
      throw badRequest('JSON 형식이 올바르지 않습니다.');
    }
  }

  Future<Uint8List> readBytes(int limit) async {
    final builder = BytesBuilder(copy: false);
    await for (final chunk in request.read()) {
      builder.add(chunk);
      if (builder.length > limit) throw const ApiError(413, '요청이 너무 큽니다.');
    }
    return builder.takeBytes();
  }
}

typedef RouteHandler = FutureOr<Object?> Function(Ctx ctx);

/// Return from a handler to answer 201 Created.
class Created {
  const Created(this.data);
  final Object data;
}

class Route {
  Route(this.method, String pattern, this.handler)
      : segments = pattern.split('/').where((s) => s.isNotEmpty).toList();
  final String method;
  final List<String> segments;
  final RouteHandler handler;

  Map<String, String>? match(List<String> path) {
    if (path.length != segments.length) return null;
    final params = <String, String>{};
    for (var i = 0; i < path.length; i++) {
      final s = segments[i];
      if (s.startsWith(':')) {
        params[s.substring(1)] = path[i];
      } else if (s != path[i]) {
        return null;
      }
    }
    return params;
  }
}

/// Optional typed accessors for request bodies.
extension BodyRead on Json {
  String str(String key, {bool required = true, int max = 200, int min = 1}) {
    final value = this[key];
    if (value == null || (value is String && value.trim().isEmpty)) {
      if (required) throw badRequest('$key 값을 입력해주세요.');
      return '';
    }
    if (value is! String) throw badRequest('$key 형식이 올바르지 않습니다.');
    final trimmed = value.trim();
    if (trimmed.length > max) throw badRequest('$key 값이 너무 깁니다. ($max자 이하)');
    if (trimmed.length < min) throw badRequest('$key 값이 너무 짧습니다.');
    return trimmed;
  }

  String? optStr(String key, {int max = 2000}) {
    final value = this[key];
    if (value == null) return null;
    if (value is! String) throw badRequest('$key 형식이 올바르지 않습니다.');
    final trimmed = value.trim();
    if (trimmed.isEmpty) return null;
    if (trimmed.length > max) throw badRequest('$key 값이 너무 깁니다. ($max자 이하)');
    return trimmed;
  }

  int? optInt(String key, {int min = 0, int max = 1 << 30}) {
    final value = this[key];
    if (value == null) return null;
    if (value is! int || value < min || value > max) {
      throw badRequest('$key 값은 $min~$max 사이의 정수여야 합니다.');
    }
    return value;
  }

  bool? optBool(String key) {
    final value = this[key];
    if (value == null) return null;
    if (value is! bool) throw badRequest('$key 값은 true/false 여야 합니다.');
    return value;
  }

  String oneOf(String key, List<String> allowed, {String? fallback}) {
    final value = this[key] ?? fallback;
    if (value is! String || !allowed.contains(value)) {
      throw badRequest('$key 값이 올바르지 않습니다.');
    }
    return value;
  }
}

final _dayPattern = RegExp(r'^\d{4}-\d{2}-\d{2}$');
String? parseDay(String? input, String label) {
  if (input == null || input.isEmpty) return null;
  final parsed = DateTime.tryParse('${input}T00:00:00Z');
  if (!_dayPattern.hasMatch(input) ||
      parsed == null ||
      parsed.toIso8601String().substring(0, 10) != input) {
    throw badRequest('$label 날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)');
  }
  return input;
}

class Period {
  const Period(this.start, this.end);
  final String? start;
  final String? end;
  bool contains(String day) =>
      (start == null || day.compareTo(start!) >= 0) &&
      (end == null || day.compareTo(end!) <= 0);
  Json toJson() => {'startDate': start, 'endDate': end};

  static Period fromQuery(Map<String, String> q) {
    final start = parseDay(q['startDate'], '시작');
    final end = parseDay(q['endDate'], '종료');
    if (start != null && end != null && start.compareTo(end) > 0) {
      throw badRequest('종료일은 시작일 이후여야 합니다.');
    }
    return Period(start, end);
  }
}
