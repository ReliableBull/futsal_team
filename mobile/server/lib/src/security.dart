import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';

final _random = Random.secure();

String randomToken([int bytes = 32]) => base64Url
    .encode(List<int>.generate(bytes, (_) => _random.nextInt(256)))
    .replaceAll('=', '');

const _codeAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
String randomCode(int length) => List.generate(
    length, (_) => _codeAlphabet[_random.nextInt(_codeAlphabet.length)]).join();

String randomDigits(int length) =>
    List.generate(length, (_) => _random.nextInt(10)).join();

String sha256Hex(String value) => sha256.convert(utf8.encode(value)).toString();

String hmacHex(String secret, String value) =>
    Hmac(sha256, utf8.encode(secret)).convert(utf8.encode(value)).toString();

bool constantTimeEquals(String a, String b) {
  if (a.length != b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) {
    diff |= a.codeUnitAt(i) ^ b.codeUnitAt(i);
  }
  return diff == 0;
}

/// PBKDF2-HMAC-SHA256. Used only for development test accounts; real users
/// sign in with an external identity provider.
String hashPassword(String password, {String? salt, int iterations = 20000}) {
  salt ??= randomToken(16);
  final hmac = Hmac(sha256, utf8.encode(password));
  var block = Uint8List.fromList([...utf8.encode(salt), 0, 0, 0, 1]);
  var u = hmac.convert(block).bytes;
  final out = List<int>.from(u);
  for (var i = 1; i < iterations; i++) {
    u = hmac.convert(u).bytes;
    for (var j = 0; j < out.length; j++) {
      out[j] ^= u[j];
    }
  }
  return 'pbkdf2\$$iterations\$$salt\$${base64Url.encode(out)}';
}

bool verifyPassword(String password, String stored) {
  final parts = stored.split(r'$');
  if (parts.length != 4 || parts[0] != 'pbkdf2') return false;
  final expected = hashPassword(password,
      salt: parts[2], iterations: int.tryParse(parts[1]) ?? 0);
  return constantTimeEquals(expected, stored);
}

/// Korean mobile numbers only: 010XXXXXXXX after removing separators.
String normalizePhone(String input) {
  final digits = input.replaceAll(RegExp(r'[\s-]'), '');
  if (!RegExp(r'^01[016789]\d{7,8}$').hasMatch(digits)) {
    throw const FormatException('휴대폰 번호를 정확히 입력해주세요. 예: 010-1234-5678');
  }
  return digits;
}

String maskPhone(String digits) =>
    '${digits.substring(0, 3)}-****-${digits.substring(digits.length - 4)}';
