#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
target="${1:-}"
config_file="${2:-config/production.local.json}"
if [[ "$target" != "android" && "$target" != "ios" ]]; then
  echo 'Usage: ./tool/release.sh android|ios [config/production.local.json]' >&2
  exit 1
fi
python3 - "$config_file" <<'PY'
import json, sys
from urllib.parse import urlsplit
with open(sys.argv[1]) as f:
    config = json.load(f)
for name in ['API_BASE_URL', 'CLUB_API_BASE_URL', 'PRIVACY_POLICY_URL', 'SUPPORT_URL']:
    value = urlsplit(config.get(name, ''))
    if value.scheme != 'https' or not value.hostname or value.username or value.password or value.hostname.endswith('.example.com'):
        raise SystemExit(f'{name}: 실제 운영 HTTPS 주소가 필요합니다.')
    if name in ('API_BASE_URL', 'CLUB_API_BASE_URL') and (value.path not in ['', '/'] or value.query or value.fragment):
        raise SystemExit('API_BASE_URL에는 경로·쿼리 없이 서버 주소만 입력해주세요.')
print('운영 앱 설정 검증 완료')
PY
flutter analyze
flutter test
if [[ "$target" == "android" ]]; then
  [[ -f android/key.properties ]] || { echo 'android/key.properties에 릴리스 서명을 설정해주세요.' >&2; exit 1; }
  flutter build appbundle --release --dart-define-from-file="$config_file" --obfuscate --split-debug-info=build/symbols/android
else
  flutter build ipa --release --dart-define-from-file="$config_file" --obfuscate --split-debug-info=build/symbols/ios
fi
