import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:share_plus/share_plus.dart';

import 'club_api.dart';
import 'ui.dart';

/// Previews a card and shares it as a PNG through the system share sheet
/// (which also offers "save image" / "save to files").
Future<void> showShareCard(BuildContext context, ClubApi api, Widget Function(int photo) card,
    {required String fileName, List<String> photoLabels = const []}) {
  final boundary = GlobalKey();
  var photo = 0;
  var busy = false;
  return showDialog<void>(
    context: context,
    builder: (context) => StatefulBuilder(
      builder: (context, setState) => AlertDialog(
        contentPadding: const EdgeInsets.all(12),
        content: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            FittedBox(child: RepaintBoundary(key: boundary, child: card(photo))),
            if (photoLabels.length > 1)
              Wrap(spacing: 6, children: [
                for (var i = 0; i < photoLabels.length; i++)
                  ChoiceChip(label: Text(photoLabels[i]), selected: photo == i, onSelected: (_) => setState(() => photo = i)),
              ]),
          ]),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('닫기')),
          FilledButton.icon(
            onPressed: busy
                ? null
                : () async {
                    setState(() => busy = true);
                    try {
                      final render = boundary.currentContext!.findRenderObject() as RenderRepaintBoundary;
                      final image = await render.toImage(pixelRatio: 3);
                      final png = await image.toByteData(format: ui.ImageByteFormat.png);
                      await SharePlus.instance.share(ShareParams(
                        files: [XFile.fromData(png!.buffer.asUint8List(), mimeType: 'image/png', name: '$fileName.png')],
                        fileNameOverrides: ['$fileName.png'],
                      ));
                    } catch (e) {
                      if (context.mounted) notice(context, '이미지를 만들지 못했습니다: $e');
                    } finally {
                      if (context.mounted) setState(() => busy = false);
                    }
                  },
            icon: const Icon(Icons.ios_share),
            label: const Text('저장·공유'),
          ),
        ],
      ),
    ),
  );
}

BoxDecoration _cardBox() => BoxDecoration(
      borderRadius: BorderRadius.circular(24),
      gradient: const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight,
          colors: [Color(0xFF243B25), Color(0xFF0C1219)]),
      border: Border.all(color: lime.withValues(alpha: 0.5)),
    );

class PlayerShareCard extends StatelessWidget {
  const PlayerShareCard({super.key, required this.api, required this.club, required this.player, required this.period, this.photo});
  final ClubApi api;
  final Json club;
  final Json player;
  final String period;
  final Json? photo;
  @override
  Widget build(BuildContext context) {
    final p = player;
    Widget stat(String v, String l) => Column(children: [
          Text(v, style: const TextStyle(color: lime, fontSize: 26, fontWeight: FontWeight.w900)),
          Text(l, style: const TextStyle(color: Colors.white70, fontSize: 12)),
        ]);
    final url = api.fileUrl(photo?['url'] ?? p['photoUrl']);
    return Material(
      color: Colors.transparent,
      child: Container(
        width: 340,
        padding: const EdgeInsets.all(20),
        decoration: _cardBox(),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Row(children: [
            Expanded(child: Text('${club['name']}', style: const TextStyle(color: lime, letterSpacing: 2, fontWeight: FontWeight.bold))),
            if (club['isDemo'] == true) const DemoBadge(),
          ]),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(18),
            child: SizedBox(
              width: 160,
              height: 200,
              child: ColoredBox(
                color: Colors.white10,
                child: url == null
                    ? Center(child: Text('${p['name']}'.characters.first, style: const TextStyle(fontSize: 72, color: lime)))
                    : Image.network(url, headers: api.imageHeaders,
                        fit: photo?['fit'] == 'contain' ? BoxFit.contain : BoxFit.cover,
                        errorBuilder: (_, e, s) => const Icon(Icons.person, size: 80)),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Text('${p['name']}${p['number'] == null ? '' : '  #${p['number']}'}',
              style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: Colors.white)),
          Text(period, style: const TextStyle(color: Colors.white54, fontSize: 12)),
          const SizedBox(height: 12),
          Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
            stat('${p['matches']}', '출전'), stat('${p['goals']}', '득점'), stat('${p['assists']}', '도움'), stat('${p['mom']}', 'MOM'),
          ]),
          const SizedBox(height: 8),
          Text('${p['wins']}승 ${p['draws']}무 ${p['losses']}패 · 승률 ${p['winRate']}%', style: const TextStyle(color: Colors.white)),
        ]),
      ),
    );
  }
}

class MatchShareCard extends StatelessWidget {
  const MatchShareCard({super.key, required this.api, required this.club, required this.match});
  final ClubApi api;
  final Json club;
  final Json match;
  @override
  Widget build(BuildContext context) {
    final m = match;
    List<String> scorers(String team) => [
          for (final p in rows(m['players']).where((p) => p['team'] == team && (p['goals'] as int) > 0))
            '${(p['player'] as Json)['name']} ${p['goals']}골',
        ];
    final moms = [for (final p in rows(m['players']).where((p) => p['isMom'] == true)) '${(p['player'] as Json)['name']}'];
    return Material(
      color: Colors.transparent,
      child: Container(
        width: 340,
        padding: const EdgeInsets.all(20),
        decoration: _cardBox(),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Row(children: [
            Expanded(child: Text('${club['name']}', style: const TextStyle(color: lime, letterSpacing: 2, fontWeight: FontWeight.bold))),
            if (club['isDemo'] == true) const DemoBadge(),
          ]),
          const SizedBox(height: 6),
          Text('${m['matchDate']} · ${m['location'] ?? ''}', style: const TextStyle(color: Colors.white60)),
          const SizedBox(height: 14),
          Row(children: [
            Expanded(child: Text('${m['teamAName']}', textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold))),
            Text('${m['teamAScore']} : ${m['teamBScore']}', style: const TextStyle(fontSize: 40, fontWeight: FontWeight.w900, color: lime)),
            Expanded(child: Text('${m['teamBName']}', textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold))),
          ]),
          const SizedBox(height: 10),
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(child: Text(scorers('A').join('\n'), style: const TextStyle(color: Colors.white70, fontSize: 12))),
            Expanded(child: Text(scorers('B').join('\n'), textAlign: TextAlign.right, style: const TextStyle(color: Colors.white70, fontSize: 12))),
          ]),
          if (moms.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text('MOM  ${moms.join(', ')}', style: const TextStyle(color: lime, fontWeight: FontWeight.bold)),
          ],
        ]),
      ),
    );
  }
}
