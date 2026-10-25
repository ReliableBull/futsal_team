# ARENA Futsal Record

축구·풋살 동호회 탐색, 동호회별 선수·경기·랭킹·MOM 관리, 예시 구장 예약 체험을 제공하는 웹 서비스입니다. 기존 ARENA FC 전용 화면을 제공하는 `legacy` 실행 모드도 지원합니다.

## 다중 팀 서비스 / 기존 버전 실행

최초 전환 시 DB를 백업한 다음 새 마이그레이션을 적용합니다. 기존 선수·경기·접속 로그는 `arena-fc` 팀으로 연결하고 기존 관리자에게 해당 팀 관리 권한을 부여합니다. 레코드 ID와 기존 URL은 유지됩니다. **두 실행 모드 모두 새 마이그레이션이 필요합니다.**

```bash
npx prisma migrate deploy
npm run dev                         # 기본: 다중 팀 서비스
npm run dev:legacy                  # 기존 ARENA FC 전용
npm run dev -- --mode legacy -p 3001 # 동일한 옵션을 직접 지정
```

운영 빌드는 한 번만 만들고 **서버 시작 시** 모드를 선택합니다. 모드를 바꿀 때 재빌드할 필요는 없습니다.

```bash
npm run build
npm run start                       # 다중 팀 서비스
npm run start:legacy                # 기존 ARENA FC 전용
APP_MODE=legacy ./scripts/start-production.sh
APP_MODE=legacy ./scripts/install-systemd-service.sh
```

`APP_MODE`는 `platform`(기본) 또는 `legacy`이며 `.env`에도 설정할 수 있습니다. `--mode`는 환경변수보다 우선합니다. 별도 빌드 디렉터리를 사용한다면 빌드와 실행에 동일한 `NEXT_DIST_DIR`를 지정합니다. 실행 중인 빌드를 덮어쓰지 마세요. 두 개발 서버를 동시에 켤 때는 `NEXT_DIST_DIR`도 서로 다르게 지정하세요.

- `/`: 동호회 탐색 · 구장 예약 · 동호회 운영 서비스 홈
- `/teams`: 종목·지역·모집 여부 검색 / 로그인한 계정이 속한 동호회와 팀별 역할
- `/teams/{slug}`: 동호회 소개, 정기 모임, 모집 안내 및 운영자가 등록한 외부 가입 문의 링크
- `/teams/examples/{slug}`: 체험용 가상 동호회 3곳. 실제 DB 및 회원 모집과 분리
- `/venues`: 가상 구장 4곳. 지역·종목·실내/야외 검색
- `/venues/{slug}`: 시설 및 예시 요금, 한국 시간 기준 7일간 시간 선택, 예시 예약 요청
- `/bookings`: 현재 브라우저의 예시 예약 확인·취소·체험 내역 초기화
- `/teams/new`: 팀 및 계정 생성. 만든 계정은 해당 팀의 회장(운영자)이 되며, 로그인 중이면 같은 계정에 새 팀 추가
- `/login`: 서비스 로그인. 기존 ARENA FC 관리자도 같은 계정 사용
- `/t/{slug}`: 팀 홈. 하위 `/players`, `/matches`, `/chemistry`, `/hall-of-fame`, `/abcd`에서 기존 기능 사용
- `/t/{slug}/abcd/team`: 이름·소개·지역·색상·종목·정기 모임·모집 여부·가입 문의 링크 수정. 공유 링크 보존을 위해 팀 주소는 고정
- `/t/{slug}/api/v1/*`: 팀별 모바일 API. 기존 `/api/v1/*`는 ARENA FC를 계속 대상으로 사용

팀 기록은 공개이며 선수·경기 등록과 수정, 내보내기, 접속 로그 열람은 해당 팀의 회장(운영자)만 가능합니다. `/teams?mine=1`은 내가 속한 동호회를 보여주며 운영 중인 팀과 일반 회원으로 참여하는 팀을 구분합니다. 각 팀 카드·소개·기록 화면에는 내 역할을 표시합니다. `20261024000000_team_roles` 마이그레이션은 기존 운영 권한을 `PRESIDENT`로 보존하며, 새 소속의 기본 역할은 `MEMBER`입니다. 팀 개설 시에는 명시적으로 `PRESIDENT`를 부여합니다. 권한 변경은 기존 웹 세션과 모바일 토큰에도 즉시 반영됩니다. 계정 하나로 여러 팀을 만들고 관리할 수 있습니다. 팀의 A/B 명단은 기존처럼 한 팀 안의 자체 경기 편성입니다. 동호회 정보는 PostgreSQL에 저장하며 가입 문의는 운영자가 입력한 HTTPS 외부 채널로 연결합니다. 팀 간 매칭·대회, 일반 회원 가입/초대, 서비스 내부 가입 승인, 결제는 구현 범위에 포함되지 않습니다.

**구장 예약은 데모입니다.** 구장·시설·요금은 `lib/demo-venues.ts`의 가상 예시이며 실제 구장에 전달되지 않습니다. 예약 내역은 `arena.demo-bookings.v1` 키로 현재 브라우저의 localStorage에만 저장되며 로그인 계정·다른 기기와 동기화되지 않습니다. 같은 브라우저의 중복 시간 요청 및 지난 시간 선택을 차단하고 취소 후 다시 요청할 수 있습니다. 실제 서비스 전환 시 구장 운영자·서버 예약 저장·잔여 시간 관리·확정/결제 연동이 별도로 필요합니다.

`legacy` 모드는 동호회 탐색·소개, 구장·예약 체험, `/login`, `/t/*`, 팀 설정을 차단하고 기존 경로에서 ARENA FC 데이터만 제공합니다. 다른 팀 데이터는 DB에 그대로 보관되며 다시 `platform`으로 실행하면 사용할 수 있습니다. 다중 팀 DB에서는 기존의 전체 데이터 교체용 seed/import 명령을 차단합니다.

### 동호회 의사결정 투표

`20261024010000_club_polls` 마이그레이션 적용 후 새 버전의 팀 메뉴에서 **투표**를 엽니다.

- `/t/{slug}/polls`: 회원 전용 투표 목록. 회장(운영자)은 투표를 만들고 직접 마감할 수 있습니다.
- `/t/{slug}/polls/new`: 제목, 설명, 선택지 2~10개, 선택적인 마감 일시(한국 시간)를 입력합니다.
- `/t/{slug}/polls/{id}`: 회장과 일반 회원 모두 계정당 한 번, 한 가지 선택지에 투표합니다. 제출 후 선택 변경과 마감 후 재개는 지원하지 않습니다. 합계와 본인의 선택만 표시하며 회원별 선택은 공개하지 않습니다.
- **투표 링크 복사**로 카카오톡·문자에 붙여넣습니다. **공유하기**는 지원되는 기기의 공유창을 열며, 미지원 환경에서는 링크 복사로 전환합니다. 클립보드를 사용할 수 없는 환경에는 직접 복사할 주소도 표시합니다. 메시지는 자동 발송하지 않습니다.
- 비로그인 사용자는 회원 계정으로 로그인한 뒤 원래 공유받은 투표로 돌아옵니다. 해당 동호회에 소속되지 않은 계정은 투표 내용·결과를 조회하거나 투표할 수 없습니다.
- 공유 URL은 현재 접속 주소를 사용합니다. `localhost`로 접속한 경우에는 접근 가능한 `NEXT_PUBLIC_SITE_URL`이 설정돼 있으면 그 주소를 사용합니다. LAN 주소는 같은 네트워크에서만 사용할 수 있으므로 외부 회원에게 공유하려면 공개된 서버 주소로 접속하거나 `NEXT_PUBLIC_SITE_URL`을 설정해야 합니다.

중복 참여는 DB의 `(pollId, voterId)` 제약으로 차단합니다. 투표·마감은 동일한 투표 행 잠금을 사용하여 동시에 요청해도 마감 후 표가 추가되지 않습니다. 회원 자격과 운영 권한은 매 요청마다 확인합니다. API는 `/t/{slug}/api/polls`, `/t/{slug}/api/polls/{id}`, 하위 `/votes`·`/close` 경로이며 기존 MOM 투표와 별개입니다.

검증: `npm run test:polls`. HTTP·DB 검증은 별도 `arena_teams_test_*` DB와 같은 DB를 사용하는 테스트 서버에서 `ALLOW_TEAMS_TEST_DB=1 TEAMS_TEST_URL=http://127.0.0.1:3110 npm run test:polls:integration`을 실행합니다.

### 레거시 이름 입력 투표

`20261024020000_legacy_polls` 마이그레이션 적용 후 `APP_MODE=legacy`에서는 **관리자 페이지 → 투표 관리 / 투표 만들기**로 접근합니다. 일반 메뉴에는 투표 탭을 표시하지 않으며, 투표 목록과 생성 화면은 관리자만 접근할 수 있습니다.

- 관리자는 `/abcd`에서 **투표 만들기**를 누르거나 `/polls/new`로 접속합니다. 기존 관리자 로그인 후 제목·선택지·마감 시각을 설정합니다. 선택지는 2~50개입니다.
- 시즌 MVP·회장 선출처럼 회원을 뽑는 투표는 **활성 회원에서 후보 고르기**에서 후보를 체크하거나 **전체 추가**합니다(`20261024040000_poll_player_options` 마이그레이션 필요). 직접 입력한 선택지(예: 기권)와 함께 사용할 수 있으며, 처음 회원을 추가하면 기본 선택지(찬성/반대)는 빠집니다. 투표 화면과 관리자 결과에는 후보별 프로필 사진·이름·시즌 기록이 한 줄로 표시됩니다. 시즌 기록은 선수 목록 기본 기간의 완료된 경기 기준(경기 수·승무패·득점·도움·MOM)으로 **투표를 만든 시점에 저장**하므로 투표 중 기록이 바뀌어도 그대로이며, 사진은 현재 프로필을 따릅니다. 서버는 해당 팀의 현재 활성 회원인지 다시 확인하고, 선수가 삭제되어도 투표의 이름·기록은 유지합니다.
- 관리자용 `/polls/{id}`에서 **투표 링크 복사** 또는 **공유하기**를 누르면 `/vote/{id}` 주소가 전달됩니다. 수신자는 동호회 메뉴가 없는 별도의 투표 화면에서 로그인 없이 이름과 선택지 하나를 제출합니다. 기존 `/polls/{id}` 공유 링크도 일반 참여자는 새 화면으로 이동합니다.
- 동일 이름(유니코드 정규화, 공백·대소문자 차이 무시)과 동일 브라우저의 중복 제출을 제한합니다. 동명이인은 운영자와 상의해 구분할 이름을 사용해야 합니다. 본인 인증 방식은 아니므로 이름을 바꾸고 다른 브라우저를 사용하는 참여까지 막지는 않습니다.
- 참여 완료 상태는 무작위 HttpOnly 쿠키로 기억하며 제출 후에는 변경·취소·재투표할 수 없습니다. 투표 전·후·마감 후 모두 투표 인원, 현재 활성 회원 수, 투표율을 표시하며 3초마다 갱신합니다. 활성 회원은 해당 팀의 `Player.isActive = true`인 명단이며, 투표율은 `제출된 투표 수 / 현재 활성 회원 수 × 100`을 소수점 한 자리로 반올림합니다. 활성 회원이 0명이면 투표율은 계산하지 않으며, 제출 수가 활성 회원 수보다 많아도 실제 비율을 표시합니다.
- 관리자는 총 참여 인원, 항목별 득표수, 입력한 이름·선택 항목·제출 시각을 확인합니다. 화면은 3초마다 자동 갱신하며, 매 요청마다 관리자 권한을 확인합니다. 투표 생성과 마감도 관리자만 가능합니다.
- 관리자는 이름별 투표 내역에서 중복·장난·잘못 제출된 표를 **무효 처리**합니다(`20261024030000_legacy_poll_invalidation` 마이그레이션 필요). 무효 처리한 표는 항목별 결과·참여 인원·투표율에서 즉시 빠지고, 같은 화면의 **무효 처리한 표** 목록에 이름·선택·제출/무효 처리 시각이 남습니다. 해당 이름과 브라우저는 다시 투표할 수 있으며, 마감 후에도 무효 처리할 수 있습니다. 복원은 지원하지 않습니다. API는 관리자 전용 `POST /api/polls/{id}/invalidate`(`{ "ballotId": "..." }`)이며, 이미 처리된 표 ID로 다시 요청하면 같은 이름으로 새로 들어온 표를 건드리지 않고 404를 반환합니다. 이 마이그레이션은 실행 중인 이전 빌드와 호환되므로 서버 재시작 전에 먼저 적용합니다.
- 공개 API `/api/vote/{id}`는 `turnout`에 참여 인원과 활성 회원 수·투표율만 제공합니다. 관리자 로그인 상태라도 항목별 득표수나 이름별 선택 내역은 보내지 않습니다. 기존 `/api/polls/{id}` 및 제출 응답도 일반 참여자에게는 항목별 결과와 다른 참여자의 정보를 보내지 않습니다.
- 레거시 투표와 새 버전의 회원 전용 투표는 DB의 `audience`로 구분합니다. 다른 버전의 투표 ID를 입력해도 조회·참여·마감할 수 없습니다. 기존 투표는 회원 전용으로 유지됩니다.

레거시 HTTP 검증: 같은 격리 테스트 DB를 사용하는 두 서버를 띄우고 `ALLOW_TEAMS_TEST_DB=1 TEAMS_TEST_URL=http://127.0.0.1:3110 TEAMS_LEGACY_TEST_URL=http://127.0.0.1:3111 npm run test:polls:legacy`를 실행합니다.

검증:

```bash
npm run test:teams
npm run test:community
# 별도 arena_teams_test_* PostgreSQL DB에 마이그레이션을 적용한 후,
# 동일 DB/비밀값/빌드로 platform(3110), legacy(3111) 서버를 각각 실행합니다.
ALLOW_TEAMS_TEST_DB=1 TEAMS_TEST_URL=http://127.0.0.1:3110 \
  TEAMS_LEGACY_TEST_URL=http://127.0.0.1:3111 npm run test:teams:integration
```

통합 검증은 테스트 팀/계정을 만들고 정리하며, 팀별 조회·쓰기·트랜잭션·모바일 토큰·관리자 쿠키·내보내기·MOM 투표·접속 로그·헤더 위조 차단과 구버전 모드를 검사합니다. 반드시 테스트 DB에만 실행하세요.

## 기술 스택

- Next.js App Router
- TypeScript
- Tailwind CSS
- Prisma ORM
- PostgreSQL
- React Server Components
- Server Actions

## 로컬 실행 방법

PostgreSQL이 먼저 실행 중이어야 합니다. macOS/Homebrew 기준:

```bash
brew install postgresql@18
brew services start postgresql@18
/usr/local/opt/postgresql@18/bin/createdb futsal_team
```

`.env`의 `DATABASE_URL`은 로컬 PostgreSQL을 사용합니다.

```bash
DATABASE_URL="postgresql://futsal_admin:YOUR_PASSWORD@localhost:5432/futsal_team?schema=public"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
```

```bash
npm install
npx prisma migrate dev
npm run import:list
npm run dev
```

실행 후 브라우저에서 `http://localhost:3000`에 접속합니다.

링크 공유 미리보기 이미지를 노출하려면 `NEXT_PUBLIC_SITE_URL`을 공유받는 기기에서 접근 가능한 주소로 설정해야 합니다. 같은 LAN에서는 예를 들어 `http://192.168.0.28:3000`, 외부 공개 도메인이 있다면 `https://your-domain.com`처럼 설정합니다.

## 다른 PC에서 개발 DB 접속

이 PC를 개발 DB 서버로 사용할 때는 같은 LAN에서 아래 주소를 사용합니다.

```bash
DATABASE_URL="postgresql://futsal_admin:YOUR_PASSWORD@192.168.0.28:5432/futsal_team?schema=public"
```

PostgreSQL 서버 PC에서는 `postgresql.conf`의 `listen_addresses`가 `*` 또는 LAN IP로 설정되어 있어야 하고, `pg_hba.conf`에는 개발 LAN 대역을 허용하는 규칙이 필요합니다.

```text
host    futsal_team      futsal_admin    192.168.0.0/24          scram-sha-256
```

## Raspberry Pi / Jetson Nano 설치

보드 OS는 Raspberry Pi OS, Ubuntu, JetPack 계열처럼 `apt-get`을 사용할 수 있는 Debian/Ubuntu 기반을 권장합니다.
프로젝트 폴더를 보드에 복사하거나 `git clone` 한 뒤 아래 순서로 실행합니다.

```bash
chmod +x scripts/*.sh
./scripts/setup-linux-board.sh
./scripts/start-production.sh
```

설치 스크립트는 다음 작업을 수행합니다.

- Node.js 20 설치 확인 및 필요 시 설치
- `.env`가 없으면 `.env.example`을 복사하고 `AUTH_SECRET` 자동 생성
- `npm ci` 또는 `npm install`
- `npx prisma migrate deploy`
- `npm run build`

같은 네트워크의 다른 기기에서는 아래 주소로 접속합니다.

```bash
http://<보드 IP>:3000
```

처음 설치 시 seed 데이터를 넣고 싶으면 다음처럼 실행합니다. 단, seed는 테스트 데이터를 만들기 때문에 실제 운영 DB에는 신중하게 사용하세요.

```bash
SEED_DB=1 ./scripts/setup-linux-board.sh
```

보드 재부팅 후에도 자동으로 실행하려면 setup 완료 후 systemd 서비스를 설치합니다.

```bash
./scripts/install-systemd-service.sh
```

서비스 확인/재시작 명령은 다음과 같습니다.

```bash
sudo systemctl status arena-fc
sudo systemctl restart arena-fc
sudo journalctl -u arena-fc -f
```

포트를 바꾸고 싶으면 실행 시 `PORT`를 지정할 수 있습니다.

```bash
PORT=8080 ./scripts/start-production.sh
PORT=8080 ./scripts/install-systemd-service.sh
```

## 날씨 설정

Home 화면의 대구 10일 날씨는 기본적으로 개발용 mock 데이터를 표시합니다.
실제 예보를 사용하려면 `.env`에 OpenWeather API 키를 설정하세요.

```bash
WEATHER_API_KEY="your-openweather-api-key"
```

API 호출이 실패하거나 키가 없으면 화면이 깨지지 않도록 mock 데이터로 대체됩니다.

## 선수 프로필 이미지

선수 이미지는 `public/images/players/` 폴더에 넣습니다.
기본 규칙은 선수 ID와 같은 파일명입니다.

```text
public/images/players/1.jpg
public/images/players/2.jpg
```

관리자 페이지에서 새 선수를 등록할 때 `프로필 이미지 경로`에 직접 경로를 넣을 수도 있습니다.

```text
/images/players/kim-minseok.jpg
```

이미지가 없거나 로딩에 실패하면 선수 이름 첫 글자를 사용한 기본 아바타가 표시됩니다.

## Prisma migrate 방법

`.env`의 `DATABASE_URL`은 PostgreSQL DB를 가리킵니다.

```bash
npx prisma migrate dev
```

새로운 모델 변경 후에는 migration 이름을 입력하면 Prisma가 migration 파일과 PostgreSQL DB를 갱신합니다.

## 데이터 입력 방법

```bash
npm run import:list
```

`scripts/futsal-list-data.json`의 한글 선수/경기 데이터를 PostgreSQL에 입력합니다.

SQLite 백업 JSON을 PostgreSQL로 복원해야 할 때는 다음 명령을 사용합니다.

```bash
npm run import:sqlite-export -- /path/to/futsal-sqlite-export.json
```

관리자 계정은 seed 또는 SQLite 이관 데이터에 포함됩니다.

- 아이디: `admin`
- 비밀번호: `dlGhwns12!`

## 주요 페이지 경로

- `/` 메인 페이지
- `/players` 선수 목록
- `/players/[id]` 선수 상세
- `/matches` 경기 목록
- `/matches/[id]` 경기 상세
- `/abcd/login` 관리자 로그인
- `/abcd` 관리자 페이지
- `/abcd/matches/[id]/edit` 경기 수정
- `/abcd/access-logs` 접속 로그

### 선수 목록 엑셀 다운로드

`/players`에서 기간을 조회하고 원하는 항목으로 정렬한 뒤 `엑셀 다운로드`를 누르면 현재 화면의 선수 기록을 같은 순서의 `.xlsx` 파일로 저장합니다. 아직 `조회`하지 않은 날짜 입력은 적용하지 않으며, 파일 안에 실제 조회 기간과 정렬 기준을 표시합니다. 선수명·닉네임·포지션·등번호, 경기·승·패·무·승률·득점·도움·공격 포인트·경기당 공격 포인트·MOM을 포함합니다. 승률은 퍼센트, 나머지 기록은 숫자로 저장하며 공격 포인트·경기당 공격 포인트·승률에는 계산식과 화면 값도 함께 넣습니다. 경기당 공격 포인트는 조회 기간의 공격 포인트를 선수의 출전 경기 수로 나누어 소수점 둘째 자리까지 반올림하며, 출전이 없으면 `0.00`으로 표시합니다. 웹과 엑셀 모두 이 항목으로 정렬할 수 있습니다.

다운로드 파일의 선수 기록은 엑셀 표로 구성됩니다. 각 열 제목 옆 `▼`에서 오름차순·내림차순 정렬과 값 필터를 사용할 수 있으며, 정렬할 때 선수별 행 전체가 함께 이동합니다. 헤더는 스크롤해도 고정됩니다.

PC와 모바일에서 로그인 없이 사용할 수 있고, 현재 표시된 데이터로 브라우저 안에서 생성하므로 다운로드 시 재조회로 기록이나 순서가 바뀌지 않습니다. 내보내기 검증: `npm run test:player-list-excel`.

## 웹 조합 분석과 결과 공유

- `/chemistry`에서 기준 선수, 조회 기간, 최소 경기 수(1/3/5/10)를 선택합니다. 처음 열면 2026-01-01부터 한국 시간 기준 오늘까지 자동 조회합니다. 날짜를 비우거나 `전체 기간으로 보기`를 누르면 모든 연도를 조회합니다. 선수 상세의 `동료·상대 전적 분석`으로 해당 선수의 분석을 바로 열 수 있습니다.
- 완료된 출전 경기만 집계하며, 승률은 기준 선수 팀의 승리 횟수 / 경기 수입니다. 무승부도 분모에 포함됩니다. 같은 팀 동료와 상대 팀 선수의 전적을 따로 표시하고 비활성 선수의 과거 기록도 포함합니다.
- 득점·도움 파트너는 확인된 골 연결만 집계합니다. 최소 경기 수는 동료·상대 전적에만 적용하며, 과거 연결 미상 기록은 안내 문구로 따로 표시합니다.
- 경기 상세의 `카드 미리보기`에서 스코어·출전 선수별 득점·도움·다중 MOM을 포함한 PNG를 저장할 수 있습니다. 진행 중 경기는 최종 결과가 아니라는 문구를 표시합니다. `경기 링크 복사`가 지원되지 않는 환경에서는 직접 복사할 링크를 표시합니다.
- 선수 상세 상단의 `선수 카드 만들기`에서 프로필 사진·등번호·포지션과 통산 기록을 담은 1080×1440 PNG를 생성합니다. `에디토리얼`, `블랙 시그니처`, `클럽 아카이브`, `ARENA 레드`, `챔피언 골드` 중 디자인을 선택한 뒤 `선수 카드 PNG 다운로드`를 누릅니다. 에디토리얼은 아이보리 매거진, 블랙 시그니처는 흑백 포트레이트, 클럽 아카이브는 딥 그린 티켓 구성이며, 미리보기와 다운로드에 같은 디자인을 사용합니다. 사진이 없거나 로딩에 실패하면 이름·등번호 기반 디자인으로 저장하며, 기록은 상세 페이지와 같은 완료 경기 집계를 사용합니다.
- 선수 카드의 `카드 사진`에서 `기존 프로필`, `팔짱`, `화이팅`을 선택합니다. 준비된 ARENA FC 포즈 사진은 `public/images/player-portraits/20261005/manifest.json`의 선수 ID별 경로로 연결되며, 전신이 잘리지 않도록 다섯 디자인에 맞춰 배치합니다. 준비된 포즈가 없는 선수는 기존 프로필만 표시합니다. 선택한 사진은 미리보기와 PNG 저장에 동일하게 적용되고 원본 프로필은 변경하지 않습니다.
- 스포츠 웹툰풍의 `카툰 팔짱`, `카툰 화이팅`도 같은 사진 선택 영역에서 고를 수 있습니다. 카툰은 `public/images/player-cartoons/20261005/manifest.json`으로 연결하며, 선수별 얼굴 특징·ARENA FC 유니폼·등번호를 반영한 투명 PNG를 사용합니다. 생성 프롬프트와 원본 경로는 `docs/design-previews/player-cartoons-20261005/generation-manifest.json`에 기록합니다.
- 카툰 25명·50장 모음은 `/images/player-cartoons/20261005/index.html`에서 확인하고 내려받을 수 있습니다. 참고 사진이 없는 활성 선수 2명(이상헌·김성년)은 제외되어 있습니다.
- 선수·경기 카드의 `사진으로 저장`은 지원되는 브라우저에서 파일 공유 메뉴를 열고, 지원되지 않거나 HTTP로 접속한 경우 서버의 일반 PNG 이미지로 저장 안내를 표시합니다. 이미지를 길게 누르거나 `PNG 파일 받기` / `이미지 크게 열기`를 사용할 수 있습니다. 저장용 PNG는 최대 30분간 서버 메모리에만 보관하며, 원본 사진이나 DB를 변경하지 않습니다. 서버 재시작 후에는 이미지를 다시 준비하면 됩니다.
- 웹 기능이며 DB 마이그레이션, 외부 이미지 생성 서비스, Flutter 변경은 필요하지 않습니다. 집계 회귀 검증: `npm run test:web-features`.

## 경기 관리

### 로그인 없는 MOM 투표

진행 중인 경기의 상세 또는 관리자 수정 화면에서 `투표 링크 복사`를 눌러 카카오톡·문자로 전달합니다. `/matches/[id]/mom-vote`에서 현재 출전 명단의 각 팀 선수 1명씩을 선택해 한 번에 제출합니다. 링크는 `NEXT_PUBLIC_SITE_URL`을 기준으로 생성되므로 외부에서 접근 가능한 주소를 설정해야 합니다. HTTP 등 클립보드를 사용할 수 없는 환경에서는 직접 복사할 링크를 표시합니다.

- 경기별 IP당 한 번만 제출할 수 있고 제출 후 변경은 불가합니다. 같은 와이파이·통신사 공유 IP에서는 여러 사람이 하나의 IP로 인식될 수 있으며, 네트워크 변경이나 VPN으로 다른 IP를 쓰는 사람까지 식별하지는 못합니다.
- 투표 DB에는 원본 IP 대신 경기 ID를 포함한 HMAC-SHA256 값을 저장합니다. `MOM_VOTE_SECRET`에 32자 이상의 무작위 비밀값을 한 번 설정하고 유지해야 합니다. 변경하면 기존 투표자를 같은 IP로 인식하지 못하므로 투표 진행 중에는 교체하지 않습니다.
- `MomBallot`의 경기 ID·IP 해시 유일 제약으로 동시 요청·새로고침·서버 재시작에 따른 중복을 막습니다. 경기 상태와 출전 명단은 제출 시 DB 트랜잭션에서 다시 확인합니다. 경기 결과를 등록 완료로 바꾸면 새 투표는 마감되고, 다시 진행 중으로 바꾸면 기존 투표를 유지한 채 재개됩니다.
- 투표는 공식 MOM과 선수 통계를 자동으로 변경하지 않습니다. 관리자 경기 수정 화면의 `MOM 투표 결과`에서 팀별 득표수를 보고 기존 MOM 체크박스를 선택해 저장합니다. 동률·공동 MOM은 운영자가 결정합니다. 투표 후 출전 명단에서 빠지거나 팀이 바뀐 선수의 표는 해당 팀 집계에서 제외되며, 기존 투표자의 재투표는 허용되지 않습니다.
- 직접 접속 또는 공유기 포트 포워딩은 `MOM_VOTE_TRUSTED_PROXY_IPS`를 비워둡니다. 서버의 실제 TCP 접속 IP를 사용하므로 임의의 `X-Forwarded-For`로 중복 제한을 우회할 수 없습니다. 리버스 프록시를 쓰는 경우에만 신뢰할 프록시의 정확한 IP들을 쉼표로 설정합니다. 프록시는 `X-Forwarded-For`를 실제 접속 IP로 덮어쓰거나 오른쪽에 추가해야 합니다. 서버는 오른쪽부터 신뢰 프록시를 제거하고 첫 비신뢰 IP를 사용합니다. `*`나 CIDR은 지원하지 않습니다.
- 투표 API는 실제 연결 주소를 확인하기 위해 Pages API의 `/api/matches/[id]/mom-vote`를 사용하며, 화면은 기존 App Router에 있습니다. GET은 후보·투표 여부만 반환하고 득표 집계는 관리자 화면에서만 보여줍니다.

배포 전에 `20261013000000_add_mom_ballots` 마이그레이션을 적용합니다. 검증은 `npm run test:mom`으로 실행합니다. HTTP·DB 통합 검증은 운영 DB와 분리된 `arena_mom_test_*` DB에 마이그레이션을 적용하고 동일 DB를 사용하는 로컬 서버를 띄운 뒤 `ALLOW_MOM_TEST_DB=1 MOM_TEST_URL=http://127.0.0.1:3107 npm run test:mom:integration`으로 실행합니다. 서버와 테스트에는 같은 `MOM_VOTE_SECRET`을 설정합니다.

관리자는 `/abcd`에서 등록된 경기의 `수정`, `삭제` 버튼을 사용할 수 있습니다. 삭제 시 브라우저 확인창을 거친 뒤 경기와 연결된 참가 기록, 득점, MOM 기록이 함께 삭제됩니다.

경기 MOM은 팀별로 여러 명을 저장할 수 있습니다.

- A팀 MOM: A팀 선수 중 0명 이상
- B팀 MOM: B팀 선수 중 0명 이상

관리자 경기 등록 및 수정 화면에서 팀별 MOM 체크박스를 선택합니다. 선택하지 않으면 MOM 없음으로 표시됩니다.

관련 API는 다음 경로를 사용합니다.

- `GET /api/matches/[id]`
- `PUT /api/matches/[id]` 관리자만 가능
- `DELETE /api/matches/[id]` 관리자만 가능

### 접속 로그

관리자 페이지의 `접속 로그` 버튼(`/abcd/access-logs`)에서 방문 기록을 확인합니다. 오늘·최근 7일 페이지뷰와 방문 IP 수, 많이 접속한 IP, 많이 본 페이지, 상세 기록(접속 시간·IP·페이지·기기/브라우저·유입 경로)을 보여주며 기간·IP·경로·관리자 접속 제외로 필터링할 수 있습니다. 시간은 한국 시간 기준입니다.

- 브라우저가 페이지를 열 때마다(화면 내 이동 포함) `POST /api/access-log`로 한 건을 기록합니다. JavaScript를 실행하지 않는 봇·링크 미리보기 요청은 기록되지 않습니다. 같은 IP의 같은 페이지 3초 내 반복은 한 번으로, IP당 분당 30건까지만 저장합니다.
- IP는 MOM 투표와 같은 방식으로 실제 TCP 접속 주소를 사용하므로 `X-Forwarded-For` 위조로 바꿀 수 없습니다. 리버스 프록시를 쓰는 경우 `MOM_VOTE_TRUSTED_PROXY_IPS` 설정이 접속 로그에도 적용됩니다. 프록시 뒤에서 이 값을 비워두면 모든 접속이 프록시 IP로 기록됩니다.
- 원본 IP를 저장하므로 `ACCESS_LOG_RETENTION_DAYS`(기본 90일)가 지난 기록은 자동 삭제됩니다.
- 배포 전에 `20261020000000_add_access_logs` 마이그레이션을 적용합니다. 검증: `npm run test:access-logs`.

## 다음 단계

local MVP가 안정화되면 PostgreSQL 백업 자동화, Naver Cloud 배포, Nginx/PM2 운영 설정을 다음 단계로 확장할 수 있습니다.

## Flutter Android / iOS 앱

`mobile/`에 네이티브 Flutter 앱과 `/api/v1/*` 모바일 API를 추가했습니다. 외부 IP로 개발 테스트할 수 있습니다. 서버 마이그레이션, 실행, 배포 절차는 [모바일 설계 및 출시 가이드](docs/MOBILE.md)를 참고하세요.

## 개발 서버와 운영 서버의 빌드 분리

`npm run dev`는 `.next-dev`, `npm run build` / `npm run start`는 `.next`를 사용합니다. 개발 서버가 운영 빌드를 덮어쓰지 않도록 기본 경로를 분리했습니다. 특정 검증/배포 경로가 필요하면 빌드와 실행에 같은 `NEXT_DIST_DIR`을 지정하세요. 운영 중인 빌드 디렉터리에 다시 빌드하지 말고 새 디렉터리에서 검증한 뒤 서버를 전환해야 합니다.

`./scripts/start-production.sh`는 `BUILD_ID`가 있는 완성된 빌드인지 확인한 후 서버를 실행합니다. 접속 인터페이스는 `ARENA_BIND_HOST`로 지정하고 기본값은 `0.0.0.0`입니다.
