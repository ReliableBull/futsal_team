# ARENA CLUB 모바일 (동호회 · 풋살장 예약)

여러 동호회의 경기 기록·선수 통계·조합 분석·명예의 전당과 풋살장 비회원 예약을 제공하는 Flutter 앱입니다.
처음 실행하면 로그인 없이 홈 · 동호회 · 풋살장 · 내 예약 · 마이 탭을 이용할 수 있고, 동호회 개설·가입 같은 회원 기능을 누를 때만 로그인을 요청합니다.

- 새 기능의 백엔드는 ARENA 웹사이트와 분리된 `server/`(Dart + SQLite)입니다. 실행·데이터 가져오기·예시 데이터·정책은 [server/README.md](server/README.md)를 보세요.
- ARENA FC 실제 기록은 첫 번째 기존 동호회로 가져와 표시하고, 예시 동호회·예시 풋살장에는 "예시" 배지가 붙습니다.
- 이전 ARENA 전용 화면(아래 설명)은 마이 → "ARENA FC 원본 서버 (기존 기능)"에서 그대로 사용할 수 있습니다.

```bash
cd server && dart run bin/import_arena.dart && dart run bin/seed_demo.dart && dart run bin/server.dart
cd .. && flutter run --dart-define=CLUB_API_BASE_URL=http://10.0.2.2:8791 --dart-define=API_BASE_URL=http://49.143.102.211:3932
flutter analyze && flutter test          # 앱 (서버를 프로세스 안에서 띄우는 종단 테스트 포함)
cd server && dart test                   # 서버
```

---

## 이전 ARENA 전용 화면

기존 Next.js/PostgreSQL 서버에 연결하는 Android/iOS Flutter 앱입니다.
설계, API, 운영 서버 배포, 스토어 출시 절차는 [모바일 가이드](../docs/MOBILE.md)를 참고하세요.

현재 ARENA 서버 주소가 포함된 APK는 다음 명령으로 생성합니다. 이 빌드는 앱 실행 시 `http://49.143.102.211:3932`에 자동 연결되므로 서버 주소를 입력하지 않습니다.

```bash
flutter build apk --debug --dart-define-from-file=config/arena.json
```

다른 서버에 연결하며 개발하려는 경우:

```bash
flutter pub get
flutter run --dart-define=API_BASE_URL=http://외부IP:3000
```

개발 빌드에서는 주소를 생략한 뒤 앱 첫 화면에 IP 주소를 입력해도 됩니다.
Android Emulator의 개발 PC 주소는 `http://10.0.2.2:3000`입니다.
앱에는 DB 주소나 비밀번호를 넣지 않습니다.

```bash
flutter analyze
flutter test
flutter build apk --debug
```

배포 시 `config/production.example.json`을 `config/production.local.json`으로 복사하고 실제 HTTPS 주소를 입력하세요.

```bash
./tool/release.sh android
./tool/release.sh ios
```
