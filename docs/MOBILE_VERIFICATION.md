# 모바일 구현 검증 결과

검증일: 2026-09-22

| 항목 | 결과 |
|---|---|
| Flutter 3.47.4 / Dart 3.13.3 정적 분석 | 오류·경고 없음 |
| Flutter 테스트 | 9건 통과: 주소 검증, 선수 배정/도움 연결, 기존 도움 보존, 보안 저장/401, 로그아웃 실패, 연결 화면, 재시도, 작은 화면 검색, 경기 폼 검증 |
| TypeScript 검사 / Next ESLint | 통과 |
| 모바일 입력 검증 | 통과 |
| 실제 PostgreSQL API 통합 검증 | HTTP 50건 + DB/통계 assertions 통과 |
| 마이그레이션 | 빈 전용 DB에 기존 3개 + 새 MobileSession 마이그레이션 적용 성공 |
| Next.js 프로덕션 빌드 | 분리 빌드 디렉터리와 테스트 DB로 통과 |
| Android 개발 APK | 생성 성공, 패키지 kr.arenafc.arena_fc, minSdk 24 / targetSdk 36 |
| iOS plist / entitlements 구문 | 통과 |
| iOS 빌드 / 실기기 설치 | 미검증: 현재 Xcode 14.2가 설치된 Flutter 요구 버전에 미달 |
| 외부 IP / LTE 네트워크 | 실제 서버 주소 미제공으로 미검증 |
| 스토어용 서명 / 제출 | 미실행: 소유 계정, 서명키, HTTPS 서버, 개인정보/문의 페이지 필요 |

테스트는 `arena_mobile_test_20260922`라는 별도 로컬 DB에서 수행했습니다. 운영 DB에 마이그레이션을 적용하거나 운영 데이터를 변경하지 않았습니다. 앱이 실제 서버를 이용하려면 먼저 최신 서버 코드와 새 마이그레이션을 배포해야 합니다.

APK: `mobile/build/app/outputs/flutter-apk/app-debug.apk`. 개발 빌드이므로 HTTP IP 주소 입력을 지원하며 스토어 제출용 아티팩트가 아닙니다. 릴리스 빌드 절차와 현재 구현 범위는 [설계/출시 가이드](MOBILE.md)를 참고하세요.
