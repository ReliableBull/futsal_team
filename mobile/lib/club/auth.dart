import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import 'club_api.dart';

/// Asks for login only when a member feature is used. Returns true when the
/// user is (now) logged in; false when they cancelled. Because the login
/// screen is pushed on top of the current route, cancelling or finishing
/// returns to exactly where the user was, and the caller continues its action.
Future<bool> requireLogin(BuildContext context, ClubApi api, {required String reason}) async {
  if (api.loggedIn) return true;
  final ok = await Navigator.push<bool>(
      context, MaterialPageRoute(fullscreenDialog: true, builder: (_) => LoginScreen(api, reason: reason)));
  return ok == true && api.loggedIn;
}

const _demoUsers = [
  ('night_owner', '대구 나이트 소유자'),
  ('multi_manager', '나이트 운영진 + 위켄드 일반 회원'),
  ('night_recorder', '나이트 기록 담당자'),
  ('night_member', '나이트·비기너 일반 회원'),
  ('applicant', '나이트·비기너 가입 승인 대기'),
  ('weekend_owner', '칠곡 위켄드 소유자'),
  ('beginner_owner', '수성 비기너 소유자'),
  ('newbie', '가입한 동호회 없음'),
];

class LoginScreen extends StatefulWidget {
  const LoginScreen(this.api, {super.key, required this.reason});
  final ClubApi api;
  final String reason;
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final username = TextEditingController(), password = TextEditingController();
  bool busy = false;
  String? error;

  @override
  void dispose() {
    username.dispose();
    password.dispose();
    super.dispose();
  }

  Future<void> devLogin() async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await widget.api.devLogin(username.text.trim(), password.text);
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
          title: const Text('로그인'),
          leading: IconButton(
              tooltip: '취소', icon: const Icon(Icons.close), onPressed: () => Navigator.pop(context, false)),
        ),
        body: ListenableBuilder(
          listenable: widget.api,
          builder: (context, _) => ListView(
            padding: const EdgeInsets.all(24),
            children: [
              Text(widget.reason, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
              const SizedBox(height: 8),
              const Text('동호회 탐색, 기록 조회, 풋살장 비회원 예약은 로그인 없이 이용할 수 있습니다. '
                  '로그인은 계정만 만들며, 동호회 가입은 별도로 신청합니다.',
                  style: TextStyle(color: Colors.white70)),
              const SizedBox(height: 24),
              FilledButton.icon(
                style: FilledButton.styleFrom(backgroundColor: const Color(0xFFFEE500), foregroundColor: Colors.black87,
                    minimumSize: const Size.fromHeight(52)),
                // The Kakao SDK needs a registered native app key; the server
                // endpoint (/auth/kakao) is ready and verifies tokens.
                onPressed: null,
                icon: const Icon(Icons.chat_bubble),
                label: const Text('카카오로 계속하기'),
              ),
              const Padding(
                padding: EdgeInsets.only(top: 8),
                child: Text('카카오 로그인은 카카오 앱 키 등록 후 활성화됩니다. (현재 빌드에는 미설정)',
                    style: TextStyle(color: Colors.white54, fontSize: 12)),
              ),
              if (widget.api.devLoginAvailable) ...[
                const Divider(height: 40),
                const Row(children: [
                  Icon(Icons.developer_mode, color: Colors.orangeAccent),
                  SizedBox(width: 8),
                  Text('개발·테스트 서버 전용 테스트 계정', style: TextStyle(fontWeight: FontWeight.bold)),
                ]),
                const SizedBox(height: 4),
                const Text('운영 서버와 배포 앱에서는 표시되지 않습니다. 비밀번호: demo1234!',
                    style: TextStyle(color: Colors.white54, fontSize: 12)),
                const SizedBox(height: 8),
                Wrap(spacing: 6, runSpacing: 6, children: [
                  for (final (user, label) in _demoUsers)
                    ActionChip(
                      label: Text(label, style: const TextStyle(fontSize: 12)),
                      onPressed: busy ? null : () => setState(() => username.text = user),
                    ),
                ]),
                const SizedBox(height: 12),
                TextField(controller: username, enabled: !busy, decoration: const InputDecoration(labelText: '테스트 계정 아이디')),
                const SizedBox(height: 12),
                TextField(
                  controller: password,
                  enabled: !busy,
                  obscureText: true,
                  decoration: const InputDecoration(labelText: '비밀번호'),
                  onSubmitted: (_) => busy ? null : devLogin(),
                ),
                if (error != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Text(error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                  ),
                const SizedBox(height: 12),
                OutlinedButton(onPressed: busy ? null : devLogin, child: Text(busy ? '로그인 중…' : '테스트 계정으로 로그인')),
              ] else if (!kReleaseMode)
                const Padding(
                  padding: EdgeInsets.only(top: 24),
                  child: Text('서버에 연결되지 않았거나 테스트 계정이 비활성화된 서버입니다.',
                      style: TextStyle(color: Colors.white54)),
                ),
            ],
          ),
        ),
      );
}
