import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/api.dart';
import '../core/widgets.dart';
import 'browse.dart';
import 'editor.dart';

class ConnectionScreen extends StatefulWidget {
  const ConnectionScreen(this.api, {super.key});
  final ArenaApi api;
  @override
  State<ConnectionScreen> createState() => _ConnectionScreenState();
}

class _ConnectionScreenState extends State<ConnectionScreen> {
  late final TextEditingController address;
  bool busy = false;
  String? error;
  @override
  void initState() {
    super.initState();
    address = TextEditingController(
      text: widget.api.server?.toString() ?? ArenaApi.configuredServer,
    );
    error = widget.api.startupError;
  }

  @override
  void dispose() {
    address.dispose();
    super.dispose();
  }

  Future<void> connect() async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await widget.api.connect(address.text);
      if (mounted && Navigator.canPop(context)) Navigator.pop(context);
    } catch (e) {
      if (mounted) {
        setState(
          () => error = e is ApiException
              ? e.message
              : '연결하지 못했습니다. 서버 주소와 네트워크를 확인해주세요.',
        );
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('ARENA FC')),
    body: Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 520),
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.all(28),
          children: [
            const Icon(Icons.sports_soccer, size: 64, color: lime),
            const SizedBox(height: 24),
            const Text(
              '우리 팀의 기록을\n연결하세요.',
              style: TextStyle(fontSize: 32, fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 16),
            Text(
              kReleaseMode ? '서버 연결 설정을 확인해주세요.' : '외부 IP 또는 도메인으로 접속할 수 있습니다.\n예: http://123.123.123.123:3000',
            ),
            const SizedBox(height: 24),
            TextField(
              controller: address,
              enabled: !busy && !kReleaseMode,
              autocorrect: false,
              keyboardType: TextInputType.url,
              decoration: const InputDecoration(
                labelText: '서버 주소',
                hintText: 'http://IP:포트',
              ),
            ),
            if (error != null)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 16),
                child: Text(
                  error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: busy ? null : connect,
              child: Text(busy ? '연결 확인 중…' : '연결하기'),
            ),
            if (!kReleaseMode)
              const Padding(
                padding: EdgeInsets.only(top: 18),
                child: Text(
                  '개발용 HTTP 연결에서는 로그인 정보가 암호화되지 않습니다. 테스트 계정으로 확인해주세요.',
                  style: TextStyle(color: Colors.white60, fontSize: 12),
                ),
              ),
          ],
        ),
      ),
    ),
  );
}

class AdminScreen extends StatelessWidget {
  const AdminScreen(this.api, {super.key});
  final ArenaApi api;
  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: api,
    builder: (context, _) {
      if (!api.loggedIn) return LoginForm(api);
      return DataView(
        load: () =>
            api.request('GET', 'players', query: {'includeInactive': 'true'}),
        builder: (data, refresh) => ListView(
          padding: const EdgeInsets.all(20),
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            SectionTitle(
              '${api.admin!['username']} 관리자',
              subtitle: '경기와 선수 기록을 관리합니다.',
            ),
            Wrap(
              spacing: 12,
              runSpacing: 8,
              children: [
                FilledButton.icon(
                  onPressed: () => openPage(context, MatchEditor(api)),
                  icon: const Icon(Icons.add),
                  label: const Text('경기 등록'),
                ),
                OutlinedButton.icon(
                  onPressed: () async {
                    await openPage(context, PlayerEditor(api));
                    await refresh();
                  },
                  icon: const Icon(Icons.person_add_alt),
                  label: const Text('선수 등록'),
                ),
                TextButton(
                  onPressed: () async {
                    try {
                      await api.logout();
                    } catch (e) {
                      if (context.mounted) notice(context, e);
                    }
                  },
                  child: const Text('로그아웃'),
                ),
              ],
            ),
            const SectionTitle('선수 관리'),
            ...rows(data['players']).map(
              (p) => Card(
                child: ListTile(
                  leading: PlayerAvatar(api: api, player: p),
                  title: Text(
                    '${p['name']}${p['isActive'] == false ? ' · 비활성' : ''}',
                  ),
                  subtitle: Text('${p['position']}'),
                  onTap: () async {
                    await openPage(context, PlayerEditor(api, player: p));
                    await refresh();
                  },
                  trailing: IconButton(
                    tooltip: '선수 삭제',
                    icon: const Icon(Icons.delete_outline),
                    onPressed: () async {
                      if (!await confirm(
                        context,
                        '${p['name']} 선수를 삭제할까요? 경기 기록이 있으면 삭제할 수 없습니다.',
                      )) {
                        return;
                      }
                      try {
                        await api.request('DELETE', 'players/${p['id']}');
                        await refresh();
                      } catch (e) {
                        if (context.mounted) notice(context, e);
                      }
                    },
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              '경기 수정·삭제와 포스터 등록은 경기 상세 화면에서 할 수 있습니다.',
              style: TextStyle(color: Colors.white60),
            ),
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: () => openPage(
                context,
                Scaffold(
                  appBar: AppBar(title: const Text('경기 관리')),
                  body: MatchesScreen(api),
                ),
              ),
              child: const Text('경기 관리 열기'),
            ),
          ],
        ),
      );
    },
  );
}

class LoginForm extends StatefulWidget {
  const LoginForm(this.api, {super.key});
  final ArenaApi api;
  @override
  State<LoginForm> createState() => _LoginFormState();
}

class _LoginFormState extends State<LoginForm> {
  final username = TextEditingController(), password = TextEditingController();
  bool busy = false;
  String? error;
  @override
  void dispose() {
    username.dispose();
    password.dispose();
    super.dispose();
  }

  Future<void> login() async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await widget.api.login(username.text.trim(), password.text);
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(24),
    children: [
      const SectionTitle('관리자 로그인', subtitle: '일반 기록은 로그인 없이 볼 수 있습니다.'),
      AutofillGroup(
        child: Column(
          children: [
            TextField(
              controller: username,
              enabled: !busy,
              autofillHints: const [AutofillHints.username],
              decoration: const InputDecoration(labelText: '아이디'),
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: 16),
            TextField(
              controller: password,
              enabled: !busy,
              obscureText: true,
              autocorrect: false,
              enableSuggestions: false,
              autofillHints: const [AutofillHints.password],
              decoration: const InputDecoration(labelText: '비밀번호'),
              onSubmitted: (_) {
                if (!busy) login();
              },
            ),
          ],
        ),
      ),
      if (error != null)
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Text(
            error!,
            style: TextStyle(color: Theme.of(context).colorScheme.error),
          ),
        ),
      const SizedBox(height: 24),
      FilledButton(
        onPressed: busy ? null : login,
        child: Text(busy ? '로그인 중…' : '로그인'),
      ),
    ],
  );
}

class SettingsScreen extends StatelessWidget {
  const SettingsScreen(this.api, {super.key});
  final ArenaApi api;
  Future<void> launch(BuildContext context, String url) async {
    try {
      final uri = Uri.parse(url);
      if (uri.scheme != 'https' ||
          !await launchUrl(uri, mode: LaunchMode.externalApplication)) {
        throw const ApiException('페이지를 열 수 없습니다.');
      }
    } catch (e) {
      if (context.mounted) notice(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    const privacy = String.fromEnvironment('PRIVACY_POLICY_URL');
    const support = String.fromEnvironment('SUPPORT_URL');
    return Scaffold(
      appBar: AppBar(title: const Text('설정 및 안내')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const SectionTitle('ARENA FC', subtitle: '우리 팀의 경기와 선수 기록'),
          if (!kReleaseMode)
            ListTile(
              leading: const Icon(Icons.dns_outlined),
              title: const Text('서버 연결 변경'),
              subtitle: Text('${api.server}'),
              onTap: () => openPage(context, ConnectionScreen(api)),
            ),
          if (privacy.isNotEmpty)
            ListTile(
              leading: const Icon(Icons.privacy_tip_outlined),
              title: const Text('개인정보 처리방침'),
              onTap: () => launch(context, privacy),
            ),
          if (support.isNotEmpty)
            ListTile(
              leading: const Icon(Icons.help_outline),
              title: const Text('운영자 문의'),
              onTap: () => launch(context, support),
            ),
          ListTile(
            leading: const Icon(Icons.info_outline),
            title: const Text('오픈소스 라이선스'),
            onTap: () =>
                showLicensePage(context: context, applicationName: 'ARENA FC'),
          ),
          const Padding(
            padding: EdgeInsets.all(16),
            child: Text(
              '선수 정보와 경기 기록의 수정·삭제는 팀 운영자에게 요청해주세요.\n\n기간 빠른 선택은 기존 클럽 운영 기준(상반기 1~5월, 하반기 6~11월)을 따릅니다.',
              style: TextStyle(color: Colors.white60),
            ),
          ),
        ],
      ),
    );
  }
}
