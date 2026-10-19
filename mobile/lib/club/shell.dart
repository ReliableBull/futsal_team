import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/api.dart' show ArenaApi;
import '../features/settings.dart' show ConnectionScreen;
import '../main.dart' show ArenaShell;
import 'auth.dart';
import 'bookings.dart';
import 'club_api.dart';
import 'club_manage.dart';
import 'clubs.dart';
import 'ui.dart';
import 'venues.dart';

/// Main navigation. The first screen is always public browsing; no login gate.
class AppShell extends StatefulWidget {
  const AppShell({super.key, required this.api, required this.legacy});
  final ClubApi api;
  final ArenaApi legacy;
  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int index = 0;

  @override
  void initState() {
    super.initState();
    // Resume an invite that was opened before the app was closed (e.g. while
    // the user was away logging in).
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final pending = widget.api.pendingInvite;
      if (pending != null && mounted) openPage(context, InviteScreen(widget.api, pending));
    });
  }

  void go(int i) => setState(() => index = i);

  @override
  Widget build(BuildContext context) {
    const titles = ['ARENA CLUB', '동호회', '풋살장', '내 예약', '마이페이지'];
    return Scaffold(
      appBar: AppBar(title: Text(titles[index], style: const TextStyle(fontWeight: FontWeight.w900, letterSpacing: 1))),
      body: SafeArea(
        child: switch (index) {
          0 => HomeTab(widget.api, onNavigate: go),
          1 => ClubsTab(widget.api),
          2 => VenuesTab(widget.api),
          3 => MyBookingsTab(widget.api),
          _ => MyPageTab(widget.api, widget.legacy),
        },
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: go,
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: '홈'),
          NavigationDestination(icon: Icon(Icons.groups_outlined), selectedIcon: Icon(Icons.groups), label: '동호회'),
          NavigationDestination(icon: Icon(Icons.stadium_outlined), selectedIcon: Icon(Icons.stadium), label: '풋살장'),
          NavigationDestination(icon: Icon(Icons.event_note_outlined), selectedIcon: Icon(Icons.event_note), label: '내 예약'),
          NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: '마이'),
        ],
      ),
    );
  }
}

class HomeTab extends StatelessWidget {
  const HomeTab(this.api, {super.key, required this.onNavigate});
  final ClubApi api;
  final ValueChanged<int> onNavigate;

  @override
  Widget build(BuildContext context) => AsyncView(
        load: () async {
          final results = await Future.wait([api.request('GET', 'clubs'), api.request('GET', 'venues')]);
          return {'clubs': results[0]['clubs'], 'venues': results[1]['venues']};
        },
        builder: (data, refresh) => ListView(
          padding: const EdgeInsets.all(16),
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            Container(
              padding: const EdgeInsets.all(22),
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [Color(0xFF243B25), Color(0xFF151D26)]),
                borderRadius: BorderRadius.circular(24),
              ),
              child: const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('PLAY. RECORD. BOOK.', style: TextStyle(color: lime, fontSize: 11, letterSpacing: 2)),
                SizedBox(height: 10),
                Text('동호회 기록부터\n구장 예약까지.', style: TextStyle(fontSize: 28, height: 1.2, fontWeight: FontWeight.w900)),
                SizedBox(height: 10),
                Text('로그인 없이 둘러보고 예약할 수 있어요.', style: TextStyle(color: Colors.white60)),
              ]),
            ),
            const SizedBox(height: 12),
            Row(children: [
              for (final (i, icon, label) in [(1, Icons.groups, '동호회 찾기'), (2, Icons.stadium, '구장 예약'), (3, Icons.event_note, '내 예약')])
                Expanded(
                  child: Card(
                    child: InkWell(
                      borderRadius: BorderRadius.circular(18),
                      onTap: () => onNavigate(i),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        child: Column(children: [Icon(icon, color: lime), const SizedBox(height: 6), Text(label)]),
                      ),
                    ),
                  ),
                ),
            ]),
            ListenableBuilder(
              listenable: api,
              builder: (context, _) {
                final mine = api.approvedMemberships;
                if (mine.isEmpty) return const SizedBox.shrink();
                return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const SectionTitle('내 동호회'),
                  for (final m in mine)
                    Card(
                      child: ListTile(
                        leading: NetImage(api, m['logoUrl'], label: '${m['clubName']}', round: false),
                        title: Text('${m['clubName']}'),
                        subtitle: Text(roleLabels[m['role']] ?? ''),
                        trailing: m['isDemo'] == true ? const DemoBadge() : null,
                        onTap: () => openPage(context, ClubScreen(api, m['clubId'] as int)),
                      ),
                    ),
                ]);
              },
            ),
            const SectionTitle('동호회 둘러보기'),
            for (final c in rows(data['clubs']).take(4)) ClubCard(api, c),
            const SectionTitle('풋살장'),
            for (final v in rows(data['venues']).take(3)) VenueCard(api, v),
          ],
        ),
      );
}

class MyPageTab extends StatelessWidget {
  const MyPageTab(this.api, this.legacy, {super.key});
  final ClubApi api;
  final ArenaApi legacy;

  Future<void> launch(BuildContext context, String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null || uri.scheme != 'https' || !await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      if (context.mounted) notice(context, '페이지를 열 수 없습니다.');
    }
  }

  @override
  Widget build(BuildContext context) {
    const privacy = String.fromEnvironment('PRIVACY_POLICY_URL');
    const support = String.fromEnvironment('SUPPORT_URL');
    return ListenableBuilder(
      listenable: api,
      builder: (context, _) => ListView(padding: const EdgeInsets.all(16), children: [
        if (!api.loggedIn)
          Card(
            child: ListTile(
              leading: const Icon(Icons.login),
              title: const Text('로그인'),
              subtitle: const Text('동호회 개설·가입, 회원 전용 기록 이용 시 필요합니다.'),
              onTap: () => requireLogin(context, api, reason: '로그인'),
            ),
          )
        else ...[
          Card(
            child: ListTile(
              leading: const Icon(Icons.account_circle, size: 40),
              title: Text('${api.account!['displayName']}'),
              subtitle: Text(api.account!['provider'] == 'dev' ? '개발용 테스트 계정' : '카카오 계정'),
              trailing: TextButton(onPressed: () => guarded(context, api.logout), child: const Text('로그아웃')),
            ),
          ),
          const SectionTitle('내 동호회', subtitle: '동호회마다 역할이 다릅니다.'),
          if (api.memberships.isEmpty) const EmptyCard('가입한 동호회가 없습니다.'),
          for (final m in api.memberships)
            Card(
              child: ListTile(
                leading: NetImage(api, m['logoUrl'], label: '${m['clubName']}', round: false),
                title: Text('${m['clubName']}'),
                subtitle: Text(m['status'] == 'approved' ? roleLabels[m['role']] ?? '' : membershipLabels[m['status']] ?? ''),
                trailing: m['isDemo'] == true ? const DemoBadge() : null,
                onTap: () => openPage(context, ClubScreen(api, m['clubId'] as int)),
              ),
            ),
        ],
        const SectionTitle('예약 본인 확인'),
        ListTile(
          leading: const Icon(Icons.phone_iphone),
          title: Text(api.hasGuest ? '${api.guestPhone} 인증됨' : '인증된 번호 없음'),
          subtitle: const Text('비회원 예약 조회·취소에 사용됩니다. 회원가입과 별개입니다.'),
          trailing: api.hasGuest ? TextButton(onPressed: api.clearGuest, child: const Text('해제')) : null,
        ),
        const SectionTitle('앱 정보'),
        // The legacy screens call the ARENA website API directly, which a
        // browser blocks (CORS); they are available in the mobile apps.
        if (!kIsWeb) ListTile(
          leading: const Icon(Icons.history_edu_outlined),
          title: const Text('ARENA FC 원본 서버 (기존 기능)'),
          subtitle: const Text('기존 ARENA 웹사이트 API에 연결하는 이전 화면입니다.'),
          onTap: () => openPage(context, LegacyArenaScreen(legacy)),
        ),
        if (!kReleaseMode)
          ListTile(
            leading: const Icon(Icons.dns_outlined),
            title: const Text('동호회 앱 서버 (개발용)'),
            subtitle: Text('${api.server}'),
            onTap: () => openPage(context, ClubServerScreen(api)),
          ),
        if (privacy.isNotEmpty)
          ListTile(leading: const Icon(Icons.privacy_tip_outlined), title: const Text('개인정보 처리방침'), onTap: () => launch(context, privacy)),
        if (support.isNotEmpty)
          ListTile(leading: const Icon(Icons.help_outline), title: const Text('문의'), onTap: () => launch(context, support)),
        ListTile(
          leading: const Icon(Icons.info_outline),
          title: const Text('오픈소스 라이선스'),
          onTap: () => showLicensePage(context: context, applicationName: 'ARENA CLUB'),
        ),
      ]),
    );
  }
}

/// The previous ARENA-only screens, unchanged, behind one entry.
class LegacyArenaScreen extends StatelessWidget {
  const LegacyArenaScreen(this.api, {super.key});
  final ArenaApi api;
  @override
  Widget build(BuildContext context) => ListenableBuilder(
        listenable: api,
        builder: (context, _) => api.server == null ? ConnectionScreen(api) : ArenaShell(api, key: ValueKey(api.server.toString())),
      );
}

class ClubServerScreen extends StatefulWidget {
  const ClubServerScreen(this.api, {super.key});
  final ClubApi api;
  @override
  State<ClubServerScreen> createState() => _ClubServerScreenState();
}

class _ClubServerScreenState extends State<ClubServerScreen> {
  late final controller = TextEditingController(text: '${widget.api.server}');
  String? error;
  bool busy = false;
  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('동호회 앱 서버')),
        body: ListView(padding: const EdgeInsets.all(20), children: [
          const Text('개발 빌드 전용 설정입니다. ARENA 웹사이트 주소가 아니라 mobile/server 앱 서버 주소를 입력합니다.'),
          TextField(controller: controller, decoration: const InputDecoration(labelText: '서버 주소', hintText: 'http://10.0.2.2:8791')),
          if (error != null) Text(error!, style: const TextStyle(color: Colors.redAccent)),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: busy
                ? null
                : () async {
                    setState(() {
                      busy = true;
                      error = null;
                    });
                    try {
                      await widget.api.setServer(controller.text);
                      if (context.mounted) Navigator.pop(context);
                    } catch (e) {
                      setState(() => error = '$e');
                    } finally {
                      if (mounted) setState(() => busy = false);
                    }
                  },
            child: const Text('연결'),
          ),
        ]),
      );
}
