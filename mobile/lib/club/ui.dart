import 'package:flutter/material.dart';

import '../core/widgets.dart';
import 'club_api.dart';

export '../core/widgets.dart' show lime, notice, openPage, SectionTitle, EmptyCard;

const roleLabels = {'owner': '소유자', 'manager': '운영진', 'recorder': '기록 담당자', 'member': '일반 회원'};
const membershipLabels = {
  'pending': '가입 승인 대기',
  'approved': '회원',
  'rejected': '가입 거절됨',
  'left': '탈퇴',
  'banned': '이용 제한',
};
const matchStatusLabels = {'scheduled': '예정', 'in_progress': '진행 중', 'completed': '완료', 'cancelled': '취소'};
const bookingStatusLabels = {
  'pending_approval': '구장 승인 대기',
  'pending_payment': '결제 대기',
  'confirmed': '예약 확정',
  'cancelled': '취소됨',
  'expired': '만료됨',
};

String won(num value) =>
    '${value.toInt().toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => ',')}원';

class Chip2 extends StatelessWidget {
  const Chip2(this.text, {super.key, this.color = Colors.white24, this.textColor, this.icon});
  final String text;
  final Color color;
  final Color? textColor;
  final IconData? icon;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(color: color.withValues(alpha: 0.18), borderRadius: BorderRadius.circular(20),
            border: Border.all(color: color.withValues(alpha: 0.6))),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          if (icon != null) ...[Icon(icon, size: 13, color: textColor ?? color), const SizedBox(width: 4)],
          Text(text, style: TextStyle(fontSize: 12, color: textColor ?? Colors.white, fontWeight: FontWeight.w600)),
        ]),
      );
}

class DemoBadge extends StatelessWidget {
  const DemoBadge({super.key, this.text = '예시 동호회'});
  final String text;
  @override
  Widget build(BuildContext context) => Chip2(text, color: Colors.orangeAccent, icon: Icons.science_outlined);
}

Widget matchStatusChip(String status) => Chip2(matchStatusLabels[status] ?? status,
    color: switch (status) {
      'completed' => lime,
      'in_progress' => Colors.lightBlueAccent,
      'cancelled' => Colors.redAccent,
      _ => Colors.white54,
    });

Widget bookingStatusChip(String status) => Chip2(bookingStatusLabels[status] ?? status,
    color: switch (status) {
      'confirmed' => lime,
      'pending_approval' || 'pending_payment' => Colors.amberAccent,
      _ => Colors.white38,
    });

/// Network image that sends the session token (needed for members-only
/// club files) and falls back to initials.
class NetImage extends StatelessWidget {
  const NetImage(this.api, this.path, {super.key, this.size = 44, this.label = '?', this.round = true, this.fit = BoxFit.cover});
  final ClubApi api;
  final Object? path;
  final double size;
  final String label;
  final bool round;
  final BoxFit fit;
  @override
  Widget build(BuildContext context) {
    final url = api.fileUrl(path);
    final fallback = Center(
        child: Text(label.isEmpty ? '?' : label.characters.first,
            style: TextStyle(color: lime, fontWeight: FontWeight.bold, fontSize: size * 0.4)));
    final child = SizedBox(
      width: size,
      height: size,
      child: ColoredBox(
        color: Colors.white10,
        child: url == null
            ? fallback
            : Image.network(url, headers: api.imageHeaders, fit: fit, errorBuilder: (_, e, s) => fallback),
      ),
    );
    return round ? ClipOval(child: child) : ClipRRect(borderRadius: BorderRadius.circular(12), child: child);
  }
}

/// Loads data and renders loading / error / members-only states uniformly.
class AsyncView extends StatefulWidget {
  const AsyncView({super.key, required this.load, required this.builder, this.onMembersOnly});
  final Future<Json> Function() load;
  final Widget Function(Json data, Future<void> Function() refresh) builder;
  final Widget Function(ClubApiException error)? onMembersOnly;
  @override
  State<AsyncView> createState() => _AsyncViewState();
}

class _AsyncViewState extends State<AsyncView> {
  late Future<Json> future = widget.load();
  Future<void> refresh() async {
    if (!mounted) return;
    setState(() => future = widget.load());
    try {
      await future;
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<Json>(
        future: future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
          final error = snap.error;
          if (error is ClubApiException && error.membersOnly) {
            return widget.onMembersOnly?.call(error) ?? LockedCard(message: error.message);
          }
          if (error != null) return ErrorRetry(message: '$error', onRetry: refresh);
          return RefreshIndicator(onRefresh: refresh, child: widget.builder(snap.data!, refresh));
        },
      );
}

class ErrorRetry extends StatelessWidget {
  const ErrorRetry({super.key, required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) => Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.cloud_off, size: 48),
            const SizedBox(height: 16),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            FilledButton(onPressed: onRetry, child: const Text('다시 시도')),
          ]),
        ),
      );
}

class LockedCard extends StatelessWidget {
  const LockedCard({super.key, required this.message, this.action});
  final String message;
  final Widget? action;
  @override
  Widget build(BuildContext context) => ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(children: [
                const Icon(Icons.lock_outline, size: 42, color: lime),
                const SizedBox(height: 12),
                Text(message, textAlign: TextAlign.center),
                if (action != null) ...[const SizedBox(height: 16), action!],
              ]),
            ),
          ),
        ],
      );
}

/// Period choice built from the club's own season settings.
class SeasonPicker extends StatelessWidget {
  const SeasonPicker({super.key, required this.seasons, required this.value, required this.onChanged});
  final List<Json> seasons;
  final DateTimeRange? value;
  final ValueChanged<DateTimeRange?> onChanged;

  static DateTimeRange range(Json s) =>
      DateTimeRange(start: DateTime.parse(s['startDate'] as String), end: DateTime.parse(s['endDate'] as String));

  @override
  Widget build(BuildContext context) {
    String label(DateTimeRange r) => '${day(r.start.toIso8601String())} ~ ${day(r.end.toIso8601String())}';
    bool same(DateTimeRange a, DateTimeRange? b) => b != null && a.start == b.start && a.end == b.end;
    final matchedSeason = seasons.any((s) => same(range(s), value));
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: Row(children: [
        ChoiceChip(label: const Text('전체'), selected: value == null, onSelected: (_) => onChanged(null)),
        for (final s in seasons) ...[
          const SizedBox(width: 6),
          ChoiceChip(label: Text('${s['label']}'), selected: same(range(s), value), onSelected: (_) => onChanged(range(s))),
        ],
        const SizedBox(width: 6),
        ActionChip(
          avatar: const Icon(Icons.date_range, size: 16),
          label: Text(value != null && !matchedSeason ? label(value!) : '직접 선택'),
          onPressed: () async {
            final now = DateTime.now();
            final r = await showDateRangePicker(
                context: context, firstDate: DateTime(2000), lastDate: DateTime(now.year + 2, 12, 31), initialDateRange: value);
            if (r != null) onChanged(r);
          },
        ),
      ]),
    );
  }
}

Map<String, String> periodQuery(DateTimeRange? r) => r == null
    ? {}
    : {'startDate': day(r.start.toIso8601String()), 'endDate': day(r.end.toIso8601String())};

String periodLabel(DateTimeRange? r) =>
    r == null ? '전체 기간' : '${day(r.start.toIso8601String())} ~ ${day(r.end.toIso8601String())}';

class StatTile extends StatelessWidget {
  const StatTile(this.value, this.label, {super.key, this.width = 96});
  final String value;
  final String label;
  final double width;
  @override
  Widget build(BuildContext context) => SizedBox(
        width: width,
        child: Card(
          margin: EdgeInsets.zero,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 6),
            child: Column(children: [
              FittedBox(child: Text(value, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: lime))),
              Text(label, style: const TextStyle(fontSize: 12, color: Colors.white70), textAlign: TextAlign.center),
            ]),
          ),
        ),
      );
}

Future<bool> confirmAction(BuildContext context, String message, {String ok = '확인'}) async =>
    await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('확인'),
        content: Text(message),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('취소')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: Text(ok)),
        ],
      ),
    ) ??
    false;

/// Runs an action, shows its error as a snackbar, returns success.
Future<bool> guarded(BuildContext context, Future<void> Function() action) async {
  try {
    await action();
    return true;
  } catch (e) {
    if (context.mounted) notice(context, e);
    return false;
  }
}
