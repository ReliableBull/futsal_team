# ARENA FC 모바일 설계 및 출시 가이드

## 구조와 검토 결과

기존 Next.js 14 App Router + Prisma + PostgreSQL을 백엔드로 유지하고 `mobile/`에 Flutter Android/iOS 앱을 추가했습니다. WebView가 아닌 Flutter Material 3 화면입니다. 기존 웹과 같은 DB·집계·경기 저장 함수를 사용합니다. 기존 웹의 쿠키 로그인과 모바일 Bearer 로그인은 별개입니다.

```text
Android / iOS Flutter
  └─ HTTP 개발 / HTTPS 운영
       └─ Next.js /api/v1/*
            ├─ 기존 경기·선수·명예의 전당 집계
            ├─ 관리자 인증 + MobileSession
            ├─ public/uploads/ 이미지 저장
            └─ Prisma → PostgreSQL
```

DB가 외부 IP로 접속 가능하더라도 앱은 DB에 직접 접속하지 않습니다. DB 접속 정보는 서버의 `.env`에만 둡니다. 운영 PostgreSQL은 가능하면 서버 IP 또는 사설망에서만 접근하도록 제한합니다.

서버의 기존 프론트엔드 파일에는 작업 중인 변경이 있어 그대로 유지했습니다. 앱은 현재 명예의 전당과 다중 MOM, 골별 도움 모델까지 반영했습니다. `arena_fc_flutter_handoff.zip`은 이전 명세로 참고했고 실제 현재 코드를 기준으로 구현했습니다.

## 구현된 기능

- 홈: 최근 경기, 득점·도움·MOM·승률·최근 연속 기록 TOP 5.
- 선수: 이름/닉네임 검색, 기록별 정렬, 기간 조회, 프로필, 승패·출전·득점·도움·MOM·연속 기록, 출전 경기 이동.
- 경기: 기간별 페이지 조회, 팀별 선수, 다중 MOM, 골별 도움, 메모, 포스터 확대.
- 명예의 전당: 기존 서버 집계와 공동 순위 그대로 표시.
- 관리자: 로그인 유지, 로그아웃, 선수 등록·수정·삭제/비활성화·사진 업로드, 경기 등록·수정·삭제, 참가 선수 배정, 신규 경기 랜덤 균등 배정, 득점 합계 반영, 골별 도움, 다중 MOM, 포스터 업로드·삭제.
- 연결 실패/응답 오류/로그인 만료/빈 목록/이미지 실패 표시, 재시도, 당겨서 새로고침.
- 설정: 운영 개인정보 처리방침·문의 링크, 오픈소스 라이선스, 개발용 서버 변경.

날씨 예보와 기존 Excel/분석문 다운로드는 기존 웹에서 계속 이용할 수 있습니다. 이 버전의 앱에는 알림, 일반 회원가입, 멀티 클럽, 오프라인 기록 편집을 포함하지 않습니다. 일반 조회에는 계정이 필요하지 않고 관리자 계정만 기존 서버 계정을 사용합니다.

기간 빠른 선택은 기존 클럽 규칙(1~5월 / 6~11월)을 유지하되 연도는 현재 연도로 계산합니다. 전체는 연도 제한 없는 전체 기록이며, 직접 기간을 지정할 수 있습니다. 경기일은 날짜 값으로 취급하고 UTC 날짜 경계로 검색하여 장치 시간대에 따라 날짜가 바뀌지 않게 했습니다. 진행 중 경기는 완료 통계에서 제외합니다.

## IP로 우선 실행하기

서버에서 최신 코드를 배포한 후:

```bash
npm ci
npx prisma migrate deploy
npm run build
npm run start -- -H 0.0.0.0
```

추가 마이그레이션 `20260922000000_mobile_sessions`는 관리자 세션 테이블과 인덱스만 생성합니다. 기존 경기·선수 데이터를 변경하지 않습니다. 실제 운영 DB에는 이 문서의 배포 시점에 적용하세요. 개발 작업 중 검증은 별도 테스트 DB에서 수행합니다.

외부 IP가 `203.0.113.10`, 공개 포트가 `3000`이라면 앱 주소는 `http://203.0.113.10:3000`입니다(이 IP는 문서용 예시이므로 실제 주소로 바꾸세요). 공유기/NAT를 쓰면 외부 포트를 Next.js 서버 포트에 연결해야 합니다. DB 포트 5432를 입력하지 않습니다.

```bash
curl http://실제외부IP:3000/api/v1/health
# {"status":"ok","apiVersion":1}

cd mobile
flutter pub get
flutter run --dart-define=API_BASE_URL=http://실제외부IP:3000
# 또는 주소를 생략하고 개발 앱 첫 화면에서 입력
flutter build apk --debug
```

개발 APK 위치: `mobile/build/app/outputs/flutter-apk/app-debug.apk`. 주소는 장치의 보안 저장소에 저장합니다. Android Emulator에서 PC 로컬 서버는 `10.0.2.2`, iOS Simulator에서는 `127.0.0.1`, 실기기에서는 PC LAN IP 또는 외부 IP를 사용합니다.

개발 빌드만 Android cleartext와 iOS ATS 예외를 허용합니다. HTTP에서는 비밀번호·토큰이 전송 중 암호화되지 않으므로 테스트 계정을 사용하세요. 배포 빌드는 HTTPS URL만 허용하며 서버 변경 화면을 숨깁니다. 유효한 IP 인증서로 HTTPS IP 사용도 가능하지만, 운영 인증서 관리에는 도메인을 권장합니다. 인증서 검증을 끄는 코드는 없습니다.

## API 계약

모든 JSON API는 `/api/v1` 기준입니다. 오류는 `{ "error": "사용자에게 보여줄 메시지" }`, 인증 실패 401, 검증 실패 400, 미존재 404, 충돌 409, 과다 로그인 429입니다. 응답은 `Cache-Control: no-store`입니다. DB 오류·비밀번호 해시·토큰은 공개 DTO에 포함하지 않습니다.

| 메서드 / 경로 | 응답 / 기능 | 인증 |
|---|---|---|
| GET `/health` | API 버전; DB 가용성 검사는 아님 | 공개 |
| GET `/dashboard` | 최근 경기·랭킹·포스터 | 공개 |
| GET `/players` | `{players:[...]}`; 완료 경기 집계 포함 | 공개 |
| GET `/players?includeInactive=true` | 비활성 포함 편집용 목록 | 관리자 |
| GET `/players/:id` | `{player,streaks}`; 완료 경기 이력 포함 | 공개 |
| POST `/players` | `{player}` 생성 | 관리자 |
| PUT / DELETE `/players/:id` | 수정 / 이력 없는 선수 삭제 | 관리자 |
| POST `/players/:id/photo` | multipart `image`, `{player}` | 관리자 |
| GET `/matches` | `{matches,pagination:{page,limit,total,hasMore}}` | 공개 |
| GET `/matches/:id` | `{match}`; 선수·골·포스터 포함 | 공개 |
| POST `/matches` | `{match}` 생성 | 관리자 |
| PUT / DELETE `/matches/:id` | 수정 / 연관 기록 함께 삭제 | 관리자 |
| POST `/matches/:id/posters` | multipart `image`, `{poster}` | 관리자 |
| DELETE `/matches/:id/posters/:posterId` | 포스터 삭제 | 관리자 |
| GET `/hall-of-fame` | `{hallOfFame}` | 공개 |
| POST `/auth/login` | 입력 `{username,password}`, 응답 `{token,expiresAt,admin}` | 공개 |
| GET `/auth/me` | `{admin:{id,username}}` | 관리자 |
| POST `/auth/logout` | 세션 폐기, `{ok:true}` | 관리자 |

선수/경기 조회에는 `startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`를 함께 지정할 수 있습니다. 생략하면 전체입니다. 경기 페이지 기본 30개, 최대 100개, `page=1`부터 시작합니다. 선수 목록은 소규모 단일 클럽을 전제로 한 전체 목록입니다.

선수 입력:

```json
{"name":"선수 이름","nickname":null,"position":"미드필더","number":10,"isActive":true,"profileImageUrl":null}
```

포지션은 기존 코드의 7개 포지션만 허용합니다. 이미지 주소는 서버 상대 경로 또는 HTTPS 주소입니다. 업로드는 JPG/PNG/WebP 10MB 이하이며 파일 시그니처와 스트림 크기를 서버에서 검사합니다. HEIC 등은 사진 선택기가 변환하지 못하면 명시적으로 거절합니다.

경기 입력:

```json
{
  "matchDate":"2026-09-22","status":"COMPLETED","location":"구장",
  "teamAName":"회장팀","teamBName":"총무팀","teamAScore":1,"teamBScore":0,
  "teamAPlayerIds":[1,2],"teamBPlayerIds":[3],
  "goalsByPlayerId":{"1":1},"assistsByPlayerId":{"2":1},
  "goalAssistPlayerIdsByScorerId":{"1":[2]},
  "chairmanTeamMvpIds":[1,2],"managerTeamMvpIds":[],"memo":null
}
```

골별 도움 값은 선수 ID / `null`(도움 없음) / `"UNKNOWN"`(기존 기록 연결 미상)입니다. 미상 연결이 남으면 기존 도움 합계를 보존합니다. 양 팀 중복 선수, 타 팀 도움, 자기 도움, 잘못된 MOM, 없는 선수, 소수/음수 득점은 거절합니다. 팀 점수는 자책골 등 미연결 득점을 위해 선수 득점 합계보다 클 수 있습니다. 읽기 후 수정은 최종 저장 우선 방식이므로 여러 관리자가 같은 경기를 동시에 편집하지 않는 운영을 전제합니다.

## 인증과 운영

모바일 세션은 암호학적 난수 32바이트 토큰, 서버에는 SHA-256 해시만 저장, 유효기간 8시간입니다. 앱 저장은 Android 보안 저장소 / iOS Keychain을 사용합니다. 로그아웃 즉시 DB 세션을 폐기하며 관리자 비밀번호가 바뀌면 기존 토큰도 무효화됩니다. 자동 갱신 토큰은 사용하지 않고 만료 시 재로그인합니다. 서버 확인에 실패한 로그아웃은 재시도할 수 있게 세션을 유지합니다.

로그인 제한은 서버 프로세스별 계정당 15분 10회, 전체 15분 100회 보조 제한입니다. 다중 프로세스/서버 운영에는 공용 Redis 기반 제한 또는 프록시 제한이 필요합니다. 클라이언트 제공 IP 헤더를 신뢰해 우회되는 방식은 사용하지 않았습니다.

Nginx 예시(HTTPS 인증서와 실제 호스트 설정은 운영 환경에 맞게 추가):

```nginx
# http 블록
limit_req_zone $binary_remote_addr zone=arena_login:10m rate=5r/m;

# server 블록
client_max_body_size 11m;
location = /api/v1/auth/login {
    limit_req zone=arena_login burst=5 nodelay;
    limit_req_status 429;
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
}
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

기존 웹 로그인에도 운영 프록시에서 별도 제한을 적용하세요. 저장소의 기존 seed/README에 기본 관리자 암호가 있으므로 운영 전에 반드시 변경하고 `AUTH_SECRET`도 충분히 긴 임의 값으로 설정하세요. 기존 웹의 기본 비밀키 fallback과 웹 업로드 검증은 모바일 API와 별도이므로 공개 운영 전에 함께 점검해야 합니다.

`public/uploads`는 재배포 후에도 유지되는 디스크를 사용하고 DB와 함께 백업하세요. 여러 서버로 확장할 때는 이미지 저장을 객체 스토리지로 옮겨야 합니다. 만료 세션은 새 로그인 시 정리됩니다. 별도 정기 정리 작업을 추가해도 됩니다.

## 빌드와 출시

Flutter/Dart 버전은 `mobile/pubspec.yaml`과 CI를 기준으로 맞추세요. Android/iOS 식별자는 현재 `kr.arenafc.arena_fc` / `kr.arenafc.arenaFc`이며 실제 스토어 등록 전 고유 소유 식별자로 확정해야 합니다. 앱 아이콘은 ARENA 색상의 A 모노그램으로 구성했습니다. 원본은 `mobile/assets/branding/icon.svg`, 크기별 생성기는 `mobile/tool/generate_icons.py`입니다. 스토어의 최종 브랜드 자산과 스크린샷은 운영자가 확정하세요.

1. 운영 HTTPS API, 개인정보 처리방침, 문의 페이지 주소를 준비합니다.
2. `mobile/config/production.example.json` → `production.local.json`으로 복사하고 실제 주소로 교체합니다. 이 파일에는 비밀키·DB 정보를 넣지 않습니다.
3. Android는 업로드 키를 발급하고 `android/key.properties.example`을 `android/key.properties`로 복사해 서명값을 설정합니다. 실제 키 파일과 비밀번호는 git에 포함하지 않습니다. 서명 미설정 릴리스 빌드는 실패하도록 구성했습니다.
4. iOS는 지원되는 최신 Xcode, Apple Developer 팀·인증서·프로비저닝·Keychain 설정이 필요합니다. 현재 개발 머신의 Xcode 14.2는 설치된 Flutter 요구 버전에 미달합니다. iOS 빌드와 실기기 검증은 Xcode 업데이트 후 수행해야 합니다.
5. 아래 릴리스 스크립트는 실제 HTTPS 주소, 개인정보/문의 URL을 확인하고 분석·테스트 후 빌드합니다.

```bash
cd mobile
./tool/release.sh android config/production.local.json
./tool/release.sh ios config/production.local.json
```

Android 결과는 `build/app/outputs/bundle/release/app-release.aab`, iOS는 `build/ios/ipa/`입니다. 난독화 심볼은 `build/symbols/`에 보관하세요. 버전은 `pubspec.yaml`의 `version: 1.0.0+1`을 배포마다 올립니다.

출시 전 확인할 실제 운영 항목: LTE/5G와 Wi-Fi에서 외부 서버 접속, 인증서 정상 검증, 앱 종료 후 로그인 복원, 만료/로그아웃, 사진 권한 거절·선택, 여러 화면 크기, 뒤로가기, TalkBack/VoiceOver, Android 내부 테스트·TestFlight, 관리자 테스트 계정과 심사 설명, 선수 이름/사진 공개 범위와 개인정보 처리방침, 스토어 데이터 공개 양식, 스크린샷·아이콘. 스토어 제출이나 운영 서버 배포는 이 구현 작업에서 실행하지 않습니다.

공식 배포 문서: [Flutter Android](https://docs.flutter.dev/deployment/android), [Flutter iOS](https://docs.flutter.dev/deployment/ios), [보안 저장소](https://pub.dev/packages/flutter_secure_storage).

## 검증 방법

```bash
npm run lint
npx tsc --noEmit
npm run test:mobile
cd mobile
flutter analyze
flutter test
flutter build apk --debug
```

실제 API 통합 검증은 빈 전용 PostgreSQL DB를 생성해 수행합니다. `test-mobile-api.ts`는 DB 이름이 `arena_mobile_test_`로 시작하고 명시적 테스트 플래그가 있어야 실행되며 로컬 서버만 허용합니다. 운영 DB URL로 실행하지 마세요.

```bash
createdb arena_mobile_test_local
export DATABASE_URL=postgresql://로컬사용자@localhost:5432/arena_mobile_test_local
npx prisma migrate deploy
NEXT_DIST_DIR=.next-mobile-test npx next dev -p 3101 -H 127.0.0.1
# 같은 DATABASE_URL을 설정한 다른 터미널에서
ALLOW_MOBILE_TEST_DB=1 npm run test:mobile:integration
# 테스트 서버 종료 후 전용 DB만 삭제
```

CI `.github/workflows/mobile.yml`에는 Flutter 분석/테스트/개발 APK와 전용 PostgreSQL 서비스 기반 API 검증을 추가했습니다. API 테스트는 인증 차단·CRUD·다중 MOM·도움 검증·통계·진행 중 경기 제외·기간 필터·포스터·로그아웃/만료/비밀번호 변경 시 토큰 무효화를 확인합니다.
