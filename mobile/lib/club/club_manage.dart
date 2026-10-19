import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';

import 'auth.dart';
import 'club_api.dart';
import 'clubs.dart' show ClubScreen;
import 'ui.dart';

const playerPositions = ['공격수', '공격형미드필더', '미드필더', '수비형미드필더', '윙백', '풀백', '센터백', '골키퍼', 'FP', '피보', '아라', '픽소'];

Future<bool> pickAndUpload(BuildContext context, ClubApi api, String path) async {
  try {
    final file = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 2400, imageQuality: 90);
    if (file == null) return false;
    await api.upload(path, await file.readAsBytes(), file.name);
    return true;
  } catch (e) {
    if (context.mounted) notice(context, e);
    return false;
  }
}

// ------------------------------------------------------------------ invites
Future<void> openInviteEntry(BuildContext context, ClubApi api) async {
  final controller = TextEditingController();
  final token = await showDialog<String>(
    context: context,
    builder: (c) => AlertDialog(
      title: const Text('초대 링크로 가입'),
      content: TextField(controller: controller, decoration: const InputDecoration(labelText: '초대 링크 또는 코드 붙여넣기')),
      actions: [
        TextButton(
            onPressed: () async {
              final data = await Clipboard.getData('text/plain');
              controller.text = data?.text ?? '';
            },
            child: const Text('붙여넣기')),
        FilledButton(onPressed: () => Navigator.pop(c, parseInvite(controller.text) ?? ''), child: const Text('확인')),
      ],
    ),
  );
  controller.dispose();
  if (token == null || !context.mounted) return;
  if (token.isEmpty) return notice(context, '초대 링크 형식이 올바르지 않습니다.');
  await openPage(context, InviteScreen(api, token));
}

/// Invite landing page. The token is kept (also across app restarts) until
/// the user finishes or cancels, so logging in never loses the invite.
class InviteScreen extends StatefulWidget {
  const InviteScreen(this.api, this.token, {super.key});
  final ClubApi api;
  final String token;
  @override
  State<InviteScreen> createState() => _InviteScreenState();
}

class _InviteScreenState extends State<InviteScreen> {
  bool busy = false;
  @override
  void initState() {
    super.initState();
    widget.api.setPendingInvite(widget.token);
  }

  Future<void> accept(Json club) async {
    if (!await requireLogin(context, widget.api, reason: '${club['name']} 초대를 수락하려면 로그인하세요')) return;
    if (!mounted) return;
    setState(() => busy = true);
    try {
      final r = await widget.api.request('POST', 'invites/${widget.token}/accept', body: {});
      await widget.api.setPendingInvite(null);
      await widget.api.refreshSession();
      if (!mounted) return;
      final status = (r['membership'] as Json)['status'];
      notice(context, status == 'approved' ? '가입되었습니다.' : '가입 신청을 보냈습니다. 운영진 승인 후 회원이 됩니다.');
      await Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => ClubScreen(widget.api, r['clubId'] as int)));
    } on ClubApiException catch (e) {
      if (!mounted) return;
      if (e.code == 'already_member' || e.code == 'already_pending') await widget.api.setPendingInvite(null);
      if (mounted) notice(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('동호회 초대')),
        body: AsyncView(
          load: () => widget.api.request('GET', 'invites/${widget.token}'),
          builder: (data, refresh) {
            final club = data['club'] as Json?;
            return ListView(padding: const EdgeInsets.all(24), children: [
              if (club != null) ...[
                Text('${club['name']}', style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w900)),
                if (club['isDemo'] == true) const Padding(padding: EdgeInsets.only(top: 6), child: DemoBadge()),
                const SizedBox(height: 8),
                Text('${club['description'] ?? ''}'),
              ],
              const SizedBox(height: 16),
              if (data['valid'] != true)
                Text('${data['problem']}', style: const TextStyle(color: Colors.redAccent))
              else ...[
                Text(data['autoApprove'] == true ? '초대를 수락하면 일반 회원으로 바로 가입됩니다.' : '초대를 수락하면 가입 신청이 접수되고, 운영진 승인 후 회원이 됩니다.'),
                const Text('초대 링크는 운영진 권한을 주지 않습니다.', style: TextStyle(color: Colors.white54, fontSize: 12)),
                const SizedBox(height: 16),
                FilledButton(onPressed: busy || club == null ? null : () => accept(club), child: Text(busy ? '처리 중…' : '초대 수락')),
              ],
              TextButton(
                onPressed: () async {
                  await widget.api.setPendingInvite(null);
                  if (context.mounted) Navigator.pop(context);
                },
                child: const Text('나중에'),
              ),
            ]);
          },
        ),
      );
}

// --------------------------------------------------------------- creation
class CreateClubScreen extends StatefulWidget {
  const CreateClubScreen(this.api, {super.key});
  final ClubApi api;
  @override
  State<CreateClubScreen> createState() => _CreateClubScreenState();
}

class _CreateClubScreenState extends State<CreateClubScreen> {
  final name = TextEditingController(), region = TextEditingController(), description = TextEditingController();
  String visibility = 'public', recordsVisibility = 'members', joinPolicy = 'approval';
  bool busy = false;

  @override
  void dispose() {
    name.dispose();
    region.dispose();
    description.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('동호회 만들기')),
        body: ListView(padding: const EdgeInsets.all(20), children: [
          const Text('동호회는 회원·선수·경기 기록을 관리하는 조직입니다. 한 경기 안의 팀 편성(예: 회장팀/총무팀)은 경기를 만들 때 정합니다.',
              style: TextStyle(color: Colors.white70)),
          const SizedBox(height: 16),
          TextField(controller: name, maxLength: 40, decoration: const InputDecoration(labelText: '동호회 이름 (필수)')),
          TextField(controller: region, maxLength: 40, decoration: const InputDecoration(labelText: '활동 지역 (선택)')),
          TextField(controller: description, maxLength: 1000, maxLines: 3, decoration: const InputDecoration(labelText: '소개 (선택)')),
          const SectionTitle('공개 범위', subtitle: '나중에 설정에서 바꿀 수 있습니다.'),
          VisibilityFields(
            visibility: visibility,
            recordsVisibility: recordsVisibility,
            joinPolicy: joinPolicy,
            onChanged: (v, r, j) => setState(() {
              visibility = v;
              recordsVisibility = r;
              joinPolicy = j;
            }),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: busy
                ? null
                : () async {
                    setState(() => busy = true);
                    try {
                      final r = await widget.api.request('POST', 'clubs', body: {
                        'name': name.text.trim(),
                        'region': region.text.trim(),
                        'description': description.text.trim(),
                        'visibility': visibility,
                        'recordsVisibility': recordsVisibility,
                        'joinPolicy': joinPolicy,
                      });
                      await widget.api.refreshSession();
                      if (context.mounted) Navigator.pop(context, (r['club'] as Json)['id'] as int);
                    } catch (e) {
                      if (context.mounted) notice(context, e);
                    } finally {
                      if (mounted) setState(() => busy = false);
                    }
                  },
            child: Text(busy ? '만드는 중…' : '만들기 (내가 소유자가 됩니다)'),
          ),
        ]),
      );
}

class VisibilityFields extends StatelessWidget {
  const VisibilityFields({super.key, required this.visibility, required this.recordsVisibility, required this.joinPolicy, required this.onChanged});
  final String visibility, recordsVisibility, joinPolicy;
  final void Function(String visibility, String records, String join) onChanged;
  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SegmentedButton<String>(
          segments: const [ButtonSegment(value: 'public', label: Text('공개 동호회')), ButtonSegment(value: 'private', label: Text('비공개'))],
          selected: {visibility},
          onSelectionChanged: (s) => onChanged(s.first, s.first == 'private' ? 'members' : recordsVisibility, joinPolicy),
        ),
        const SizedBox(height: 8),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('경기 기록 비회원 공개'),
          subtitle: Text(visibility == 'private' ? '비공개 동호회는 기록을 승인된 회원에게만 공개합니다.' : '끄면 소개만 공개하고 기록은 회원 전용입니다.'),
          value: recordsVisibility == 'public',
          onChanged: visibility == 'private' ? null : (v) => onChanged(visibility, v ? 'public' : 'members', joinPolicy),
        ),
        SegmentedButton<String>(
          segments: const [ButtonSegment(value: 'approval', label: Text('신청 후 승인')), ButtonSegment(value: 'invite_only', label: Text('초대 링크만'))],
          selected: {joinPolicy},
          onSelectionChanged: (s) => onChanged(visibility, recordsVisibility, s.first),
        ),
      ]);
}

// ------------------------------------------------------------- management
class ClubManageScreen extends StatelessWidget {
  const ClubManageScreen(this.api, this.club, {super.key});
  final ClubApi api;
  final Json club;
  @override
  Widget build(BuildContext context) {
    final viewer = club['viewer'] as Json;
    final perms = viewer['permissions'] as Json;
    final id = club['id'];
    return Scaffold(
      appBar: AppBar(title: Text('${club['name']} 관리')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        Card(
          child: ListTile(
            leading: const Icon(Icons.badge_outlined),
            title: Text('내 역할: ${viewer['role'] == null ? membershipLabels[viewer['status']] ?? '비회원' : roleLabels[viewer['role']]}'),
            subtitle: Text(viewer['linkedPlayerId'] != null
                ? '선수 프로필과 연결됨'
                : viewer['pendingLinkPlayerId'] != null
                    ? '선수 연결 승인 대기'
                    : '선수 목록에서 내 기록을 찾아 연결을 신청할 수 있습니다.'),
          ),
        ),
        if (viewer['status'] == 'approved')
          ListTile(
            leading: const Icon(Icons.groups_outlined),
            title: Text(perms['manageMembers'] == true ? '회원 관리 · 가입 승인' : '회원 목록'),
            onTap: () => openPage(context, MembersScreen(api, club)),
          ),
        if (perms['manageMembers'] == true) ...[
          ListTile(leading: const Icon(Icons.link), title: const Text('초대 링크'), onTap: () => openPage(context, InvitesScreen(api, club))),
          ListTile(
              leading: const Icon(Icons.how_to_reg_outlined),
              title: const Text('선수-계정 연결 신청'),
              onTap: () => openPage(context, LinkRequestsScreen(api, club))),
        ],
        if (perms['managePlayers'] == true)
          ListTile(
            leading: const Icon(Icons.person_add_alt),
            title: const Text('선수 등록'),
            subtitle: const Text('회원가입하지 않은 선수·용병도 등록할 수 있습니다.'),
            onTap: () => openPage(context, PlayerEditScreen(api, club)),
          ),
        if (perms['editClub'] == true)
          ListTile(leading: const Icon(Icons.settings_outlined), title: const Text('동호회 설정'), onTap: () => openPage(context, ClubSettingsScreen(api, club))),
        if (perms['manageMembers'] == true)
          ListTile(leading: const Icon(Icons.history), title: const Text('변경 이력'), onTap: () => openPage(context, AuditScreen(api, id as int))),
        if (club['source'] == 'arena_import')
          ListTile(leading: const Icon(Icons.cloud_download_outlined), title: const Text('데이터 출처·가져오기 검증'),
              onTap: () => openPage(context, SourceScreen(api, id as int))),
        if (viewer['status'] == 'approved' || viewer['status'] == 'pending')
          ListTile(
            leading: const Icon(Icons.logout, color: Colors.redAccent),
            title: Text(viewer['status'] == 'pending' ? '가입 신청 취소' : '동호회 탈퇴'),
            subtitle: viewer['role'] == 'owner' ? const Text('소유자는 소유권을 이전한 뒤 탈퇴할 수 있습니다.') : const Text('지난 경기 기록은 삭제되지 않습니다.'),
            onTap: viewer['role'] == 'owner'
                ? null
                : () async {
                    if (!await confirmAction(context, '정말 진행할까요?', ok: '확인')) return;
                    if (!context.mounted) return;
                    if (await guarded(context, () => api.request('POST', 'clubs/$id/leave'))) {
                      await api.refreshSession();
                      if (context.mounted) Navigator.pop(context);
                    }
                  },
          ),
      ]),
    );
  }
}

class MembersScreen extends StatefulWidget {
  const MembersScreen(this.api, this.club, {super.key});
  final ClubApi api;
  final Json club;
  @override
  State<MembersScreen> createState() => _MembersScreenState();
}

class _MembersScreenState extends State<MembersScreen> {
  int version = 0;
  Future<void> post(String path, Json body, String done) async {
    if (await guarded(context, () => widget.api.request('POST', 'clubs/${widget.club['id']}/$path', body: body))) {
      if (mounted) notice(context, done);
      setState(() => version++);
    }
  }

  @override
  Widget build(BuildContext context) {
    final viewer = widget.club['viewer'] as Json;
    final perms = viewer['permissions'] as Json;
    final myRole = viewer['role'] as String?;
    final rank = {'member': 1, 'recorder': 2, 'manager': 3, 'owner': 4};
    return Scaffold(
      appBar: AppBar(title: const Text('회원')),
      body: AsyncView(
        key: ValueKey(version),
        load: () => widget.api.request('GET', 'clubs/${widget.club['id']}/members'),
        builder: (data, refresh) {
          final members = rows(data['members']);
          return ListView(padding: const EdgeInsets.all(16), children: [
            for (final m in members)
              Card(
                child: ListTile(
                  title: Text('${m['displayName']}'),
                  subtitle: Text([
                    m['status'] == 'approved' ? roleLabels[m['role']] : membershipLabels[m['status']],
                    if (m['linkedPlayer'] != null) '선수: ${(m['linkedPlayer'] as Json)['name']}',
                    if (m['message'] != null) '“${m['message']}”',
                  ].join(' · ')),
                  trailing: perms['manageMembers'] != true || m['accountId'] == widget.api.account?['id']
                      ? null
                      : m['status'] == 'pending'
                          ? Wrap(children: [
                              IconButton(tooltip: '승인', icon: const Icon(Icons.check, color: lime),
                                  onPressed: () => post('members/${m['membershipId']}/decision', {'action': 'approve'}, '승인했습니다.')),
                              IconButton(tooltip: '거절', icon: const Icon(Icons.close),
                                  onPressed: () => post('members/${m['membershipId']}/decision', {'action': 'reject'}, '거절했습니다.')),
                            ])
                          : PopupMenuButton<String>(
                              onSelected: (action) async {
                                if (action == 'transfer') {
                                  if (!await confirmAction(context, '${m['displayName']}님에게 소유권을 넘길까요? 나는 운영진이 됩니다.', ok: '이전')) return;
                                  return post('transfer-ownership', {'membershipId': m['membershipId']}, '소유권을 이전했습니다.');
                                }
                                if (action.startsWith('role:')) {
                                  return post('members/${m['membershipId']}/role', {'role': action.substring(5)}, '역할을 변경했습니다.');
                                }
                                if (!await confirmAction(context, '진행할까요?')) return;
                                return post('members/${m['membershipId']}/status', {'action': action}, '처리했습니다.');
                              },
                              itemBuilder: (_) => [
                                if (m['status'] == 'approved' && m['role'] != 'owner') ...[
                                  if (myRole == 'owner') const PopupMenuItem(value: 'role:manager', child: Text('운영진으로 지정')),
                                  if (m['role'] != 'manager' || myRole == 'owner') ...[
                                    const PopupMenuItem(value: 'role:recorder', child: Text('기록 담당자로 지정')),
                                    const PopupMenuItem(value: 'role:member', child: Text('일반 회원으로 변경')),
                                  ],
                                  if ((rank[m['role']] ?? 0) < (rank[myRole] ?? 0)) ...[
                                    const PopupMenuItem(value: 'remove', child: Text('내보내기')),
                                    const PopupMenuItem(value: 'ban', child: Text('이용 제한')),
                                  ],
                                  if (myRole == 'owner') const PopupMenuItem(value: 'transfer', child: Text('소유권 이전')),
                                ],
                                if (m['status'] == 'banned') const PopupMenuItem(value: 'unban', child: Text('이용 제한 해제')),
                              ],
                            ),
                ),
              ),
          ]);
        },
      ),
    );
  }
}

class InvitesScreen extends StatefulWidget {
  const InvitesScreen(this.api, this.club, {super.key});
  final ClubApi api;
  final Json club;
  @override
  State<InvitesScreen> createState() => _InvitesScreenState();
}

class _InvitesScreenState extends State<InvitesScreen> {
  int version = 0;
  String? lastLink;
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('초대 링크')),
        floatingActionButton: FloatingActionButton.extended(
          onPressed: () async {
            await guarded(context, () async {
              final r = await widget.api.request('POST', 'clubs/${widget.club['id']}/invites', body: {'days': 7});
              lastLink = r['link'] as String;
              await Clipboard.setData(ClipboardData(text: lastLink!));
            });
            setState(() => version++);
          },
          icon: const Icon(Icons.add_link),
          label: const Text('7일짜리 링크 만들기'),
        ),
        body: AsyncView(
          key: ValueKey(version),
          load: () => widget.api.request('GET', 'clubs/${widget.club['id']}/invites'),
          builder: (data, refresh) => ListView(padding: const EdgeInsets.all(16), children: [
            if (lastLink != null)
              Card(
                color: lime.withValues(alpha: 0.12),
                child: ListTile(
                  title: const Text('새 링크를 복사했습니다'),
                  subtitle: SelectableText(lastLink!),
                ),
              ),
            const Text('링크는 생성 직후 한 번만 표시됩니다. 초대로는 일반 회원 권한만 부여됩니다.', style: TextStyle(color: Colors.white54)),
            for (final i in rows(data['invites']))
              Card(
                child: ListTile(
                  title: Text('${i['hint']}… · 사용 ${i['useCount']}${i['maxUses'] == null ? '' : '/${i['maxUses']}'}회'),
                  subtitle: Text(i['problem'] ?? '만료 ${'${i['expiresAt']}'.substring(0, 10)}'),
                  trailing: i['problem'] == null
                      ? TextButton(
                          onPressed: () async {
                            if (await guarded(context, () => widget.api.request('POST', 'clubs/${widget.club['id']}/invites/${i['id']}/revoke'))) {
                              setState(() => version++);
                            }
                          },
                          child: const Text('폐기'),
                        )
                      : null,
                ),
              ),
          ]),
        ),
      );
}

class LinkRequestsScreen extends StatefulWidget {
  const LinkRequestsScreen(this.api, this.club, {super.key});
  final ClubApi api;
  final Json club;
  @override
  State<LinkRequestsScreen> createState() => _LinkRequestsScreenState();
}

class _LinkRequestsScreenState extends State<LinkRequestsScreen> {
  int version = 0;
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('선수-계정 연결 신청')),
        body: AsyncView(
          key: ValueKey(version),
          load: () => widget.api.request('GET', 'clubs/${widget.club['id']}/link-requests'),
          builder: (data, refresh) => ListView(padding: const EdgeInsets.all(16), children: [
            const Text('이름이 같다는 이유만으로 승인하지 말고 본인 여부를 확인한 뒤 승인해주세요.', style: TextStyle(color: Colors.white54)),
            if (rows(data['requests']).isEmpty) const EmptyCard('대기 중인 연결 신청이 없습니다.'),
            for (final r in rows(data['requests']))
              Card(
                child: ListTile(
                  title: Text('${(r['account'] as Json)['displayName']} → 선수 ${(r['player'] as Json)['name']}'),
                  subtitle: Text('신청 ${'${r['requestedAt']}'.substring(0, 10)}'),
                  trailing: Wrap(children: [
                    for (final (action, icon) in [('approve', Icons.check), ('reject', Icons.close)])
                      IconButton(
                        icon: Icon(icon),
                        onPressed: () async {
                          if (await guarded(context, () => widget.api.request('POST',
                              'clubs/${widget.club['id']}/link-requests/${r['id']}/decision', body: {'action': action}))) {
                            setState(() => version++);
                          }
                        },
                      ),
                  ]),
                ),
              ),
          ]),
        ),
      );
}

class AuditScreen extends StatelessWidget {
  const AuditScreen(this.api, this.clubId, {super.key});
  final ClubApi api;
  final int clubId;
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('변경 이력')),
        body: AsyncView(
          load: () => api.request('GET', 'clubs/$clubId/audit'),
          builder: (data, refresh) => ListView(children: [
            if (rows(data['entries']).isEmpty) const EmptyCard('기록된 변경이 없습니다.'),
            for (final e in rows(data['entries']))
              ListTile(dense: true, title: Text('${e['action']} · ${e['targetType']} ${e['targetId'] ?? ''}'),
                  subtitle: Text('${e['actor']} · ${e['createdAt']}')),
          ]),
        ),
      );
}

class SourceScreen extends StatelessWidget {
  const SourceScreen(this.api, this.clubId, {super.key});
  final ClubApi api;
  final int clubId;
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('데이터 출처')),
        body: AsyncView(
          load: () => api.request('GET', 'clubs/$clubId/source'),
          builder: (data, refresh) {
            final run = data['importRun'] as Json?;
            final v = (run?['summary'] as Json?)?['verification'] as Json?;
            return ListView(padding: const EdgeInsets.all(16), children: [
              const Text('ARENA FC 웹사이트의 공개 기록을 읽기 전용으로 한 번 복사했습니다. 자동 양방향 동기화는 하지 않습니다.'),
              const SizedBox(height: 8),
              Text('가져온 시각: ${data['importedAt'] ?? '-'}'),
              if (v != null) ...[
                const SectionTitle('원본 대조'),
                for (final key in ['matches', 'completedMatches', 'appearances', 'goals', 'assists', 'mom', 'goalRows', 'posters'])
                  ListTile(dense: true, title: Text(key), trailing: Text('원본 ${(v['source'] as Json)[key]} / 앱 ${(v['app'] as Json)[key]}')),
                Text('선수 통계 차이 ${(v['playerStatDifferences'] as List).length}명 · 명예의 전당 차이 ${(v['hallOfFameDifferences'] as List).length}개'),
                const SectionTitle('원본 데이터 이상 (수정하지 않음)'),
                for (final a in rows(v['sourceAnomalies'])) Text('· ${a['date'] ?? ''} ${a['issue']}'),
              ],
              const SectionTitle('가져오지 못한 정보'),
              for (final n in ((run?['summary'] as Json?)?['notAvailableFromPublicSource'] as List? ?? [])) Text('· $n'),
            ]);
          },
        ),
      );
}

// ---------------------------------------------------------------- settings
class ClubSettingsScreen extends StatefulWidget {
  const ClubSettingsScreen(this.api, this.club, {super.key});
  final ClubApi api;
  final Json club;
  @override
  State<ClubSettingsScreen> createState() => _ClubSettingsScreenState();
}

class _ClubSettingsScreenState extends State<ClubSettingsScreen> {
  late final name = TextEditingController(text: widget.club['name'] as String?);
  late final region = TextEditingController(text: widget.club['region'] as String?);
  late final description = TextEditingController(text: widget.club['description'] as String?);
  late final note = TextEditingController(text: widget.club['activityNote'] as String?);
  late String visibility = widget.club['visibility'] as String;
  late String records = widget.club['recordsVisibility'] as String;
  late String join = widget.club['joinPolicy'] as String;
  late bool discoverable = widget.club['discoverable'] as bool;
  late int minMatches = widget.club['minWinRateMatches'] as int;
  late List<Json> seasons = rows(widget.club['seasons']);
  bool busy = false;

  @override
  void dispose() {
    for (final c in [name, region, description, note]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> addSeason() async {
    final label = TextEditingController();
    final range = await showDateRangePicker(context: context, firstDate: DateTime(2000), lastDate: DateTime(2100));
    if (range == null || !mounted) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('시즌 이름'),
        content: TextField(controller: label, decoration: const InputDecoration(hintText: '예: 2026 가을 리그')),
        actions: [FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('추가'))],
      ),
    );
    if (ok == true && label.text.trim().isNotEmpty) {
      setState(() => seasons = [
            ...seasons,
            {'label': label.text.trim(), 'startDate': day(range.start.toIso8601String()), 'endDate': day(range.end.toIso8601String())},
          ]);
    }
    label.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('동호회 설정')),
        body: ListView(padding: const EdgeInsets.all(20), children: [
          Row(children: [
            NetImage(widget.api, widget.club['logoUrl'], size: 64, label: '${widget.club['name']}', round: false),
            TextButton(
              onPressed: () async {
                if (await pickAndUpload(context, widget.api, 'clubs/${widget.club['id']}/logo') && context.mounted) {
                  notice(context, '로고를 변경했습니다.');
                }
              },
              child: const Text('로고 변경'),
            ),
          ]),
          TextField(controller: name, decoration: const InputDecoration(labelText: '동호회 이름')),
          TextField(controller: region, decoration: const InputDecoration(labelText: '활동 지역')),
          TextField(controller: note, decoration: const InputDecoration(labelText: '활동 시간 안내')),
          TextField(controller: description, maxLines: 3, decoration: const InputDecoration(labelText: '소개')),
          const SectionTitle('공개 범위'),
          VisibilityFields(
              visibility: visibility,
              recordsVisibility: records,
              joinPolicy: join,
              onChanged: (v, r, j) => setState(() {
                    visibility = v;
                    records = r;
                    join = j;
                  })),
          if (visibility == 'private')
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('검색에 소개 노출'),
              value: discoverable,
              onChanged: (v) => setState(() => discoverable = v),
            ),
          const SectionTitle('시즌', subtitle: '기간 필터에 표시됩니다. 동호회마다 따로 정합니다.'),
          for (final s in seasons)
            ListTile(
              dense: true,
              title: Text('${s['label']}'),
              subtitle: Text('${s['startDate']} ~ ${s['endDate']}'),
              trailing: IconButton(icon: const Icon(Icons.delete_outline), onPressed: () => setState(() => seasons = [...seasons]..remove(s))),
            ),
          TextButton.icon(onPressed: addSeason, icon: const Icon(Icons.add), label: const Text('시즌 추가')),
          const SectionTitle('승률 랭킹 최소 출전'),
          Slider(value: minMatches.toDouble(), min: 1, max: 20, divisions: 19, label: '$minMatches경기',
              onChanged: (v) => setState(() => minMatches = v.round())),
          FilledButton(
            onPressed: busy
                ? null
                : () async {
                    setState(() => busy = true);
                    final ok = await guarded(context, () => widget.api.request('PATCH', 'clubs/${widget.club['id']}', body: {
                          'name': name.text.trim(),
                          'region': region.text.trim(),
                          'description': description.text.trim(),
                          'activityNote': note.text.trim(),
                          'visibility': visibility,
                          'recordsVisibility': records,
                          'joinPolicy': join,
                          'discoverable': visibility == 'public' || discoverable,
                          'seasons': seasons,
                          'minWinRateMatches': minMatches,
                        }));
                    if (mounted) setState(() => busy = false);
                    if (ok && context.mounted) Navigator.pop(context, true);
                  },
            child: const Text('저장'),
          ),
        ]),
      );
}

// ------------------------------------------------------------------ player
class PlayerEditScreen extends StatefulWidget {
  const PlayerEditScreen(this.api, this.club, {super.key, this.player});
  final ClubApi api;
  final Json club;
  final Json? player;
  @override
  State<PlayerEditScreen> createState() => _PlayerEditScreenState();
}

class _PlayerEditScreenState extends State<PlayerEditScreen> {
  late final name = TextEditingController(text: widget.player?['name'] as String?);
  late final nickname = TextEditingController(text: widget.player?['nickname'] as String?);
  late final number = TextEditingController(text: widget.player?['number']?.toString());
  late String? position = playerPositions.contains(widget.player?['position']) ? widget.player!['position'] as String : null;
  late bool guest = widget.player?['isGuest'] == true;
  late bool active = widget.player?['isActive'] != false;
  bool busy = false;

  bool get manager => ((widget.club['viewer'] as Json)['permissions'] as Json)['managePlayers'] == true;

  @override
  void dispose() {
    name.dispose();
    nickname.dispose();
    number.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final editing = widget.player != null;
    return Scaffold(
      appBar: AppBar(title: Text(editing ? '선수 프로필 수정' : '선수 등록')),
      body: ListView(padding: const EdgeInsets.all(20), children: [
        if (editing)
          Row(children: [
            NetImage(widget.api, widget.player!['photoUrl'], size: 64, label: '${widget.player!['name']}'),
            TextButton(
              onPressed: () async {
                if (await pickAndUpload(context, widget.api, 'clubs/${widget.club['id']}/players/${widget.player!['id']}/photo') &&
                    context.mounted) {
                  notice(context, '사진을 변경했습니다.');
                }
              },
              child: const Text('사진 변경'),
            ),
          ]),
        TextField(controller: name, enabled: manager, decoration: const InputDecoration(labelText: '이름')),
        TextField(controller: nickname, decoration: const InputDecoration(labelText: '별명 (동호회별)')),
        DropdownButtonFormField<String>(
          initialValue: position,
          decoration: const InputDecoration(labelText: '포지션'),
          items: [for (final p in playerPositions) DropdownMenuItem(value: p, child: Text(p))],
          onChanged: (v) => setState(() => position = v),
        ),
        if (manager) ...[
          TextField(controller: number, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: '등번호')),
          SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('용병(게스트)'), value: guest, onChanged: (v) => setState(() => guest = v)),
          SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('활동 중'), subtitle: const Text('비활성 선수는 랭킹에서 빠지지만 기록은 보존됩니다.'),
              value: active, onChanged: (v) => setState(() => active = v)),
        ],
        const SizedBox(height: 16),
        FilledButton(
          onPressed: busy
              ? null
              : () async {
                  setState(() => busy = true);
                  final body = {
                    if (manager) 'name': name.text.trim(),
                    'nickname': nickname.text.trim(),
                    'position': position,
                    if (manager) 'number': int.tryParse(number.text.trim()),
                    if (manager) 'isGuest': guest,
                    if (manager) 'isActive': active,
                  };
                  final ok = await guarded(
                      context,
                      () => editing
                          ? widget.api.request('PATCH', 'clubs/${widget.club['id']}/players/${widget.player!['id']}', body: body)
                          : widget.api.request('POST', 'clubs/${widget.club['id']}/players', body: body));
                  if (mounted) setState(() => busy = false);
                  if (ok && context.mounted) Navigator.pop(context, true);
                },
          child: const Text('저장'),
        ),
      ]),
    );
  }
}

// ------------------------------------------------------------ match editor
/// Creates or edits a match: status, team names, roster, per-goal scorer and
/// assist (none / player / unknown for legacy data), MOM and memo.
class MatchEditorScreen extends StatefulWidget {
  const MatchEditorScreen(this.api, this.club, {super.key, this.match});
  final ClubApi api;
  final Json club;
  final Json? match;
  @override
  State<MatchEditorScreen> createState() => _MatchEditorScreenState();
}

class _GoalRow {
  _GoalRow(this.scorer, this.assist);
  int scorer;
  Object? assist; // int player id, null = none, 'UNKNOWN'
}

class _MatchEditorScreenState extends State<MatchEditorScreen> {
  late final m = widget.match;
  late String status = m?['status'] as String? ?? 'scheduled';
  late DateTime date = DateTime.tryParse(m?['matchDate'] as String? ?? '') ?? DateTime.now();
  late final time = TextEditingController(text: m?['startTime'] as String?);
  late final location = TextEditingController(text: m?['location'] as String?);
  late final teamA = TextEditingController(text: m?['teamAName'] as String? ?? '회장팀');
  late final teamB = TextEditingController(text: m?['teamBName'] as String? ?? '총무팀');
  late final memo = TextEditingController(text: m?['memo'] as String?);
  late int scoreA = m?['teamAScore'] as int? ?? 0, scoreB = m?['teamBScore'] as int? ?? 0;
  final Map<int, String> teams = {};
  final Set<int> moms = {};
  final Map<int, int> preservedAssists = {};
  final List<_GoalRow> goals = [];
  Map<int, Json> players = {};
  bool busy = false;

  @override
  void initState() {
    super.initState();
    for (final p in rows(m?['players'])) {
      final id = p['playerId'] as int;
      teams[id] = p['team'] as String;
      if (p['isMom'] == true) moms.add(id);
      preservedAssists[id] = p['assists'] as int;
    }
    // One row per goal; goals without a stored link become "미상".
    final byScorer = <int, List<Json>>{};
    for (final g in rows(m?['goals'])) {
      (byScorer[g['scorerId'] as int] ??= []).add(g);
    }
    for (final p in rows(m?['players'])) {
      final id = p['playerId'] as int;
      final known = byScorer[id] ?? [];
      for (var i = 0; i < (p['goals'] as int); i++) {
        final g = i < known.length ? known[i] : null;
        goals.add(_GoalRow(id, g == null || g['assistKnown'] == false ? 'UNKNOWN' : g['assistId']));
      }
    }
  }

  @override
  void dispose() {
    for (final c in [time, location, teamA, teamB, memo]) {
      c.dispose();
    }
    super.dispose();
  }

  bool get live => status == 'completed' || status == 'in_progress';
  String name(int id) => '${players[id]?['name'] ?? id}';

  Future<void> save() async {
    setState(() => busy = true);
    final anyUnknown = goals.any((g) => g.assist == 'UNKNOWN');
    final ok = await guarded(context, () async {
      final body = {
        'status': status,
        'matchDate': day(date.toIso8601String()),
        'startTime': time.text.trim(),
        'location': location.text.trim(),
        'teamAName': teamA.text.trim(),
        'teamBName': teamB.text.trim(),
        if (live) 'teamAScore': scoreA,
        if (live) 'teamBScore': scoreB,
        'memo': memo.text.trim(),
        if (m != null) 'version': m!['version'],
        'players': [
          for (final e in teams.entries)
            {
              'playerId': e.key,
              'team': e.value,
              'isMom': live && moms.contains(e.key),
              if (anyUnknown && preservedAssists[e.key] != null) 'assists': preservedAssists[e.key],
            }
        ],
        'goals': live ? [for (final g in goals) {'scorerId': g.scorer, 'assistId': g.assist}] : [],
      };
      if (m == null) {
        await widget.api.request('POST', 'clubs/${widget.club['id']}/matches', body: body);
      } else {
        await widget.api.request('PUT', 'clubs/${widget.club['id']}/matches/${m!['id']}', body: body);
      }
    });
    if (mounted) setState(() => busy = false);
    if (ok && mounted) Navigator.pop(context, true);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: Text(m == null ? '경기 만들기' : '경기 기록 입력·수정')),
        body: AsyncView(
          load: () => widget.api.request('GET', 'clubs/${widget.club['id']}/players', query: {'includeInactive': 'true'}),
          builder: (data, refresh) {
            players = {for (final p in rows(data['players'])) p['id'] as int: p};
            final sorted = players.values.toList()
              ..sort((a, b) {
                if (a['isActive'] != b['isActive']) return a['isActive'] == true ? -1 : 1;
                return '${a['name']}'.compareTo('${b['name']}');
              });
            return ListView(padding: const EdgeInsets.all(16), children: [
              SegmentedButton<String>(
                segments: [for (final e in matchStatusLabels.entries) ButtonSegment(value: e.key, label: Text(e.value))],
                selected: {status},
                onSelectionChanged: (s) => setState(() => status = s.first),
              ),
              if (status == 'in_progress') const Text('진행 중 경기는 확정 통계에 반영되지 않습니다.', style: TextStyle(color: Colors.lightBlueAccent)),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text('경기일 ${day(date.toIso8601String())}'),
                trailing: const Icon(Icons.calendar_month),
                onTap: () async {
                  final d = await showDatePicker(context: context, firstDate: DateTime(2000), lastDate: DateTime(2100), initialDate: date);
                  if (d != null) setState(() => date = d);
                },
              ),
              TextField(controller: time, decoration: const InputDecoration(labelText: '시작 시간 (HH:MM, 선택)')),
              TextField(controller: location, decoration: const InputDecoration(labelText: '장소')),
              Row(children: [
                Expanded(child: TextField(controller: teamA, decoration: const InputDecoration(labelText: '팀 A 이름'))),
                const SizedBox(width: 8),
                Expanded(child: TextField(controller: teamB, decoration: const InputDecoration(labelText: '팀 B 이름'))),
              ]),
              if (live)
                Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  _Counter(value: scoreA, onChanged: (v) => setState(() => scoreA = v)),
                  const Text(' : ', style: TextStyle(fontSize: 28)),
                  _Counter(value: scoreB, onChanged: (v) => setState(() => scoreB = v)),
                ]),
              const SectionTitle('출전 명단', subtitle: '경기 안의 팀 편성입니다. 선수마다 팀을 고르세요.'),
              for (final p in sorted)
                ListTile(
                  dense: true,
                  title: Text('${p['name']}${p['isGuest'] == true ? ' · 용병' : ''}${p['isActive'] == false ? ' · 비활성' : ''}'),
                  trailing: SegmentedButton<String>(
                    showSelectedIcon: false,
                    segments: const [ButtonSegment(value: '-', label: Text('-')), ButtonSegment(value: 'A', label: Text('A')), ButtonSegment(value: 'B', label: Text('B'))],
                    selected: {teams[p['id']] ?? '-'},
                    onSelectionChanged: (s) => setState(() {
                      final id = p['id'] as int;
                      if (s.first == '-') {
                        teams.remove(id);
                        moms.remove(id);
                        goals.removeWhere((g) => g.scorer == id);
                      } else {
                        teams[id] = s.first;
                        goals.removeWhere((g) => g.scorer == id);
                      }
                      for (final g in goals) {
                        if (g.assist == id && teams[g.scorer] != teams[id]) g.assist = null;
                      }
                    }),
                  ),
                ),
              if (live) ...[
                const SectionTitle('득점 기록', subtitle: '골마다 득점자와 도움(없음/선수/미상)을 고릅니다.'),
                for (final g in goals)
                  Row(children: [
                    Expanded(child: Text('${name(g.scorer)} (${teams[g.scorer]})')),
                    DropdownButton<Object?>(
                      value: g.assist,
                      items: [
                        const DropdownMenuItem(value: null, child: Text('도움 없음')),
                        const DropdownMenuItem(value: 'UNKNOWN', child: Text('도움 미상')),
                        for (final e in teams.entries.where((e) => e.value == teams[g.scorer] && e.key != g.scorer))
                          DropdownMenuItem(value: e.key, child: Text(name(e.key))),
                      ],
                      onChanged: (v) => setState(() => g.assist = v),
                    ),
                    IconButton(icon: const Icon(Icons.remove_circle_outline), onPressed: () => setState(() => goals.remove(g))),
                  ]),
                DropdownButton<int>(
                  hint: const Text('+ 골 추가 (득점자 선택)'),
                  value: null,
                  items: [for (final id in teams.keys) DropdownMenuItem(value: id, child: Text('${name(id)} (${teams[id]})'))],
                  onChanged: (id) => setState(() => goals.add(_GoalRow(id!, null))),
                ),
                Text('팀 A 선수 득점 ${goals.where((g) => teams[g.scorer] == 'A').length} / 팀 점수 $scoreA · '
                    '팀 B 선수 득점 ${goals.where((g) => teams[g.scorer] == 'B').length} / 팀 점수 $scoreB',
                    style: const TextStyle(color: Colors.white54, fontSize: 12)),
                const SectionTitle('MOM'),
                Wrap(spacing: 6, children: [
                  for (final id in teams.keys)
                    FilterChip(label: Text(name(id)), selected: moms.contains(id),
                        onSelected: (s) => setState(() => s ? moms.add(id) : moms.remove(id))),
                ]),
              ],
              TextField(controller: memo, maxLines: 3, decoration: const InputDecoration(labelText: '메모')),
              const SizedBox(height: 16),
              FilledButton(onPressed: busy ? null : save, child: Text(busy ? '저장 중…' : '저장')),
              const SizedBox(height: 32),
            ]);
          },
        ),
      );
}

class _Counter extends StatelessWidget {
  const _Counter({required this.value, required this.onChanged});
  final int value;
  final ValueChanged<int> onChanged;
  @override
  Widget build(BuildContext context) => Row(children: [
        IconButton(onPressed: value > 0 ? () => onChanged(value - 1) : null, icon: const Icon(Icons.remove)),
        Text('$value', style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: lime)),
        IconButton(onPressed: value < 99 ? () => onChanged(value + 1) : null, icon: const Icon(Icons.add)),
      ]);
}
