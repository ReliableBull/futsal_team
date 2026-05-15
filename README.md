# ARENA Futsal Record

동호회 풋살 경기 결과를 기록하고, 선수별 기록과 랭킹을 확인할 수 있는 local MVP 웹 서비스입니다. 인증, 결제, 멀티 클럽, 이미지 업로드, 배포 설정은 이번 단계에서 제외했습니다.

## 기술 스택

- Next.js App Router
- TypeScript
- Tailwind CSS
- Prisma ORM
- SQLite
- React Server Components
- Server Actions

## 로컬 실행 방법

```bash
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev
```

실행 후 브라우저에서 `http://localhost:3000`에 접속합니다.

## Prisma migrate 방법

`.env`의 `DATABASE_URL`은 기본값으로 SQLite `dev.db`를 사용합니다.

```bash
npx prisma migrate dev
```

새로운 모델 변경 후에는 migration 이름을 입력하면 Prisma가 migration 파일과 SQLite DB를 갱신합니다.

## Seed 데이터 입력 방법

```bash
npx prisma db seed
```

기본 선수 12명과 테스트 경기 3개가 생성됩니다. Seed는 기존 선수, 경기, 참가 기록을 삭제한 뒤 다시 입력합니다.
관리자 계정도 함께 생성됩니다.

- 아이디: `admin`
- 비밀번호: `dlGhwns12!`

## 주요 페이지 경로

- `/` 메인 페이지
- `/players` 선수 목록
- `/players/[id]` 선수 상세
- `/matches` 경기 목록
- `/matches/[id]` 경기 상세
- `/admin/login` 관리자 로그인
- `/admin` 관리자 페이지
- `/admin/matches/[id]/edit` 경기 수정

## 경기 관리

관리자는 `/admin`에서 등록된 경기의 `수정`, `삭제` 버튼을 사용할 수 있습니다. 삭제 시 브라우저 확인창을 거친 뒤 경기와 연결된 참가 기록, 득점, MVP 기록이 함께 삭제됩니다.

경기 MVP는 2명으로 저장됩니다.

- 회장팀 MVP: 회장팀 선수 중 1명
- 총무팀 MVP: 총무팀 선수 중 1명

관련 API는 다음 경로를 사용합니다.

- `GET /api/matches/[id]`
- `PUT /api/matches/[id]` 관리자만 가능
- `DELETE /api/matches/[id]` 관리자만 가능

## 다음 단계

local MVP가 안정화되면 PostgreSQL 전환, Naver Cloud 배포, Nginx/PM2 운영 설정을 다음 단계로 확장할 수 있습니다.
