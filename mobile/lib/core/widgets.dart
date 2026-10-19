import 'package:flutter/material.dart';

import 'api.dart';

const lime = Color(0xFFC7F464);

void notice(BuildContext context, Object message) =>
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message.toString())));
Future<bool> confirm(BuildContext context, String message) async =>
    await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('확인'),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('취소'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('삭제'),
          ),
        ],
      ),
    ) ??
    false;
Future<T?> openPage<T>(BuildContext context, Widget page) =>
    Navigator.push<T>(context, MaterialPageRoute(builder: (_) => page));

class DataView extends StatefulWidget {
  const DataView({super.key, required this.load, required this.builder});
  final Future<Json> Function() load;
  final Widget Function(Json, Future<void> Function()) builder;
  @override
  State<DataView> createState() => _DataViewState();
}

class _DataViewState extends State<DataView> {
  late Future<Json> future;
  @override
  void initState() {
    super.initState();
    future = widget.load();
  }

  Future<void> refresh() async {
    if (!mounted) return;
    setState(() {
      future = widget.load();
    });
    try {
      await future;
    } catch (_) {
      /* FutureBuilder displays the failure. */
    }
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<Json>(
    future: future,
    builder: (context, snapshot) {
      if (snapshot.connectionState != ConnectionState.done) {
        return const Center(child: CircularProgressIndicator());
      }
      if (snapshot.hasError) {
        return Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.cloud_off, size: 48),
                const SizedBox(height: 16),
                Text(snapshot.error.toString(), textAlign: TextAlign.center),
                const SizedBox(height: 16),
                FilledButton(onPressed: refresh, child: const Text('다시 시도')),
              ],
            ),
          ),
        );
      }
      return RefreshIndicator(
        onRefresh: refresh,
        child: widget.builder(snapshot.data!, refresh),
      );
    },
  );
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.title, {super.key, this.subtitle});
  final String title;
  final String? subtitle;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 20, bottom: 12),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: Theme.of(context).textTheme.titleLarge
              ?.copyWith(fontWeight: FontWeight.w800),
        ),
        if (subtitle != null)
          Text(subtitle!, style: const TextStyle(color: Colors.white60)),
      ],
    ),
  );
}

class EmptyCard extends StatelessWidget {
  const EmptyCard([this.text = '아직 등록된 기록이 없습니다.', Key? key]) : super(key: key);
  final String text;
  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(28),
      child: Text(text, textAlign: TextAlign.center),
    ),
  );
}

class PlayerAvatar extends StatelessWidget {
  const PlayerAvatar({super.key, required this.api, required this.player});
  final ArenaApi api;
  final Json player;
  @override
  Widget build(BuildContext context) {
    final name = (player['name'] ?? '?').toString();
    final url = api.imageUrl(
      player['profileImageUrl'] ?? '/images/players/${player['id']}.jpg',
    );
    final fallback = Center(
      child: Text(
        name.isEmpty ? '?' : name.characters.first,
        style: const TextStyle(color: lime, fontWeight: FontWeight.bold),
      ),
    );
    return ClipOval(
      child: SizedBox(
        width: 44,
        height: 44,
        child: ColoredBox(
          color: Colors.white10,
          child: url == null
              ? fallback
              : Image.network(
                  url,
                  fit: BoxFit.cover,
                  errorBuilder: (_, e, s) => fallback,
                ),
        ),
      ),
    );
  }
}

class StatsGrid extends StatelessWidget {
  const StatsGrid(this.player, {super.key});
  final Json player;
  @override
  Widget build(BuildContext context) => Wrap(
    spacing: 8,
    runSpacing: 8,
    children:
        {
              'totalMatches': '출전',
              'winRate': '승률 %',
              'goals': '득점',
              'assists': '도움',
              'mvpCount': 'MOM',
              'currentWinStreak': '최근 연승',
            }.entries
            .map(
              (e) => SizedBox(
                width: 100,
                child: Card(
                  margin: EdgeInsets.zero,
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      children: [
                        Text(
                          '${player[e.key] ?? 0}',
                          style: const TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.w900,
                            color: lime,
                          ),
                        ),
                        Text(e.value),
                      ],
                    ),
                  ),
                ),
              ),
            )
            .toList(),
  );
}

class MatchCard extends StatelessWidget {
  const MatchCard(this.match, {super.key, required this.onTap});
  final Json match;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Card(
    child: InkWell(
      borderRadius: BorderRadius.circular(18),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${day(match['matchDate'])} · ${match['location']}',
              style: const TextStyle(color: Colors.white60),
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: Text(
                    '${match['teamAName']}',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                ),
                Text(
                  '${match['teamAScore']} : ${match['teamBScore']}',
                  style: const TextStyle(
                    fontSize: 30,
                    fontWeight: FontWeight.w900,
                    color: lime,
                  ),
                ),
                Expanded(
                  child: Text(
                    '${match['teamBName']}',
                    textAlign: TextAlign.right,
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              match['status'] == 'COMPLETED'
                  ? '경기 종료 · ${match['winnerTeam'] ?? '무승부'}'
                  : '경기 진행 중',
              style: const TextStyle(color: Colors.white60),
            ),
          ],
        ),
      ),
    ),
  );
}

class PeriodFilter extends StatelessWidget {
  const PeriodFilter({super.key, required this.value, required this.onChanged});
  final DateTimeRange? value;
  final ValueChanged<DateTimeRange?> onChanged;
  @override
  Widget build(BuildContext context) => SingleChildScrollView(
    scrollDirection: Axis.horizontal,
    child: Row(
      children: [
        TextButton.icon(
          onPressed: () async {
            final now = DateTime.now();
            final result = await showDateRangePicker(
              context: context,
              firstDate: DateTime(2000),
              lastDate: DateTime(now.year + 2, 12, 31),
              initialDateRange: value,
            );
            if (result != null) onChanged(result);
          },
          icon: const Icon(Icons.date_range),
          label: Text(
            value == null
                ? '기간 선택'
                : '${day(value!.start.toIso8601String())} ~ ${day(value!.end.toIso8601String())}',
          ),
        ),
        TextButton(onPressed: () => onChanged(null), child: const Text('전체')),
        TextButton(
          onPressed: () => onChanged(
            DateTimeRange(
              start: DateTime(DateTime.now().year),
              end: DateTime(DateTime.now().year, 5, 31),
            ),
          ),
          child: const Text('상반기'),
        ),
        TextButton(
          onPressed: () => onChanged(
            DateTimeRange(
              start: DateTime(DateTime.now().year, 6),
              end: DateTime(DateTime.now().year, 11, 30),
            ),
          ),
          child: const Text('하반기'),
        ),
      ],
    ),
  );
}

Map<String, String> periodQuery(DateTimeRange? range) => range == null
    ? {}
    : {
        'startDate': day(range.start.toIso8601String()),
        'endDate': day(range.end.toIso8601String()),
      };
