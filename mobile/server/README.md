# 동호회·풋살장 예약 앱 서버 (`mobile/server`)

Flutter 앱의 동호회(여러 클럽)·기록·조합 분석·비회원 예약 기능을 위한 **별도 백엔드**입니다.

- ARENA FC 웹사이트(Next.js, `app/`·`lib/`·`prisma/`)와 **코드·DB·배포를 공유하지 않습니다.** 웹사이트 파일과 운영 PostgreSQL은 수정하지 않습니다.
- Dart(shelf) + SQLite 파일 1개(`DB_PATH`). 업로드 이미지는 `STORAGE_DIR`.
- ARENA 데이터는 공개 API에서 **읽기 전용(GET)** 으로 한 번 복사합니다. 양방향 동기화는 하지 않습니다.
- Next.js 빌드에 영향을 주지 않도록 TypeScript 파일을 두지 않았습니다(루트 `tsconfig.json`이 `**/*.ts`를 포함하기 때문).

## 실행

```bash
cd mobile/server
dart pub get
set -a; source .env.example; set +a     # 또는 필요한 값만 export
dart run bin/import_arena.dart --source http://49.143.102.211:3932 --save-snapshot   # ARENA 가져오기
dart run bin/seed_demo.dart              # 예시 동호회·풋살장·테스트 계정
dart run bin/server.dart                 # http://127.0.0.1:8791
```

앱 실행(개발):

```bash
cd mobile
flutter run --dart-define=CLUB_API_BASE_URL=http://10.0.2.2:8791 \
            --dart-define=API_BASE_URL=http://49.143.102.211:3932   # 레거시 ARENA 화면용(선택)
```

웹 브라우저로 보기(같은 서버가 웹 화면도 제공):

```bash
cd mobile && flutter build web --release --no-web-resources-cdn
cd server && APP_ENV=development HOST=0.0.0.0 WEB_ROOT=../build/web dart run bin/server.dart
# http://localhost:8791  또는 같은 와이파이에서 http://<맥 내부 IP>:8791
```

웹에서는 한글 글꼴을 인터넷(fonts.gstatic.com)에서 받아 오므로 첫 화면에서 잠깐 글자가 네모로 보일 수 있습니다. http LAN 주소에서는 브라우저 보안 저장소를 쓸 수 없어 로그인·휴대폰 인증 상태가 새로고침하면 사라집니다(localhost에서는 유지). 기존 ARENA 화면은 브라우저 CORS 제한 때문에 웹 빌드에서 숨깁니다.

Android 에뮬레이터는 `10.0.2.2`, iOS 시뮬레이터는 `127.0.0.1`, 실기기는 `HOST=0.0.0.0`로 서버를 띄우고 PC의 LAN IP를 사용합니다.
개발 빌드에서는 마이 → "동호회 앱 서버 (개발용)"에서 주소를 바꿀 수 있습니다. 배포 빌드는 HTTPS `CLUB_API_BASE_URL`만 허용합니다(`tool/release.sh`가 검사).

## 명령

| 명령 | 내용 |
|---|---|
| `dart run bin/server.dart` | API 서버(`WEB_ROOT`를 주면 Flutter 웹 빌드도 제공). 시작 시 마이그레이션 적용, 예시 구장 슬롯을 서울 날짜 기준 14일로 보충 |
| `dart run bin/import_arena.dart [--source URL] [--save-snapshot] [--from-snapshot FILE] [--with-card-art] [--dry-run]` | ARENA 공개 기록 가져오기 + 원본 대조 보고서(`data/imports/arena-import-*.json`) |
| `dart run bin/seed_demo.dart` | 예시 데이터 생성. 재실행해도 중복 생성 없음. `APP_ENV=production`이면 거부 |
| `dart run bin/reset_demo.dart --yes [--reseed]` | **예시 데이터만** 삭제(`source='demo'`, `is_demo=1`). ARENA·사용자 데이터는 건드리지 않음 |
| `dart run bin/manage.dart accounts` | 계정 목록 |
| `dart run bin/manage.dart grant-owner CLUB_ID ACCOUNT_ID` | 소유자가 없는 동호회(가져온 ARENA FC)에 **확인된 계정**을 소유자로 지정 |
| `dart run bin/manage.dart approve-booking CODE` | 예시 구장 운영자 승인 시뮬레이션(승인 대기 → 확정) |
| `dart test` | 서버 테스트(권한·격리·예약 동시성·집계 규칙·가져오기 충돌·초기화) |

## 개발·테스트 계정 (`APP_ENV`가 production이 아닐 때만)

비밀번호는 모두 `demo1234!`. 앱 로그인 화면의 "개발·테스트 서버 전용" 영역에서 사용합니다(배포 빌드·운영 서버에서는 표시·동작하지 않음).

| 아이디 | 역할 |
|---|---|
| `night_owner` | 대구 나이트 FC 소유자 |
| `multi_manager` | 대구 나이트 FC **운영진** + 칠곡 위켄드 FC **일반 회원** (+ 위켄드 선수 연결 신청 대기) |
| `night_recorder` | 대구 나이트 FC 기록 담당자 |
| `night_member` | 대구 나이트 FC 일반 회원(선수 '라온'과 연결) + 수성 비기너 FC 일반 회원 |
| `applicant` | 대구 나이트·수성 비기너 **가입 승인 대기** |
| `weekend_owner` / `beginner_owner` | 칠곡 위켄드 / 수성 비기너 소유자 |
| `newbie` | 가입 동호회 없음 (개설·가입·초대 체험용) |

실제 ARENA 선수에게는 어떤 테스트 계정도 연결하지 않았고, ARENA FC에는 소유자가 없습니다. 운영자가 카카오 로그인한 뒤 `grant-owner`로 지정하세요.

## 이용 정책 요약

| 기능 | 비로그인 | 로그인 회원 | 역할 필요 |
|---|---|---|---|
| 홈, 공개 동호회 검색·소개 | ✅ | ✅ | |
| 공개 기록(`visibility=public` & `records_visibility=public`) | ✅ | ✅ | |
| 회원 전용 기록 | ❌ | 승인된 회원만 | |
| 풋살장 검색·상세·슬롯 | ✅ | ✅ | |
| 비회원 예약 신청·조회·변경·취소 | ✅ (휴대폰 인증) | ✅ (휴대폰 인증, 계정 자동 연결) | |
| 동호회 개설, 가입 신청, 초대 수락, 선수 연결 신청 | ❌ | ✅ | |
| 가입 승인·거절, 회원 내보내기/이용 제한, 초대 링크, 선수 관리, 설정 | | | 운영진 이상 |
| 운영진 지정·해제, 소유권 이전 | | | 소유자 |
| 경기 생성·명단·스코어·득점/도움·MOM·포스터 | | | 기록 담당자 이상 |
| 경기 삭제 | | | 운영진 이상 |

- 모든 권한은 서버가 세션 계정과 `memberships`(상태 `approved`)로 판정합니다. 요청 본문의 역할·계정 ID는 사용하지 않습니다.
- 승인 대기·거절·탈퇴·이용 제한 상태는 권한이 없습니다. 탈퇴/거절 후 재가입은 일반 회원 `pending`으로 시작, 이용 제한은 재가입 불가.
- 소유자는 소유권 이전 후 탈퇴 가능. 운영진은 자신이나 소유자·다른 운영진의 역할을 바꿀 수 없음.
- 초대 링크: 만료·폐기·사용 횟수 제한. 초대는 언제나 일반 회원 권한만 부여. `invite_only` 동호회는 수락 즉시 회원, `approval` 동호회는 승인 대기.
- 비공개 + 검색 비노출 동호회는 비회원에게 404(존재 자체를 숨김).
- 탈퇴·추방 시 선수-계정 연결만 해제하고 경기 기록은 보존합니다.
- 세션이 없거나 만료된 토큰은 공개 API에서 익명으로 처리합니다(공개 탐색·비회원 예약은 계속 가능).

## 집계 규칙 (목록·상세·랭킹·명예의 전당·카드 공통, `lib/src/stats.dart`)

- **완료(`completed`)이면서 양 팀 점수가 있는 경기만** 집계. 예정·진행 중·취소 경기는 무승부로도 세지 않음.
- 승패는 팀 점수에서 계산. 승률 = 승 / 완료 출전 경기(무승부 포함), 소수 첫째 자리.
- 연속 기록은 선수 본인의 완료 출전 경기를 날짜·ID 순으로 계산. **결장은 기록을 끊지 않음**, 출전 후 미달성은 끊음. 최고 기록은 기간(시작·종료일)과 함께 반환.
- 순위는 공동 순위(1, 1, 3). 랭킹·명예의 전당은 활동 중 선수 기준. 승률 랭킹은 동호회 설정 최소 출전 수 이상만, 표본 경기 수 표시.
- 조합 분석: 같은 팀·상대 팀 전적, 득점-도움 파트너, 최소 함께 뛴 경기(1/3/5/10), 표본 경기 수. 도움 연결 미상(`assist_known=0` 또는 골별 기록 없음)은 실제 0과 따로 집계.
- 시즌은 동호회별 설정(`seasons_json`). ARENA의 상·하반기(1~5월/6~11월)는 ARENA FC 동호회의 설정값으로만 저장.
- 서버는 매 요청 DB에서 집계하므로 별도 캐시가 없고, 앱은 기록 저장 후 화면을 다시 불러옵니다.

## 비회원 예약

흐름: 풋살장 → 날짜·시간 → 예약자 정보 → 휴대폰 확인 → 요금·취소 조건 동의 → 신청/확정 → 예약 확인.

- 계정 없이 저장(`bookings.account_id`는 선택). 휴대폰 인증은 회원가입과 별개이며 계정을 만들지 않습니다.
- 번호 원문은 저장하지 않고 HMAC(조회용)과 마스킹 값만 저장합니다.
- 예약 조회·변경·취소는 같은 번호로 인증한 `X-Guest-Token`(24시간) 또는 예약이 연결된 회원 세션이 있어야 합니다. 예약 번호만으로는 404.
- 다른 기기에서도 번호 인증 후 조회. 로그인 후 연결은 **새 번호 인증을 거친 경우에만**(`POST /me/bookings/link`).
- 중복 방지: 슬롯당 진행 중 예약 1건을 DB 부분 유니크 인덱스로 보장 + 같은 `idempotencyKey` 재시도는 기존 예약 반환.
- 상태: `pending_approval`(구장 승인 대기), `pending_payment`(결제 대기, 10분 후 `expired`), `confirmed`, `cancelled`, `expired`. 결제·승인 전에는 확정으로 표시하지 않습니다.
- 취소·변경: 이용 시작 N시간 전까지(구장별 `cancel_deadline_hours`). 취소·만료 시 슬롯 재오픈.
- 예시 풋살장 3곳은 `provider='demo'`, `is_demo=1`이며 "예시 풋살장 · 실제 예약 아님"을 표시합니다. 데모 결제·데모 인증번호는 실제 결제·문자를 발생시키지 않습니다.
- **미연동**: 실제 문자 발송(운영에서 `SMS_MODE=disabled`면 인증 요청 503), 실제 결제, 실제 구장 예약 제공자(`provider != 'demo'`이면 501). 이 상태에서는 운영 환경에서 비회원 예약을 완료할 수 없으며, 로그인 필수로 바꾸지 않았습니다.

## 데이터 모델 (마이그레이션 `lib/src/schema.dart`, 버전 1)

`accounts`, `sessions`, `clubs`, `memberships`(역할·상태, 동호회당 소유자 1명 인덱스), `invites`(토큰 해시만 저장), `players`(동호회별 프로필, 계정 연결 선택, 동호회당 계정 1프로필 인덱스), `player_photos`, `player_links`(연결 신청·승인), `matches`(경기 팀 이름·상태·점수), `match_players`, `match_goals`(득점자·도움·`assist_known`), `posters`, `files`(동호회 소유 표시로 접근 제어), `audit_logs`(변경 이력), `import_runs`/`import_conflicts`, `venues`, `venue_slots`, `bookings`, `booking_events`(예약 변경 이력), `phone_verifications`, `guest_tokens`, `app_state`.

- 동호회 데이터는 모두 `club_id`를 가지며, 하위 행(경기 선수·골·포스터·연결 신청)의 동호회가 상위 행과 다르면 트리거가 거부합니다.
- 출처: `source = arena_import | demo | user_created`, `source_ref`(원본 ID). 예시 배지는 `demo`에만 표시.
- ARENA 재가져오기 충돌 정책: 행마다 마지막 가져온 값(`import_snapshot`)을 보관. 원본만 바뀌었으면 갱신, 앱에서도 수정됐으면 덮어쓰지 않고 `import_conflicts`에 기록·보고.

## API (모두 JSON, `/api/v1` 접두사도 허용)

공개: `GET /health`, `GET /clubs?q=`, `GET /clubs/:id`, `GET /clubs/:id/{dashboard,players,players/:pid,matches,matches/:mid,chemistry,hall-of-fame,posters,source}`(기록은 공개 설정일 때), `GET /invites/:token`, `GET /venues`, `GET /venues/:id`, `GET /venues/:id/slots?date=`, `GET /files/:id`(동호회 정책 적용)

비회원 예약: `POST /guest/verify/start`, `POST /guest/verify/confirm`, `POST /venues/:id/bookings`, `GET /guest/bookings`, `GET /bookings/:code`, `POST /bookings/:code/{cancel,change,demo-payment}`

로그인: `POST /auth/dev-login`(개발 전용), `POST /auth/kakao`, `GET /auth/me`, `POST /auth/logout`, `POST /clubs`, `POST /clubs/:id/join`, `POST /invites/:token/accept`, `POST /clubs/:id/leave`, `GET /me/clubs`, `GET /me/bookings`, `POST /me/bookings/link`, `POST /clubs/:id/players/:pid/link-requests`, `DELETE /clubs/:id/link-requests/mine`

역할: `PATCH /clubs/:id`, `POST /clubs/:id/logo`, `GET /clubs/:id/members`, `POST /clubs/:id/members/:mid/{decision,role,status}`, `POST /clubs/:id/transfer-ownership`, `GET|POST /clubs/:id/invites`, `POST /clubs/:id/invites/:iid/revoke`, `GET /clubs/:id/link-requests`, `POST /clubs/:id/link-requests/:lid/decision`, `POST /clubs/:id/players`, `PATCH|DELETE /clubs/:id/players/:pid`, `POST /clubs/:id/players/:pid/{photo,unlink}`, `POST /clubs/:id/matches`, `PUT|DELETE /clubs/:id/matches/:mid`(버전 충돌 409), `POST|DELETE /clubs/:id/matches/:mid/posters[/:posterId]`, `GET /clubs/:id/audit`

이미지 업로드는 본문에 이미지 바이트, `Content-Type: image/jpeg|png|webp`, 10MB 이하, 파일 시그니처 검사.

## 운영 배포 전 남은 작업

- 카카오: 앱에 Kakao SDK·네이티브 앱 키 등록(현재 버튼 비활성), 서버 `KAKAO_APP_ID` 설정 후 실제 토큰으로 검증.
- 문자 인증 제공자 연동(`/guest/verify/start`의 연동 지점), 결제·실제 구장 예약 제공자 연동.
- HTTPS 리버스 프록시, `APP_SECRET`, SQLite 백업(또는 PostgreSQL 이전), IP 기반 요청 제한.
- ARENA FC 소유자 지정(`grant-owner`), 개인정보 처리방침에 휴대폰 인증·예약 정보 항목 반영.
