import 'dart:io';

/// Runtime configuration from environment variables.
///
/// `production` disables every development shortcut: password test accounts,
/// demo SMS codes and demo seeding. There is no switch that re-enables them.
class Config {
  Config({
    required this.env,
    required this.dbPath,
    required this.storageDir,
    required this.secret,
    this.host = '127.0.0.1',
    this.port = 8791,
    this.kakaoAppId = '',
    this.smsMode = 'disabled',
    this.webRoot = '',
  });

  final String env;
  final String dbPath;
  final String storageDir;
  final String secret;
  final String host;
  final int port;
  final String kakaoAppId;

  /// `demo` returns the verification code in the API response instead of
  /// sending an SMS. Only honoured outside production.
  final String smsMode;

  /// Directory of the Flutter web build to serve on non-API paths. Empty: off.
  final String webRoot;

  bool get isProduction => env == 'production';
  bool get devLoginEnabled => !isProduction;
  bool get demoSmsEnabled => !isProduction && smsMode == 'demo';
  bool get kakaoEnabled => kakaoAppId.isNotEmpty;

  static const _devSecret = 'development-only-secret-do-not-use-in-production';

  factory Config.fromEnvironment([Map<String, String>? environment]) {
    final e = environment ?? Platform.environment;
    final env = e['APP_ENV'] ?? 'development';
    if (!['development', 'test', 'production'].contains(env)) {
      throw StateError('APP_ENV must be development, test or production');
    }
    final secret = e['APP_SECRET'] ?? '';
    if (env == 'production' && secret.length < 32) {
      throw StateError('APP_SECRET (32+ chars) is required in production');
    }
    final smsMode = e['SMS_MODE'] ?? (env == 'production' ? 'disabled' : 'demo');
    if (env == 'production' && smsMode == 'demo') {
      throw StateError('SMS_MODE=demo is not allowed in production');
    }
    return Config(
      env: env,
      dbPath: e['DB_PATH'] ?? 'data/club.sqlite',
      storageDir: e['STORAGE_DIR'] ?? 'data/files',
      secret: secret.isEmpty ? _devSecret : secret,
      host: e['HOST'] ?? '127.0.0.1',
      port: int.tryParse(e['PORT'] ?? '') ?? 8791,
      kakaoAppId: e['KAKAO_APP_ID'] ?? '',
      smsMode: smsMode,
      webRoot: e['WEB_ROOT'] ?? '',
    );
  }
}
