# ARENA Futsal Record

동호회 풋살 경기 결과를 기록하고, 선수별 기록과 랭킹을 확인할 수 있는 local MVP 웹 서비스입니다. 인증, 결제, 멀티 클럽, 이미지 업로드, 배포 설정은 이번 단계에서 제외했습니다.

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

## 다음 단계

local MVP가 안정화되면 PostgreSQL 백업 자동화, Naver Cloud 배포, Nginx/PM2 운영 설정을 다음 단계로 확장할 수 있습니다.

## Flutter Android / iOS 앱

`mobile/`에 네이티브 Flutter 앱과 `/api/v1/*` 모바일 API를 추가했습니다. 외부 IP로 개발 테스트할 수 있습니다. 서버 마이그레이션, 실행, 배포 절차는 [모바일 설계 및 출시 가이드](docs/MOBILE.md)를 참고하세요.

## 개발 서버와 운영 서버의 빌드 분리

`npm run dev`는 `.next-dev`, `npm run build` / `npm run start`는 `.next`를 사용합니다. 개발 서버가 운영 빌드를 덮어쓰지 않도록 기본 경로를 분리했습니다. 특정 검증/배포 경로가 필요하면 빌드와 실행에 같은 `NEXT_DIST_DIR`을 지정하세요. 운영 중인 빌드 디렉터리에 다시 빌드하지 말고 새 디렉터리에서 검증한 뒤 서버를 전환해야 합니다.

`./scripts/start-production.sh`는 `BUILD_ID`가 있는 완성된 빌드인지 확인한 후 서버를 실행합니다. 접속 인터페이스는 `ARENA_BIND_HOST`로 지정하고 기본값은 `0.0.0.0`입니다.
