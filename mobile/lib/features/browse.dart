import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../core/api.dart';
import '../core/widgets.dart';
import 'editor.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen(this.api, {super.key});
  final ArenaApi api;
  @override
  Widget build(BuildContext context) => DataView(
    load: () => api.request('GET', 'dashboard'),
    builder: (data, refresh) => ListView(
      padding: const EdgeInsets.all(20),
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF243B25), Color(0xFF151D26)],
            ),
            borderRadius: BorderRadius.circular(24),
          ),
          child: const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'OUR TEAM. OUR RECORD.',
                style: TextStyle(color: lime, fontSize: 11, letterSpacing: 2),
              ),
              SizedBox(height: 12),
              Text(
                '함께 뛰고,\n기록으로 남기다.',
                style: TextStyle(
                  fontSize: 30,
                  height: 1.2,
                  fontWeight: FontWeight.w900,
                ),
              ),
              SizedBox(height: 14),
              Text(
                'ARENA FC  /  아레나 풋살 클럽',
                style: TextStyle(color: Colors.white60),
              ),
            ],
          ),
        ),
        const SectionTitle('최근 경기'),
        if (rows(data['recentMatches']).isEmpty) const EmptyCard(),
        ...rows(data['recentMatches']).map(
          (m) => MatchCard(
            m,
            onTap: () async {
              await openPage(context, MatchScreen(api, m['id'] as int));
              await refresh();
            },
          ),
        ),
        for (final entry in {
          'goalRankings': '득점 TOP 5',
          'assistRankings': '도움 TOP 5',
          'mvpRankings': 'MOM TOP 5',
          'winRateRankings': '승률 TOP 5',
          'winStreakRankings': '최근 연승 TOP 5',
          'goalStreakRankings': '연속 득점 TOP 5',
          'assistStreakRankings': '연속 도움 TOP 5',
        }.entries) ...[
          SectionTitle(entry.value),
          if (rows(data[entry.key]).isEmpty) const EmptyCard(),
          ...rows(data[entry.key]).asMap().entries.map(
            (p) => Card(
              child: ListTile(
                leading: PlayerAvatar(api: api, player: p.value),
                title: Text('${p.key + 1}. ${p.value['name']}'),
                subtitle: Text('${p.value['totalMatches']}경기 출전'),
                trailing: Text(
                  '${p.value[{'goalRankings': 'goals', 'assistRankings': 'assists', 'mvpRankings': 'mvpCount', 'winRateRankings': 'winRate', 'winStreakRankings': 'currentWinStreak', 'goalStreakRankings': 'currentGoalStreak', 'assistStreakRankings': 'currentAssistStreak'}[entry.key]]}${entry.key == 'winRateRankings' ? '%' : ''}',
                  style: const TextStyle(
                    color: lime,
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                onTap: () =>
                    openPage(context, PlayerScreen(api, p.value['id'] as int)),
              ),
            ),
          ),
        ],
      ],
    ),
  );
}

class PlayersScreen extends StatefulWidget {
  const PlayersScreen(this.api, {super.key});
  final ArenaApi api;
  @override
  State<PlayersScreen> createState() => _PlayersScreenState();
}

class _PlayersScreenState extends State<PlayersScreen> {
  DateTimeRange? period;
  String search = '';
  String sort = 'goals';
  @override
  Widget build(BuildContext context) => Column(
    children: [
      PeriodFilter(value: period, onChanged: (v) => setState(() => period = v)),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: Row(
          children: [
            Expanded(
              child: TextField(
                decoration: const InputDecoration(
                  hintText: '선수 이름 검색',
                  prefixIcon: Icon(Icons.search),
                ),
                onChanged: (v) => setState(() => search = v),
              ),
            ),
            const SizedBox(width: 12),
            DropdownButton<String>(
              value: sort,
              items:
                  {
                        'goals': '득점',
                        'assists': '도움',
                        'winRate': '승률',
                        'mvpCount': 'MOM',
                        'totalMatches': '출전',
                        'name': '이름',
                      }.entries
                      .map(
                        (e) => DropdownMenuItem(
                          value: e.key,
                          child: Text(e.value),
                        ),
                      )
                      .toList(),
              onChanged: (v) => setState(() => sort = v!),
            ),
          ],
        ),
      ),
      Expanded(
        child: DataView(
          key: ValueKey(period.toString()),
          load: () =>
              widget.api.request('GET', 'players', query: periodQuery(period)),
          builder: (data, refresh) {
            final players =
                rows(data['players'])
                    .where(
                      (p) => '${p['name']} ${p['nickname'] ?? ''}'.contains(
                        search,
                      ),
                    )
                    .toList()
                  ..sort(
                    (a, b) => sort == 'name'
                        ? '${a['name']}'.compareTo('${b['name']}')
                        : (b[sort] as num).compareTo(a[sort] as num),
                  );
            return ListView(
              padding: const EdgeInsets.all(20),
              physics: const AlwaysScrollableScrollPhysics(),
              children: [
                if (players.isEmpty) const EmptyCard('조건에 맞는 선수가 없습니다.'),
                ...players.map(
                  (p) => Card(
                    child: ListTile(
                      contentPadding: const EdgeInsets.all(14),
                      leading: PlayerAvatar(api: widget.api, player: p),
                      title: Text(
                        '${p['name']}  ${p['number'] == null ? '' : '#${p['number']}'}',
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                      subtitle: Text(
                        '${p['position']} · ${p['totalMatches']}경기\n${p['goals']}골  ${p['assists']}도움  ${p['mvpCount']} MOM',
                      ),
                      isThreeLine: true,
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => openPage(
                        context,
                        PlayerScreen(
                          widget.api,
                          p['id'] as int,
                          period: period,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    ],
  );
}

class PlayerScreen extends StatelessWidget {
  const PlayerScreen(this.api, this.id, {super.key, this.period});
  final ArenaApi api;
  final int id;
  final DateTimeRange? period;
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('선수 기록')),
    body: DataView(
      load: () => api.request('GET', 'players/$id', query: periodQuery(period)),
      builder: (data, refresh) {
        final p = data['player'] as Json;
        return ListView(
          padding: const EdgeInsets.all(20),
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: PlayerAvatar(api: api, player: p),
              title: Text(
                '${p['name']}',
                style: const TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.w900,
                ),
              ),
              subtitle: Text(
                '${p['nickname'] ?? ''} · ${p['position']} · ${p['number'] ?? '-'}번',
              ),
            ),
            const SizedBox(height: 20),
            StatsGrid(p),
            SectionTitle(
              '${p['wins']}승 ${p['losses']}패 ${p['draws']}무',
              subtitle: period == null ? '완료된 경기 전체 기록' : '선택한 기간의 완료된 경기 기록',
            ),
            const SectionTitle('최고 연속 기록'),
            for (final e in {
              'win': '연승',
              'goal': '연속 득점',
              'assist': '연속 도움',
            }.entries) ...[
              Text(e.value, style: const TextStyle(color: lime)),
              if (rows(data['streaks'][e.key]).isEmpty)
                const Padding(
                  padding: EdgeInsets.all(8),
                  child: Text('아직 기록이 없습니다.'),
                ),
              ...rows(data['streaks'][e.key]).map(
                (s) => ListTile(
                  title: Text('${s['length']}경기'),
                  subtitle: Text(
                    '${day(s['startDate'])} ~ ${day(s['endDate'])}',
                  ),
                ),
              ),
            ],
            const SectionTitle('출전 경기'),
            if (rows(p['matchPlayers']).isEmpty) const EmptyCard(),
            ...rows(p['matchPlayers']).map(
              (r) => Card(
                child: ListTile(
                  title: Text(
                    '${day(r['match']['matchDate'])} · ${r['teamName']}',
                  ),
                  subtitle: Text(
                    '${r['goals']}골 · ${r['assists']}도움${r['isMvp'] == true ? ' · MOM' : ''}',
                  ),
                  trailing: Text(
                    {'WIN': '승', 'LOSS': '패', 'DRAW': '무'}[r['result']] ?? '-',
                  ),
                  onTap: () =>
                      openPage(context, MatchScreen(api, r['matchId'] as int)),
                ),
              ),
            ),
          ],
        );
      },
    ),
  );
}

class MatchesScreen extends StatefulWidget {
  const MatchesScreen(this.api, {super.key});
  final ArenaApi api;
  @override
  State<MatchesScreen> createState() => _MatchesScreenState();
}

class _MatchesScreenState extends State<MatchesScreen> {
  DateTimeRange? period;
  int page = 1;
  @override
  Widget build(BuildContext context) => Column(
    children: [
      PeriodFilter(
        value: period,
        onChanged: (v) => setState(() {
          period = v;
          page = 1;
        }),
      ),
      Expanded(
        child: DataView(
          key: ValueKey('$period/$page'),
          load: () => widget.api.request(
            'GET',
            'matches',
            query: {...periodQuery(period), 'page': '$page'},
          ),
          builder: (data, refresh) => ListView(
            padding: const EdgeInsets.all(20),
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              if (rows(data['matches']).isEmpty) const EmptyCard(),
              ...rows(data['matches']).map(
                (m) => MatchCard(
                  m,
                  onTap: () async {
                    await openPage(
                      context,
                      MatchScreen(widget.api, m['id'] as int),
                    );
                    await refresh();
                  },
                ),
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  IconButton(
                    onPressed: page > 1 ? () => setState(() => page--) : null,
                    icon: const Icon(Icons.chevron_left),
                  ),
                  Text('$page 페이지 · 총 ${data['pagination']['total']}경기'),
                  IconButton(
                    onPressed: data['pagination']['hasMore'] == true
                        ? () => setState(() => page++)
                        : null,
                    icon: const Icon(Icons.chevron_right),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    ],
  );
}

class MatchScreen extends StatelessWidget {
  const MatchScreen(this.api, this.id, {super.key});
  final ArenaApi api;
  final int id;
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('경기 상세')),
    body: DataView(
      load: () => api.request('GET', 'matches/$id'),
      builder: (data, refresh) {
        final m = data['match'] as Json;
        return ListView(
          padding: const EdgeInsets.all(20),
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            MatchCard(m, onTap: () {}),
            if (api.loggedIn)
              Wrap(
                spacing: 12,
                children: [
                  OutlinedButton.icon(
                    onPressed: () async {
                      await openPage(context, MatchEditor(api, match: m));
                      await refresh();
                    },
                    icon: const Icon(Icons.edit),
                    label: const Text('경기 수정'),
                  ),
                  TextButton.icon(
                    onPressed: () async {
                      if (!await confirm(context, '이 경기와 참가·득점 기록을 삭제할까요?')) {
                        return;
                      }
                      try {
                        await api.request('DELETE', 'matches/$id');
                        if (context.mounted) Navigator.pop(context, true);
                      } catch (e) {
                        if (context.mounted) notice(context, e);
                      }
                    },
                    icon: const Icon(Icons.delete_outline),
                    label: const Text('삭제'),
                  ),
                ],
              ),
            for (final team in [m['teamAName'], m['teamBName']]) ...[
              SectionTitle('$team'),
              ...rows(m['matchPlayers'])
                  .where((p) => p['teamName'] == team)
                  .map(
                    (p) => Card(
                      child: ListTile(
                        leading: PlayerAvatar(
                          api: api,
                          player: p['player'] as Json,
                        ),
                        title: Text(
                          '${p['player']['name']}${p['isMvp'] == true ? '  🏆 MOM' : ''}',
                        ),
                        subtitle: Text('${p['goals']}골 · ${p['assists']}도움'),
                        onTap: () => openPage(
                          context,
                          PlayerScreen(api, p['playerId'] as int),
                        ),
                      ),
                    ),
                  ),
            ],
            const SectionTitle('골별 기록'),
            if (rows(m['goals']).isEmpty) const EmptyCard(),
            ...rows(m['goals']).map(
              (g) => ListTile(
                leading: const Icon(Icons.sports_soccer),
                title: Text('${g['scorer']['name']} · ${g['sequence']}번째 골'),
                subtitle: Text(
                  g['assistKnown'] == false
                      ? '도움 정보 미상'
                      : g['assister'] == null
                      ? '도움 없음'
                      : '도움 ${g['assister']['name']}',
                ),
              ),
            ),
            const SectionTitle('경기 포스터'),
            if (api.loggedIn)
              OutlinedButton.icon(
                onPressed: () async {
                  try {
                    final file = await ImagePicker().pickImage(
                      source: ImageSource.gallery,
                      maxWidth: 2400,
                      imageQuality: 90,
                    );
                    if (file == null) return;
                    await api.uploadImage(
                      'matches/$id/posters',
                      await file.readAsBytes(),
                      file.name,
                    );
                    await refresh();
                  } catch (e) {
                    if (context.mounted) notice(context, e);
                  }
                },
                icon: const Icon(Icons.add_photo_alternate_outlined),
                label: const Text('포스터 추가'),
              ),
            if (rows(m['posters']).isEmpty) const EmptyCard('등록된 포스터가 없습니다.'),
            ...rows(m['posters']).map(
              (p) => Column(
                children: [
                  if (api.imageUrl(p['imageUrl']) != null)
                    GestureDetector(
                      onTap: () => openPage(
                        context,
                        Scaffold(
                          appBar: AppBar(title: const Text('경기 포스터')),
                          body: Center(
                            child: InteractiveViewer(
                              child: Image.network(
                                api.imageUrl(p['imageUrl'])!,
                                errorBuilder: (_, e, s) =>
                                    const Icon(Icons.broken_image),
                              ),
                            ),
                          ),
                        ),
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(16),
                        child: Image.network(
                          api.imageUrl(p['imageUrl'])!,
                          height: 240,
                          width: double.infinity,
                          fit: BoxFit.cover,
                          errorBuilder: (_, e, s) =>
                              const EmptyCard('이미지를 불러올 수 없습니다.'),
                        ),
                      ),
                    ),
                  if (api.loggedIn)
                    TextButton(
                      onPressed: () async {
                        if (!await confirm(context, '포스터를 삭제할까요?')) return;
                        try {
                          await api.request(
                            'DELETE',
                            'matches/$id/posters/${p['id']}',
                          );
                          await refresh();
                        } catch (e) {
                          if (context.mounted) notice(context, e);
                        }
                      },
                      child: const Text('포스터 삭제'),
                    ),
                  const SizedBox(height: 12),
                ],
              ),
            ),
            const SectionTitle('메모'),
            Text('${m['memo'] ?? '등록된 메모가 없습니다.'}'),
            const SizedBox(height: 30),
          ],
        );
      },
    ),
  );
}

class HallScreen extends StatelessWidget {
  const HallScreen(this.api, {super.key});
  final ArenaApi api;
  @override
  Widget build(BuildContext context) => DataView(
    load: () => api.request('GET', 'hall-of-fame'),
    builder: (data, refresh) {
      final hall = data['hallOfFame'] as Json;
      return ListView(
        padding: const EdgeInsets.all(20),
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          const Icon(Icons.emoji_events_outlined, color: lime, size: 64),
          const SectionTitle('명예의 전당', subtitle: '함께 쌓아 온 아레나의 기록'),
          Text('${hall['totalMatches']}경기 · ${hall['totalPlayers']}명의 선수'),
          for (final category in rows(hall['categories'])) ...[
            SectionTitle(
              '${category['title']}',
              subtitle: '${category['description']}',
            ),
            if (rows(category['entries']).isEmpty) const EmptyCard(),
            ...rows(category['entries']).map(
              (p) => Card(
                child: ListTile(
                  leading: Text(
                    '${p['rank']}',
                    style: const TextStyle(
                      color: lime,
                      fontSize: 26,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  title: Text('${p['playerName']}'),
                  trailing: Text(
                    '${p['displayValue']}',
                    style: const TextStyle(color: lime),
                  ),
                  onTap: () => openPage(
                    context,
                    PlayerScreen(api, p['playerId'] as int),
                  ),
                ),
              ),
            ),
          ],
        ],
      );
    },
  );
}
