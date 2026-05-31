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

## 경기 관리

관리자는 `/abcd`에서 등록된 경기의 `수정`, `삭제` 버튼을 사용할 수 있습니다. 삭제 시 브라우저 확인창을 거친 뒤 경기와 연결된 참가 기록, 득점, MVP 기록이 함께 삭제됩니다.

경기 MVP는 2명으로 저장됩니다.

- 회장팀 MVP: 회장팀 선수 중 1명
- 총무팀 MVP: 총무팀 선수 중 1명

관련 API는 다음 경로를 사용합니다.

- `GET /api/matches/[id]`
- `PUT /api/matches/[id]` 관리자만 가능
- `DELETE /api/matches/[id]` 관리자만 가능

## 다음 단계

local MVP가 안정화되면 PostgreSQL 백업 자동화, Naver Cloud 배포, Nginx/PM2 운영 설정을 다음 단계로 확장할 수 있습니다.
