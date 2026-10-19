import 'package:flutter/material.dart';

import 'auth.dart';
import 'club_api.dart';
import 'club_manage.dart';
import 'share_card.dart';
import 'ui.dart';

/// 동호회 탐색: public search, invite entry and club creation.
class ClubsTab extends StatefulWidget {
  const ClubsTab(this.api, {super.key});
  final ClubApi api;
  @override
  State<ClubsTab> createState() => _ClubsTabState();
}

class _ClubsTabState extends State<ClubsTab> {
  String q = '';
  int version = 0;
  @override
  Widget build(BuildContext context) => Scaffold(
        floatingActionButton: FloatingActionButton.extended(
          heroTag: 'create-club',
          onPressed: () async {
            if (!await requireLogin(context, widget.api, reason: '동호회를 만들려면 로그인하세요')) return;
            if (!context.mounted) return;
            final id = await openPage<int>(context, CreateClubScreen(widget.api));
            if (id != null && context.mounted) {
              setState(() => version++);
              await openPage(context, ClubScreen(widget.api, id));
            }
          },
          icon: const Icon(Icons.add),
          label: const Text('동호회 만들기'),
        ),
        body: Column(children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: Row(children: [
              Expanded(
                child: TextField(
                  decoration: const InputDecoration(hintText: '동호회 이름·지역 검색', prefixIcon: Icon(Icons.search), isDense: true),
                  onSubmitted: (v) => setState(() => q = v.trim()),
                ),
              ),
              IconButton(
                tooltip: '초대 링크로 가입',
                icon: const Icon(Icons.link),
                onPressed: () => openInviteEntry(context, widget.api),
              ),
            ]),
          ),
          ListenableBuilder(
            listenable: widget.api,
            builder: (context, _) {
              final mine = widget.api.memberships.where((m) => m['status'] == 'approved' || m['status'] == 'pending').toList();
              if (mine.isEmpty) return const SizedBox.shrink();
              return SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Row(children: [
                  const Text('내 동호회 ', style: TextStyle(color: Colors.white60)),
                  for (final m in mine)
                    Padding(
                      padding: const EdgeInsets.only(right: 6),
                      child: ActionChip(
                        label: Text('${m['clubName']}${m['status'] == 'pending' ? ' (승인 대기)' : ''}'),
                        onPressed: () => openPage(context, ClubScreen(widget.api, m['clubId'] as int)),
                      ),
                    ),
                ]),
              );
            },
          ),
          Expanded(
            child: AsyncView(
              key: ValueKey('$q/$version/${widget.api.loggedIn}'),
              load: () => widget.api.request('GET', 'clubs', query: q.isEmpty ? null : {'q': q}),
              builder: (data, refresh) {
                final clubs = rows(data['clubs']);
                return ListView(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
                  physics: const AlwaysScrollableScrollPhysics(),
                  children: [
                    if (clubs.isEmpty) const EmptyCard('검색 결과가 없습니다.'),
                    for (final c in clubs) ClubCard(widget.api, c),
                  ],
                );
              },
            ),
          ),
        ]),
      );
}

class ClubCard extends StatelessWidget {
  const ClubCard(this.api, this.club, {super.key});
  final ClubApi api;
  final Json club;
  @override
  Widget build(BuildContext context) {
    final viewer = club['viewer'] as Json?;
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: () => openPage(context, ClubScreen(api, club['id'] as int)),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            NetImage(api, club['logoUrl'], size: 52, label: '${club['name']}', round: false),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${club['name']}', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
                Text([club['region'] ?? '활동 지역 미등록', if (club['activityNote'] != null) club['activityNote']].join(' · '),
                    style: const TextStyle(color: Colors.white60)),
                const SizedBox(height: 6),
                Wrap(spacing: 6, runSpacing: 4, children: [
                  if (club['isDemo'] == true) const DemoBadge(),
                  Chip2(club['recordsVisibility'] == 'public' ? '기록 공개' : '기록 회원 전용',
                      icon: club['recordsVisibility'] == 'public' ? Icons.public : Icons.lock_outline),
                  Chip2(club['joinPolicy'] == 'invite_only' ? '초대 링크 가입' : '가입 승인제'),
                  if (viewer?['status'] != null)
                    Chip2(viewer?['status'] == 'approved' ? roleLabels[viewer?['role']] ?? '' : membershipLabels[viewer?['status']] ?? '',
                        color: lime),
                ]),
                if (club['description'] != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text('${club['description']}', maxLines: 2, overflow: TextOverflow.ellipsis),
                  ),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}

/// One club. Tabs reuse the same period filter (club seasons) and the server
/// applies the same aggregation rules everywhere.
class ClubScreen extends StatefulWidget {
  const ClubScreen(this.api, this.clubId, {super.key});
  final ClubApi api;
  final int clubId;
  @override
  State<ClubScreen> createState() => _ClubScreenState();
}

class _ClubScreenState extends State<ClubScreen> {
  int version = 0;
  DateTimeRange? period;

  void reload() => setState(() => version++);

  @override
  Widget build(BuildContext context) => ListenableBuilder(
        listenable: widget.api,
        builder: (context, _) => AsyncView(
          key: ValueKey('${widget.api.loggedIn}/$version'),
          load: () => widget.api.request('GET', 'clubs/${widget.clubId}'),
          builder: (data, refresh) {
            final club = data['club'] as Json;
            final viewer = club['viewer'] as Json;
            final perms = viewer['permissions'] as Json;
            final seasons = rows(club['seasons']);
            final canView = perms['viewRecords'] == true;
            Widget locked() => LockedCard(
                  message: viewer['status'] == 'pending'
                      ? '가입 승인 대기 중입니다. 승인 후 회원 전용 기록을 볼 수 있습니다.'
                      : '회원 전용 기록입니다. 가입 승인 후 볼 수 있습니다.',
                  action: JoinButton(widget.api, club, onChanged: reload),
                );
            return DefaultTabController(
              length: 5,
              child: Scaffold(
                appBar: AppBar(
                  title: Text('${club['name']}'),
                  actions: [
                    if (perms['manageMembers'] == true || perms['recordMatches'] == true || viewer['status'] == 'approved')
                      IconButton(
                        tooltip: '동호회 관리',
                        icon: const Icon(Icons.manage_accounts_outlined),
                        onPressed: () async {
                          await openPage(context, ClubManageScreen(widget.api, club));
                          reload();
                        },
                      ),
                  ],
                  bottom: const TabBar(isScrollable: true, tabAlignment: TabAlignment.start, tabs: [
                    Tab(text: '홈'), Tab(text: '선수'), Tab(text: '경기'), Tab(text: '조합 분석'), Tab(text: '명예의 전당'),
                  ]),
                ),
                body: Column(children: [
                  ClubHeader(widget.api, club, onChanged: reload),
                  if (canView)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: SeasonPicker(seasons: seasons, value: period, onChanged: (v) => setState(() => period = v)),
                    ),
                  Expanded(
                    child: TabBarView(children: [
                      canView ? ClubHomeTab(widget.api, club, period) : locked(),
                      canView ? PlayersTab(widget.api, club, period) : locked(),
                      canView ? MatchesTab(widget.api, club, period) : locked(),
                      canView ? ChemistryTab(widget.api, club, period) : locked(),
                      canView ? HallTab(widget.api, club, period) : locked(),
                    ]),
                  ),
                ]),
              ),
            );
          },
        ),
      );
}

class ClubHeader extends StatelessWidget {
  const ClubHeader(this.api, this.club, {super.key, required this.onChanged});
  final ClubApi api;
  final Json club;
  final VoidCallback onChanged;
  @override
  Widget build(BuildContext context) {
    final viewer = club['viewer'] as Json;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 6),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        NetImage(api, club['logoUrl'], size: 48, label: '${club['name']}', round: false),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Wrap(spacing: 6, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
              if (club['isDemo'] == true) const DemoBadge(),
              if (club['source'] == 'arena_import') const Chip2('ARENA 웹 기록 가져옴', color: Colors.lightBlueAccent),
              Text('${club['region'] ?? '활동 지역 미등록'} · 회원 ${club['memberCount']}명', style: const TextStyle(color: Colors.white60)),
            ]),
            if (club['description'] != null)
              Padding(padding: const EdgeInsets.only(top: 4), child: Text('${club['description']}', maxLines: 3, overflow: TextOverflow.ellipsis)),
            // When records are locked, the lock card carries the join button.
            if (viewer['status'] != 'approved' && (viewer['permissions'] as Json)['viewRecords'] == true)
              Padding(padding: const EdgeInsets.only(top: 6), child: JoinButton(api, club, onChanged: onChanged)),
          ]),
        ),
      ]),
    );
  }
}

/// Join / status button. Login is requested only here, and the user stays
/// on this club after logging in.
class JoinButton extends StatelessWidget {
  const JoinButton(this.api, this.club, {super.key, required this.onChanged});
  final ClubApi api;
  final Json club;
  final VoidCallback onChanged;
  @override
  Widget build(BuildContext context) {
    final status = (club['viewer'] as Json)['status'];
    if (status == 'approved') return const SizedBox.shrink();
    if (status == 'pending') return const Chip2('가입 승인 대기 중', color: Colors.amberAccent);
    if (status == 'banned') return const Chip2('이용이 제한된 동호회', color: Colors.redAccent);
    if (club['joinPolicy'] == 'invite_only') {
      return OutlinedButton.icon(
        onPressed: () => openInviteEntry(context, api),
        icon: const Icon(Icons.link),
        label: const Text('초대 링크로 가입'),
      );
    }
    return FilledButton.icon(
      // Run from the club screen's State: logging in rebuilds this subtree,
      // and the join flow must continue after login.
      onPressed: () => joinClub(context.findAncestorStateOfType<State<ClubScreen>>()?.context ?? context, api, club, onChanged),
      icon: const Icon(Icons.group_add),
      label: Text(status == 'left' || status == 'rejected' ? '다시 가입 신청' : '가입 신청'),
    );
  }
}

/// Login (only if needed) → refresh membership → message → join request.
Future<void> joinClub(BuildContext context, ClubApi api, Json club, VoidCallback onChanged) async {
  if (!await requireLogin(context, api, reason: '${club['name']}에 가입 신청하려면 로그인하세요')) return;
  if (!context.mounted) return;
  final ok = await guarded(context, () async {
    // The account may already be a member or applicant.
    final fresh = (await api.request('GET', 'clubs/${club['id']}'))['club'] as Json;
    final status = (fresh['viewer'] as Json)['status'];
    if (status == 'approved' || status == 'pending' || !context.mounted) return;
    final message = await showDialog<String>(context: context, builder: (_) => const _JoinDialog());
    if (message == null) return;
    await api.request('POST', 'clubs/${club['id']}/join', body: {'message': message});
    await api.refreshSession();
    if (context.mounted) notice(context, '가입 신청을 보냈습니다. 운영진 승인 후 회원 기능을 이용할 수 있습니다.');
  });
  if (ok) onChanged();
}

class _JoinDialog extends StatefulWidget {
  const _JoinDialog();
  @override
  State<_JoinDialog> createState() => _JoinDialogState();
}

class _JoinDialogState extends State<_JoinDialog> {
  final c = TextEditingController();
  @override
  void dispose() {
    c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: const Text('가입 신청'),
        content: TextField(controller: c, maxLength: 300, decoration: const InputDecoration(labelText: '운영진에게 남길 말 (선택)')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('취소')),
          FilledButton(onPressed: () => Navigator.pop(context, c.text.trim()), child: const Text('신청')),
        ],
      );
}

// ------------------------------------------------------------------ home
class ClubHomeTab extends StatelessWidget {
  const ClubHomeTab(this.api, this.club, this.period, {super.key});
  final ClubApi api;
  final Json club;
  final DateTimeRange? period;
  @override
  Widget build(BuildContext context) => AsyncView(
        key: ValueKey(period),
        load: () => api.request('GET', 'clubs/${club['id']}/dashboard', query: periodQuery(period)),
        builder: (data, refresh) {
          final rankings = data['rankings'] as Json;
          final latest = data['latestResult'] as Json?;
          return ListView(
            padding: const EdgeInsets.all(16),
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              Text('${periodLabel(period)} · 확정 경기 ${data['countedMatches']}경기 기준 (진행 중·예정·취소 경기 제외)',
                  style: const TextStyle(color: Colors.white54, fontSize: 12)),
              const SectionTitle('최신 경기 결과'),
              if (latest == null)
                const EmptyCard('완료된 경기가 없습니다.')
              else
                MatchTile(api, club, latest),
              if (rows(data['upcomingMatches']).isNotEmpty) ...[
                const SectionTitle('예정·진행 중 경기'),
                for (final m in rows(data['upcomingMatches'])) MatchTile(api, club, m),
              ],
              const SectionTitle('최근 경기'),
              for (final m in rows(data['recentMatches']).skip(1)) MatchTile(api, club, m),
              for (final (key, title) in [
                ('goals', '득점 랭킹'), ('assists', '도움 랭킹'), ('mom', 'MOM 랭킹'), ('winRate', '승률 랭킹'),
                ('winStreak', '현재 연승'), ('goalStreak', '현재 연속 득점'), ('assistStreak', '현재 연속 도움'),
              ]) ...[
                SectionTitle(title,
                    subtitle: key == 'winRate' ? '최소 ${rankings['minWinRateMatches']}경기 출전 선수 · 괄호는 표본 경기 수' : null),
                RankingList(api, club, rows(rankings[key]), showSample: key == 'winRate'),
              ],
              const SectionTitle('경기 포스터'),
              if (rows(data['posters']).isEmpty) const EmptyCard('등록된 포스터가 없습니다.'),
              PosterGrid(api, club, rows(data['posters'])),
            ],
          );
        },
      );
}

class RankingList extends StatelessWidget {
  const RankingList(this.api, this.club, this.entries, {super.key, this.showSample = false});
  final ClubApi api;
  final Json club;
  final List<Json> entries;
  final bool showSample;
  @override
  Widget build(BuildContext context) {
    if (entries.isEmpty) return const EmptyCard('해당 기록이 있는 선수가 없습니다.');
    return Card(
      child: Column(children: [
        for (final e in entries)
          ListTile(
            dense: true,
            leading: SizedBox(
              width: 44,
              child: Text('${e['rank']}${e['tied'] == true ? '=' : ''}',
                  style: const TextStyle(color: lime, fontSize: 20, fontWeight: FontWeight.w900)),
            ),
            title: Text('${(e['player'] as Json)['name']}'),
            subtitle: e['tied'] == true ? const Text('공동 순위') : null,
            trailing: Text('${e['displayValue']}${showSample ? ' (${e['sampleMatches']}경기)' : ''}',
                style: const TextStyle(color: lime, fontWeight: FontWeight.bold)),
            onTap: () => openPage(context, PlayerScreen(api, club, (e['player'] as Json)['id'] as int)),
          ),
      ]),
    );
  }
}

class PosterGrid extends StatelessWidget {
  const PosterGrid(this.api, this.club, this.posters, {super.key});
  final ClubApi api;
  final Json club;
  final List<Json> posters;
  @override
  Widget build(BuildContext context) => Wrap(spacing: 8, runSpacing: 8, children: [
        for (final p in posters)
          GestureDetector(
            onTap: () => openPage(context, PosterViewer(api, p['url'])),
            child: NetImage(api, p['url'], size: 104, round: false, label: '포'),
          ),
      ]);
}

class PosterViewer extends StatelessWidget {
  const PosterViewer(this.api, this.url, {super.key});
  final ClubApi api;
  final Object? url;
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('경기 포스터')),
        body: Center(
          child: InteractiveViewer(
            child: Image.network(api.fileUrl(url) ?? '', headers: api.imageHeaders,
                errorBuilder: (_, e, s) => const Icon(Icons.broken_image, size: 64)),
          ),
        ),
      );
}

// --------------------------------------------------------------- players
const sortLabels = {
  'goals': '득점', 'assists': '도움', 'attackPoints': '공격 포인트', 'mom': 'MOM', 'winRate': '승률', 'matches': '출전', 'name': '이름',
};

class PlayersTab extends StatefulWidget {
  const PlayersTab(this.api, this.club, this.period, {super.key});
  final ClubApi api;
  final Json club;
  final DateTimeRange? period;
  @override
  State<PlayersTab> createState() => _PlayersTabState();
}

class _PlayersTabState extends State<PlayersTab> {
  String search = '', sort = 'goals';
  bool inactive = false;
  @override
  Widget build(BuildContext context) => Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
          child: Row(children: [
            Expanded(
              child: TextField(
                decoration: const InputDecoration(hintText: '선수 검색', prefixIcon: Icon(Icons.search), isDense: true),
                onChanged: (v) => setState(() => search = v.trim()),
              ),
            ),
            const SizedBox(width: 8),
            DropdownButton<String>(
              value: sort,
              items: [for (final e in sortLabels.entries) DropdownMenuItem(value: e.key, child: Text(e.value))],
              onChanged: (v) => setState(() => sort = v!),
            ),
          ]),
        ),
        SwitchListTile(
          dense: true,
          title: const Text('비활성·용병 포함'),
          value: inactive,
          onChanged: (v) => setState(() => inactive = v),
        ),
        Expanded(
          child: AsyncView(
            key: ValueKey('${widget.period}/$inactive'),
            load: () => widget.api.request('GET', 'clubs/${widget.club['id']}/players',
                query: {...periodQuery(widget.period), if (inactive) 'includeInactive': 'true'}),
            builder: (data, refresh) {
              final min = data['minWinRateMatches'] as int;
              final players = rows(data['players'])
                  .where((p) => '${p['name']} ${p['nickname'] ?? ''}'.contains(search))
                  .toList()
                ..sort((a, b) {
                  if (sort == 'name') return '${a['name']}'.compareTo('${b['name']}');
                  if (sort == 'winRate') {
                    // Players below the minimum sample sort after qualified ones.
                    final qa = (a['matches'] as int) >= min, qb = (b['matches'] as int) >= min;
                    if (qa != qb) return qa ? -1 : 1;
                  }
                  final c = (b[sort] as num).compareTo(a[sort] as num);
                  return c != 0 ? c : '${a['name']}'.compareTo('${b['name']}');
                });
              return ListView(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                physics: const AlwaysScrollableScrollPhysics(),
                children: [
                  Text('확정 경기 ${data['countedMatches']}경기 · 승률은 무승부 포함 출전 경기 기준'
                      '${sort == 'winRate' ? ' · $min경기 미만은 뒤로' : ''}',
                      style: const TextStyle(color: Colors.white54, fontSize: 12)),
                  if (players.isEmpty) const EmptyCard('조건에 맞는 선수가 없습니다.'),
                  for (final p in players)
                    Card(
                      child: ListTile(
                        leading: NetImage(widget.api, p['photoUrl'], label: '${p['name']}'),
                        title: Text('${p['name']}${p['number'] == null ? '' : '  #${p['number']}'}'
                            '${p['isGuest'] == true ? ' · 용병' : ''}${p['isActive'] == false ? ' · 비활성' : ''}',
                            style: const TextStyle(fontWeight: FontWeight.bold)),
                        subtitle: Text('${p['matches']}경기 ${p['wins']}승 ${p['draws']}무 ${p['losses']}패 · 승률 ${p['winRate']}%\n'
                            '${p['goals']}골 ${p['assists']}도움 · MOM ${p['mom']}'),
                        isThreeLine: true,
                        trailing: sort == 'name'
                            ? const Icon(Icons.chevron_right)
                            : Text('${p[sort]}${sort == 'winRate' ? '%' : ''}',
                                style: const TextStyle(color: lime, fontSize: 18, fontWeight: FontWeight.bold)),
                        onTap: () => openPage(context, PlayerScreen(widget.api, widget.club, p['id'] as int, period: widget.period)),
                      ),
                    ),
                  const SizedBox(height: 24),
                ],
              );
            },
          ),
        ),
      ]);
}

class PlayerScreen extends StatelessWidget {
  const PlayerScreen(this.api, this.club, this.playerId, {super.key, this.period});
  final ClubApi api;
  final Json club;
  final int playerId;
  final DateTimeRange? period;
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('선수 기록')),
        body: AsyncView(
          load: () => api.request('GET', 'clubs/${club['id']}/players/$playerId', query: periodQuery(period)),
          builder: (data, refresh) {
            final p = data['player'] as Json;
            final viewer = club['viewer'] as Json;
            final perms = viewer['permissions'] as Json;
            final canLink = viewer['status'] == 'approved' && p['linked'] != true &&
                viewer['linkedPlayerId'] == null && viewer['pendingLinkPlayerId'] == null;
            return ListView(
              padding: const EdgeInsets.all(16),
              physics: const AlwaysScrollableScrollPhysics(),
              children: [
                Row(children: [
                  NetImage(api, p['photoUrl'], size: 72, label: '${p['name']}'),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('${p['name']}', style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w900)),
                      Text([
                        if (p['nickname'] != null) p['nickname'],
                        p['position'] ?? '포지션 미등록',
                        p['number'] == null ? '등번호 미등록' : '${p['number']}번',
                      ].join(' · '), style: const TextStyle(color: Colors.white60)),
                      Wrap(spacing: 6, children: [
                        if (p['isMe'] == true) const Chip2('내 프로필', color: lime),
                        if (p['isGuest'] == true) const Chip2('용병'),
                        if (p['isActive'] == false) const Chip2('비활성'),
                      ]),
                    ]),
                  ),
                ]),
                const SizedBox(height: 12),
                Text(periodLabel(period), style: const TextStyle(color: Colors.white54)),
                const SizedBox(height: 8),
                Wrap(spacing: 8, runSpacing: 8, children: [
                  StatTile('${p['matches']}', '출전'),
                  StatTile('${p['wins']}-${p['draws']}-${p['losses']}', '승-무-패'),
                  StatTile('${p['winRate']}%', '승률'),
                  StatTile('${p['goals']}', '득점'),
                  StatTile('${p['assists']}', '도움'),
                  StatTile('${p['mom']}', 'MOM'),
                ]),
                const SizedBox(height: 12),
                Wrap(spacing: 8, runSpacing: 8, children: [
                  FilledButton.tonalIcon(
                    onPressed: () => showShareCard(
                        context,
                        api,
                        (i) => PlayerShareCard(api: api, club: club, player: p, period: periodLabel(period),
                            photo: rows(p['cardPhotos']).isEmpty ? null : rows(p['cardPhotos'])[i]),
                        fileName: 'player-${p['id']}',
                        photoLabels: [for (final ph in rows(p['cardPhotos'])) '${ph['label']}']),
                    icon: const Icon(Icons.ios_share),
                    label: const Text('선수 카드 저장·공유'),
                  ),
                  if (perms['managePlayers'] == true || p['isMe'] == true)
                    OutlinedButton.icon(
                      onPressed: () async {
                        if (await openPage<bool>(context, PlayerEditScreen(api, club, player: p)) == true) await refresh();
                      },
                      icon: const Icon(Icons.edit),
                      label: const Text('프로필 수정'),
                    ),
                  if (canLink)
                    OutlinedButton.icon(
                      onPressed: () async {
                        if (!await confirmAction(context, '이 선수 기록을 내 계정과 연결하도록 운영진에게 신청할까요? 본인의 기록일 때만 신청해주세요.', ok: '신청')) return;
                        if (!context.mounted) return;
                        if (await guarded(context, () => api.request('POST', 'clubs/${club['id']}/players/${p['id']}/link-requests'))) {
                          if (context.mounted) notice(context, '연결 신청을 보냈습니다. 운영진 승인 후 연결됩니다.');
                        }
                      },
                      icon: const Icon(Icons.link),
                      label: const Text('내 기록으로 연결 신청'),
                    ),
                ]),
                const SectionTitle('현재 연속 기록'),
                Wrap(spacing: 8, runSpacing: 8, children: [
                  StatTile('${p['currentWinStreak']}', '연승'),
                  StatTile('${p['currentGoalStreak']}', '연속 득점'),
                  StatTile('${p['currentAssistStreak']}', '연속 도움'),
                ]),
                const SectionTitle('최고 연속 기록', subtitle: '출전 경기 기준 · 결장은 기록을 끊지 않음'),
                for (final (key, label) in [('win', '연승'), ('goal', '연속 득점'), ('assist', '연속 도움')]) ...[
                  Text(label, style: const TextStyle(color: lime)),
                  if (rows((p['bestStreaks'] as Json)[key]).isEmpty)
                    const Padding(padding: EdgeInsets.all(8), child: Text('기록 없음', style: TextStyle(color: Colors.white54))),
                  for (final s in rows((p['bestStreaks'] as Json)[key]))
                    ListTile(
                      dense: true,
                      title: Text('${s['length']}경기${s['ongoing'] == true ? ' (진행 중)' : ''}'),
                      subtitle: Text('${s['startDate']} ~ ${s['endDate']}'),
                    ),
                ],
                const SectionTitle('득점·도움 파트너', subtitle: '같은 팀 득점-도움 연결 기록'),
                if (rows(data['chemistryPreview']).isEmpty) const EmptyCard('연결 기록이 없습니다.'),
                for (final c in rows(data['chemistryPreview']).take(8))
                  ListTile(
                    dense: true,
                    title: Text('${(c['player'] as Json)['name']}'),
                    subtitle: Text('받은 도움 ${c['received']} · 준 도움 ${c['supplied']}'),
                    trailing: Text('${c['total']}회', style: const TextStyle(color: lime)),
                  ),
                const SectionTitle('경기 이력'),
                if (rows(p['history']).isEmpty) const EmptyCard('출전한 완료 경기가 없습니다.'),
                for (final h in rows(p['history']))
                  Card(
                    child: ListTile(
                      title: Text('${h['matchDate']} · ${h['teamName']} vs ${h['opponentName']}'),
                      subtitle: Text('${h['teamScore']}:${h['opponentScore']} · ${h['goals']}골 ${h['assists']}도움${h['isMom'] == true ? ' · MOM' : ''}'),
                      trailing: Text({'W': '승', 'D': '무', 'L': '패'}[h['result']] ?? '-',
                          style: TextStyle(color: h['result'] == 'W' ? lime : Colors.white70, fontWeight: FontWeight.bold)),
                      onTap: () => openPage(context, MatchScreen(api, club, h['matchId'] as int)),
                    ),
                  ),
              ],
            );
          },
        ),
      );
}

// --------------------------------------------------------------- matches
class MatchTile extends StatelessWidget {
  const MatchTile(this.api, this.club, this.match, {super.key, this.onReturn});
  final ClubApi api;
  final Json club;
  final Json match;
  final VoidCallback? onReturn;
  @override
  Widget build(BuildContext context) {
    final m = match;
    final hasScore = m['teamAScore'] != null;
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: () async {
          await openPage(context, MatchScreen(api, club, m['id'] as int));
          onReturn?.call();
        },
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(
                child: Text('${m['matchDate']}${m['startTime'] == null ? '' : ' ${m['startTime']}'} · ${m['location'] ?? '장소 미정'}',
                    style: const TextStyle(color: Colors.white60)),
              ),
              matchStatusChip(m['status'] as String),
            ]),
            const SizedBox(height: 8),
            Row(children: [
              Expanded(child: Text('${m['teamAName']}', style: const TextStyle(fontWeight: FontWeight.bold))),
              Text(hasScore ? '${m['teamAScore']} : ${m['teamBScore']}' : 'vs',
                  style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: lime)),
              Expanded(child: Text('${m['teamBName']}', textAlign: TextAlign.right, style: const TextStyle(fontWeight: FontWeight.bold))),
            ]),
            if (m['status'] == 'in_progress')
              const Text('진행 중 · 확정 통계에 반영되지 않습니다.', style: TextStyle(color: Colors.lightBlueAccent, fontSize: 12)),
          ]),
        ),
      ),
    );
  }
}

class MatchesTab extends StatefulWidget {
  const MatchesTab(this.api, this.club, this.period, {super.key});
  final ClubApi api;
  final Json club;
  final DateTimeRange? period;
  @override
  State<MatchesTab> createState() => _MatchesTabState();
}

class _MatchesTabState extends State<MatchesTab> {
  String? status;
  int page = 1, version = 0;
  @override
  Widget build(BuildContext context) {
    final perms = (widget.club['viewer'] as Json)['permissions'] as Json;
    return Scaffold(
      floatingActionButton: perms['recordMatches'] == true
          ? FloatingActionButton.extended(
              heroTag: 'new-match',
              onPressed: () async {
                if (await openPage<bool>(context, MatchEditorScreen(widget.api, widget.club)) == true) setState(() => version++);
              },
              icon: const Icon(Icons.add),
              label: const Text('경기 만들기'),
            )
          : null,
      body: Column(children: [
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Row(children: [
            ChoiceChip(label: const Text('전체 상태'), selected: status == null, onSelected: (_) => setState(() {
                  status = null;
                  page = 1;
                })),
            for (final e in matchStatusLabels.entries) ...[
              const SizedBox(width: 6),
              ChoiceChip(label: Text(e.value), selected: status == e.key, onSelected: (_) => setState(() {
                    status = e.key;
                    page = 1;
                  })),
            ],
          ]),
        ),
        Expanded(
          child: AsyncView(
            key: ValueKey('${widget.period}/$status/$page/$version'),
            load: () => widget.api.request('GET', 'clubs/${widget.club['id']}/matches',
                query: {...periodQuery(widget.period), 'page': '$page', 'status': ?status}),
            builder: (data, refresh) {
              final p = data['pagination'] as Json;
              return ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
                physics: const AlwaysScrollableScrollPhysics(),
                children: [
                  if (rows(data['matches']).isEmpty) const EmptyCard('조건에 맞는 경기가 없습니다.'),
                  for (final m in rows(data['matches'])) MatchTile(widget.api, widget.club, m, onReturn: () => setState(() => version++)),
                  Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    IconButton(onPressed: page > 1 ? () => setState(() => page--) : null, icon: const Icon(Icons.chevron_left)),
                    Text('$page 페이지 · 총 ${p['total']}경기'),
                    IconButton(onPressed: p['hasMore'] == true ? () => setState(() => page++) : null, icon: const Icon(Icons.chevron_right)),
                  ]),
                ],
              );
            },
          ),
        ),
      ]),
    );
  }
}

class MatchScreen extends StatefulWidget {
  const MatchScreen(this.api, this.club, this.matchId, {super.key});
  final ClubApi api;
  final Json club;
  final int matchId;
  @override
  State<MatchScreen> createState() => _MatchScreenState();
}

class _MatchScreenState extends State<MatchScreen> {
  int version = 0;
  @override
  Widget build(BuildContext context) {
    final api = widget.api, club = widget.club;
    final perms = (club['viewer'] as Json)['permissions'] as Json;
    return Scaffold(
      appBar: AppBar(title: const Text('경기 상세')),
      body: AsyncView(
        key: ValueKey(version),
        load: () => api.request('GET', 'clubs/${club['id']}/matches/${widget.matchId}'),
        builder: (data, refresh) {
          final m = data['match'] as Json;
          final teams = [('A', m['teamAName']), ('B', m['teamBName'])];
          return ListView(
            padding: const EdgeInsets.all(16),
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              MatchTile(api, club, m),
              if (m['status'] == 'completed' && m['winner'] != null)
                Text(m['winner'] == 'draw' ? '무승부' : '${m['winner'] == 'A' ? m['teamAName'] : m['teamBName']} 승리',
                    style: const TextStyle(color: lime)),
              if (m['status'] == 'cancelled') const Text('취소된 경기 · 통계에 반영되지 않습니다.', style: TextStyle(color: Colors.redAccent)),
              const SizedBox(height: 8),
              Wrap(spacing: 8, runSpacing: 8, children: [
                if (m['countsForStats'] == true)
                  FilledButton.tonalIcon(
                    onPressed: () => showShareCard(context, api, (_) => MatchShareCard(api: api, club: club, match: m), fileName: 'match-${m['id']}'),
                    icon: const Icon(Icons.ios_share),
                    label: const Text('결과 카드 저장·공유'),
                  ),
                if (perms['recordMatches'] == true)
                  OutlinedButton.icon(
                    onPressed: () async {
                      if (await openPage<bool>(context, MatchEditorScreen(api, club, match: m)) == true) setState(() => version++);
                    },
                    icon: const Icon(Icons.edit),
                    label: const Text('기록 입력·수정'),
                  ),
                if (perms['deleteMatches'] == true)
                  TextButton.icon(
                    onPressed: () async {
                      if (!await confirmAction(context, '경기와 출전·득점 기록을 삭제할까요?', ok: '삭제')) return;
                      if (!context.mounted) return;
                      if (await guarded(context, () => api.request('DELETE', 'clubs/${club['id']}/matches/${m['id']}')) && context.mounted) {
                        Navigator.pop(context, true);
                      }
                    },
                    icon: const Icon(Icons.delete_outline),
                    label: const Text('삭제'),
                  ),
              ]),
              for (final (team, name) in teams) ...[
                SectionTitle('$name', subtitle: team == 'A' ? '팀 A' : '팀 B'),
                if (!rows(m['players']).any((p) => p['team'] == team)) const EmptyCard('출전 명단이 없습니다.'),
                for (final p in rows(m['players']).where((p) => p['team'] == team))
                  Card(
                    child: ListTile(
                      leading: NetImage(api, (p['player'] as Json)['photoUrl'], label: '${(p['player'] as Json)['name']}'),
                      title: Text('${(p['player'] as Json)['name']}${p['isMom'] == true ? '  · MOM' : ''}'),
                      subtitle: Text('${p['goals']}골 · ${p['assists']}도움'),
                      onTap: () => openPage(context, PlayerScreen(api, club, p['playerId'] as int)),
                    ),
                  ),
              ],
              const SectionTitle('골별 기록', subtitle: '도움 미상은 원본에 연결 정보가 없는 골입니다.'),
              if (rows(m['goals']).isEmpty) const EmptyCard('골별 기록이 없습니다.'),
              for (final g in rows(m['goals']))
                ListTile(
                  dense: true,
                  leading: const Icon(Icons.sports_soccer),
                  title: Text('${g['scorerName']} · ${g['sequence']}번째 골'),
                  subtitle: Text(g['assistKnown'] == false ? '도움 미상' : (g['assistName'] == null ? '도움 없음' : '도움 ${g['assistName']}')),
                ),
              const SectionTitle('경기 포스터'),
              if (perms['recordMatches'] == true)
                Align(
                  alignment: Alignment.centerLeft,
                  child: OutlinedButton.icon(
                    onPressed: () async {
                      if (await pickAndUpload(context, api, 'clubs/${club['id']}/matches/${m['id']}/posters')) setState(() => version++);
                    },
                    icon: const Icon(Icons.add_photo_alternate_outlined),
                    label: const Text('포스터 추가'),
                  ),
                ),
              if (rows(m['posters']).isEmpty) const EmptyCard('등록된 포스터가 없습니다.'),
              for (final p in rows(m['posters']))
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Column(children: [
                    GestureDetector(
                      onTap: () => openPage(context, PosterViewer(api, p['url'])),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(16),
                        child: Image.network(api.fileUrl(p['url']) ?? '', headers: api.imageHeaders, height: 220, width: double.infinity,
                            fit: BoxFit.cover, errorBuilder: (_, e, s) => const EmptyCard('이미지를 불러올 수 없습니다.')),
                      ),
                    ),
                    if (perms['recordMatches'] == true)
                      TextButton(
                        onPressed: () async {
                          if (!await confirmAction(context, '포스터를 삭제할까요?', ok: '삭제')) return;
                          if (!context.mounted) return;
                          if (await guarded(context, () => api.request('DELETE', 'clubs/${club['id']}/matches/${m['id']}/posters/${p['id']}'))) {
                            setState(() => version++);
                          }
                        },
                        child: const Text('포스터 삭제'),
                      ),
                  ]),
                ),
              const SectionTitle('메모'),
              Text('${m['memo'] ?? '등록된 메모가 없습니다.'}'),
              const SizedBox(height: 32),
            ],
          );
        },
      ),
    );
  }
}

// ------------------------------------------------------------- chemistry
class ChemistryTab extends StatefulWidget {
  const ChemistryTab(this.api, this.club, this.period, {super.key});
  final ClubApi api;
  final Json club;
  final DateTimeRange? period;
  @override
  State<ChemistryTab> createState() => _ChemistryTabState();
}

class _ChemistryTabState extends State<ChemistryTab> {
  int? playerId;
  int minMatches = 3;
  @override
  Widget build(BuildContext context) => AsyncView(
        key: ValueKey('${widget.period}/$playerId/$minMatches'),
        load: () => widget.api.request('GET', 'clubs/${widget.club['id']}/chemistry', query: {
          ...periodQuery(widget.period),
          'minMatches': '$minMatches',
          if (playerId != null) 'playerId': '$playerId',
        }),
        builder: (data, refresh) {
          final players = rows(data['players']);
          final c = data['chemistry'] as Json?;
          Widget record(Json r) => ListTile(
                dense: true,
                title: Text('${(r['player'] as Json)['name']}'),
                subtitle: Text('${r['matches']}경기 ${r['wins']}승 ${r['draws']}무 ${r['losses']}패 · 득실 ${r['goalsFor']}:${r['goalsAgainst']}'),
                trailing: Text('${r['winRate']}%', style: const TextStyle(color: lime, fontWeight: FontWeight.bold)),
              );
          return ListView(
            padding: const EdgeInsets.all(16),
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              DropdownButtonFormField<int>(
                initialValue: playerId,
                isExpanded: true,
                decoration: const InputDecoration(labelText: '기준 선수'),
                items: [for (final p in players) DropdownMenuItem(value: p['id'] as int, child: Text('${p['name']}'))],
                onChanged: (v) => setState(() => playerId = v),
              ),
              const SizedBox(height: 8),
              Wrap(spacing: 6, children: [
                const Text('최소 함께 뛴 경기 '),
                for (final n in [1, 3, 5, 10])
                  ChoiceChip(label: Text('$n'), selected: minMatches == n, onSelected: (_) => setState(() => minMatches = n)),
              ]),
              if (c == null)
                const EmptyCard('기준 선수를 선택하면 같은 팀·상대 팀 전적과 득점-도움 파트너를 보여줍니다.')
              else ...[
                const SizedBox(height: 12),
                Text('표본: 기준 선수가 출전한 확정 경기 ${c['totalMatches']}경기'
                    '${c['firstDate'] == null ? '' : ' (${c['firstDate']} ~ ${c['lastDate']})'}'),
                Text('연결 미상: 득점 ${c['unknownGoalLinks']}건 · 도움 ${c['unknownAssistLinks']}건 (실제 0과 구분)',
                    style: const TextStyle(color: Colors.white54, fontSize: 12)),
                SectionTitle('같은 팀 전적', subtitle: '함께 $minMatches경기 이상 · 승률은 무승부 포함'),
                if (rows(c['teammates']).isEmpty) const EmptyCard('조건에 맞는 선수가 없습니다.'),
                Card(child: Column(children: [for (final r in rows(c['teammates'])) record(r)])),
                SectionTitle('상대 팀으로 만난 전적', subtitle: '기준 선수 입장의 승률'),
                if (rows(c['opponents']).isEmpty) const EmptyCard('조건에 맞는 선수가 없습니다.'),
                Card(child: Column(children: [for (final r in rows(c['opponents'])) record(r)])),
                const SectionTitle('득점·도움 파트너'),
                if (rows(c['connections']).isEmpty) const EmptyCard('확인된 연결이 없습니다.'),
                Card(
                  child: Column(children: [
                    for (final r in rows(c['connections']))
                      ListTile(
                        dense: true,
                        title: Text('${(r['player'] as Json)['name']}'),
                        subtitle: Text('받은 도움 ${r['received']} · 준 도움 ${r['supplied']}'),
                        trailing: Text('${r['total']}회', style: const TextStyle(color: lime)),
                      ),
                  ]),
                ),
              ],
            ],
          );
        },
      );
}

// ------------------------------------------------------------ hall of fame
class HallTab extends StatelessWidget {
  const HallTab(this.api, this.club, this.period, {super.key});
  final ClubApi api;
  final Json club;
  final DateTimeRange? period;
  @override
  Widget build(BuildContext context) => AsyncView(
        key: ValueKey(period),
        load: () => api.request('GET', 'clubs/${club['id']}/hall-of-fame', query: periodQuery(period)),
        builder: (data, refresh) {
          final hall = data['hallOfFame'] as Json;
          return ListView(
            padding: const EdgeInsets.all(16),
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              const Icon(Icons.emoji_events_outlined, color: lime, size: 56),
              Text('${periodLabel(period)} · 확정 ${hall['totalMatches']}경기 · 활동 선수 ${hall['totalPlayers']}명 · 공동 순위 표시',
                  textAlign: TextAlign.center, style: const TextStyle(color: Colors.white60)),
              for (final cat in rows(hall['categories'])) ...[
                SectionTitle('${cat['title']}', subtitle: '${cat['description']}'),
                RankingList(api, club, rows(cat['entries'])),
              ],
            ],
          );
        },
      );
}
