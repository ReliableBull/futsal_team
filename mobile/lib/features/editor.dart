import 'dart:math';

import 'package:image_picker/image_picker.dart';
import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/widgets.dart';
import '../core/match_draft.dart';

class MatchEditor extends StatefulWidget {
  const MatchEditor(this.api, {super.key, this.match});
  final ArenaApi api;
  final Json? match;
  @override
  State<MatchEditor> createState() => _MatchEditorState();
}

class _MatchEditorState extends State<MatchEditor> {
  final form = GlobalKey<FormState>();
  late final MatchDraft draft;
  late final TextEditingController location, teamA, teamB, scoreA, scoreB, memo;
  late String date, status;
  bool busy = false;
  @override
  void initState() {
    super.initState();
    final m = widget.match;
    draft = MatchDraft(m);
    date = day(m?['matchDate'] ?? DateTime.now().toIso8601String());
    status = m?['status'] as String? ?? 'COMPLETED';
    location = TextEditingController(text: m?['location'] as String? ?? '');
    teamA = TextEditingController(text: m?['teamAName'] as String? ?? '회장팀');
    teamB = TextEditingController(text: m?['teamBName'] as String? ?? '총무팀');
    scoreA = TextEditingController(text: '${m?['teamAScore'] ?? 0}');
    scoreB = TextEditingController(text: '${m?['teamBScore'] ?? 0}');
    memo = TextEditingController(text: m?['memo'] as String? ?? '');
  }

  @override
  void dispose() {
    for (final c in [location, teamA, teamB, scoreA, scoreB, memo]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> save() async {
    if (!form.currentState!.validate()) return;
    setState(() => busy = true);
    try {
      final payload = {
        ...draft.toJson(),
        'matchDate': date,
        'status': status,
        'location': location.text.trim(),
        'teamAName': teamA.text.trim(),
        'teamBName': teamB.text.trim(),
        'teamAScore': int.parse(scoreA.text),
        'teamBScore': int.parse(scoreB.text),
        'memo': memo.text.trim(),
      };
      await widget.api.request(
        widget.match == null ? 'POST' : 'PUT',
        widget.match == null ? 'matches' : 'matches/${widget.match!['id']}',
        body: payload,
      );
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) notice(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Widget field(
    String label,
    TextEditingController controller, {
    bool number = false,
    bool optional = false,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: TextFormField(
      controller: controller,
      decoration: InputDecoration(labelText: label),
      keyboardType: number ? TextInputType.number : TextInputType.text,
      maxLines: label == '메모' ? 3 : 1,
      validator: (v) {
        if (!optional && (v == null || v.trim().isEmpty)) return '필수 입력입니다.';
        if (number &&
            (int.tryParse(v ?? '') == null ||
                int.parse(v!) < 0 ||
                int.parse(v) > 999)) {
          return '0~999 정수';
        }
        return null;
      },
    ),
  );
  @override
  Widget build(BuildContext context) => PopScope(
    canPop: !busy,
    child: Scaffold(
      appBar: AppBar(title: Text(widget.match == null ? '경기 등록' : '경기 수정')),
      body: DataView(
        load: () => widget.api.request(
          'GET',
          'players',
          query: {'includeInactive': 'true'},
        ),
        builder: (data, refresh) {
          final players = rows(data['players']);
          String name(int id) =>
              players
                  .where((p) => p['id'] == id)
                  .firstOrNull?['name']
                  ?.toString() ??
              '$id';
          return AbsorbPointer(
            absorbing: busy,
            child: Form(
              key: form,
              child: ListView(
                padding: const EdgeInsets.all(20),
                children: [
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.calendar_today),
                    title: Text(date),
                    trailing: const Icon(Icons.edit_calendar),
                    onTap: () async {
                      final result = await showDatePicker(
                        context: context,
                        initialDate: DateTime.parse(date),
                        firstDate: DateTime(2000),
                        lastDate: DateTime(DateTime.now().year + 2, 12, 31),
                      );
                      if (result != null) {
                        setState(() => date = day(result.toIso8601String()));
                      }
                    },
                  ),
                  DropdownButtonFormField<String>(
                    initialValue: status,
                    decoration: const InputDecoration(labelText: '경기 상태'),
                    items: const [
                      DropdownMenuItem(
                        value: 'COMPLETED',
                        child: Text('경기 완료'),
                      ),
                      DropdownMenuItem(
                        value: 'IN_PROGRESS',
                        child: Text('경기 진행 중'),
                      ),
                    ],
                    onChanged: (v) => status = v!,
                  ),
                  const SizedBox(height: 12),
                  field('장소', location),
                  field('A팀 이름', teamA),
                  field('B팀 이름', teamB),
                  Row(
                    children: [
                      Expanded(child: field('A팀 점수', scoreA, number: true)),
                      const SizedBox(width: 12),
                      Expanded(child: field('B팀 점수', scoreB, number: true)),
                    ],
                  ),
                  OutlinedButton(
                    onPressed: () => setState(() {
                      scoreA.text = '${draft.score('A')}';
                      scoreB.text = '${draft.score('B')}';
                    }),
                    child: const Text('선수 득점 합계로 점수 입력'),
                  ),
                  const SectionTitle(
                    '참가 선수 배정',
                    subtitle: '각 선수를 A팀 또는 B팀에 배정해주세요.',
                  ),
                  if (widget.match == null)
                    OutlinedButton.icon(
                      onPressed: () => setState(() {
                        final ids =
                            players
                                .where((p) => p['isActive'] == true)
                                .map((p) => p['id'] as int)
                                .toList()
                              ..shuffle(Random());
                        for (final id in draft.teams.keys.toList()) {
                          draft.assign(id, null);
                        }
                        for (var i = 0; i < ids.length; i++) {
                          draft.assign(ids[i], i.isEven ? 'A' : 'B');
                        }
                      }),
                      icon: const Icon(Icons.shuffle),
                      label: const Text('활성 선수 전체 랜덤 배정'),
                    ),
                  ...players
                      .where(
                        (p) =>
                            p['isActive'] == true ||
                            draft.teams.containsKey(p['id']),
                      )
                      .map((p) {
                        final id = p['id'] as int;
                        return Padding(
                          padding: const EdgeInsets.symmetric(vertical: 4),
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  '${p['name']}${p['isActive'] == false ? ' (비활성)' : ''}',
                                ),
                              ),
                              SegmentedButton<String>(
                                showSelectedIcon: false,
                                segments: const [
                                  ButtonSegment(value: '-', label: Text('미참가')),
                                  ButtonSegment(value: 'A', label: Text('A')),
                                  ButtonSegment(value: 'B', label: Text('B')),
                                ],
                                selected: {draft.teams[id] ?? '-'},
                                onSelectionChanged: (v) => setState(
                                  () => draft.assign(
                                    id,
                                    v.first == '-' ? null : v.first,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        );
                      }),
                  for (final team in ['A', 'B']) ...[
                    SectionTitle('$team팀 기록 · ${draft.members(team).length}명'),
                    ...draft
                        .members(team)
                        .map(
                          (id) => Card(
                            child: Padding(
                              padding: const EdgeInsets.all(14),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    name(id),
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w800,
                                      fontSize: 18,
                                    ),
                                  ),
                                  Row(
                                    children: [
                                      const Text('득점'),
                                      IconButton(
                                        onPressed: (draft.goals[id] ?? 0) > 0
                                            ? () => setState(
                                                () => draft.setGoals(
                                                  id,
                                                  draft.goals[id]! - 1,
                                                ),
                                              )
                                            : null,
                                        icon: const Icon(
                                          Icons.remove_circle_outline,
                                        ),
                                      ),
                                      Text('${draft.goals[id] ?? 0}'),
                                      IconButton(
                                        onPressed: (draft.goals[id] ?? 0) < 100
                                            ? () => setState(
                                                () => draft.setGoals(
                                                  id,
                                                  (draft.goals[id] ?? 0) + 1,
                                                ),
                                              )
                                            : null,
                                        icon: const Icon(
                                          Icons.add_circle_outline,
                                        ),
                                      ),
                                      const Spacer(),
                                      const Text('MOM'),
                                      Checkbox(
                                        value: draft.moms.contains(id),
                                        onChanged: (v) => setState(() {
                                          if (v == true) {
                                            draft.moms.add(id);
                                          } else {
                                            draft.moms.remove(id);
                                          }
                                        }),
                                      ),
                                    ],
                                  ),
                                  for (
                                    var i = 0;
                                    i < (draft.links[id]?.length ?? 0);
                                    i++
                                  )
                                    Padding(
                                      padding: const EdgeInsets.only(top: 8),
                                      child: DropdownButtonFormField<String>(
                                        key: ValueKey(
                                          '$id/$i/${draft.links[id]![i]}/${draft.teams}',
                                        ),
                                        isExpanded: true,
                                        initialValue:
                                            '${draft.links[id]![i] ?? 'NONE'}',
                                        decoration: InputDecoration(
                                          labelText: '${i + 1}번째 골 도움',
                                        ),
                                        items: [
                                          const DropdownMenuItem(
                                            value: 'NONE',
                                            child: Text('도움 없음'),
                                          ),
                                          const DropdownMenuItem(
                                            value: 'UNKNOWN',
                                            child: Text('기존 기록 · 도움 정보 미상'),
                                          ),
                                          ...draft
                                              .assistCandidates(id)
                                              .map(
                                                (candidate) => DropdownMenuItem(
                                                  value: '$candidate',
                                                  child: Text(name(candidate)),
                                                ),
                                              ),
                                        ],
                                        onChanged: (v) => setState(
                                          () =>
                                              draft.links[id]![i] = v == 'NONE'
                                              ? null
                                              : int.tryParse(v!) ?? 'UNKNOWN',
                                        ),
                                      ),
                                    ),
                                  if ((draft.legacyAssists[id] ?? 0) > 0)
                                    Text(
                                      '기존 도움 ${draft.legacyAssists[id]}개 · 미상 골이 있으면 기존 합계를 보존합니다.',
                                      style: const TextStyle(
                                        fontSize: 12,
                                        color: Colors.white60,
                                      ),
                                    ),
                                ],
                              ),
                            ),
                          ),
                        ),
                  ],
                  field('메모', memo, optional: true),
                  const SizedBox(height: 12),
                  FilledButton.icon(
                    onPressed: busy ? null : save,
                    icon: busy
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.save_outlined),
                    label: Text(busy ? '저장 중…' : '경기 저장'),
                  ),
                  const SizedBox(height: 30),
                ],
              ),
            ),
          );
        },
      ),
    ),
  );
}

class PlayerEditor extends StatefulWidget {
  const PlayerEditor(this.api, {super.key, this.player});
  final ArenaApi api;
  final Json? player;
  @override
  State<PlayerEditor> createState() => _PlayerEditorState();
}

class _PlayerEditorState extends State<PlayerEditor> {
  final form = GlobalKey<FormState>();
  late final TextEditingController name, nickname, number, image;
  late String position;
  late bool active;
  bool busy = false;
  XFile? photo;
  int? savedId;
  static const positions = [
    '공격수',
    '공격형미드필더',
    '미드필더',
    '수비형미드필더',
    '윙백',
    '풀백',
    '센터백',
  ];
  @override
  void initState() {
    super.initState();
    final p = widget.player;
    savedId = p?['id'] as int?;
    name = TextEditingController(text: p?['name'] as String?);
    nickname = TextEditingController(text: p?['nickname'] as String?);
    number = TextEditingController(text: p?['number']?.toString());
    image = TextEditingController(text: p?['profileImageUrl'] as String?);
    position = positions.contains(p?['position'])
        ? p!['position'] as String
        : '미드필더';
    active = p?['isActive'] as bool? ?? true;
  }

  @override
  void dispose() {
    for (final c in [name, nickname, number, image]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> save() async {
    if (!form.currentState!.validate()) return;
    setState(() => busy = true);
    try {
      final result = await widget.api.request(
        savedId == null ? 'POST' : 'PUT',
        savedId == null ? 'players' : 'players/$savedId',
        body: {
          'name': name.text.trim(),
          'nickname': nickname.text.trim(),
          'position': position,
          'number': number.text.isEmpty ? null : int.parse(number.text),
          'profileImageUrl': image.text.trim(),
          'isActive': active,
        },
      );
      savedId = result['player']['id'] as int;
      if (photo != null) {
        await widget.api.uploadImage(
          'players/$savedId/photo',
          await photo!.readAsBytes(),
          photo!.name,
        );
      }
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) notice(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: !busy,
    child: Scaffold(
      appBar: AppBar(title: Text(widget.player == null ? '선수 등록' : '선수 수정')),
      body: AbsorbPointer(
        absorbing: busy,
        child: Form(
          key: form,
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              for (final entry in {
                name: '이름',
                nickname: '닉네임',
                number: '등번호',
                image: '프로필 이미지 경로 또는 HTTPS 주소',
              }.entries)
                Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: TextFormField(
                    controller: entry.key,
                    decoration: InputDecoration(labelText: entry.value),
                    keyboardType: entry.key == number
                        ? TextInputType.number
                        : TextInputType.text,
                    validator: (v) {
                      if (entry.key == name &&
                          (v == null || v.trim().isEmpty)) {
                        return '이름을 입력해주세요.';
                      }
                      if (entry.key == number &&
                          v!.isNotEmpty &&
                          (int.tryParse(v) == null ||
                              int.parse(v) < 0 ||
                              int.parse(v) > 999)) {
                        return '0~999 정수를 입력해주세요.';
                      }
                      return null;
                    },
                  ),
                ),
              OutlinedButton.icon(
                onPressed: () async {
                  try {
                    final picked = await ImagePicker().pickImage(
                      source: ImageSource.gallery,
                      maxWidth: 1200,
                      imageQuality: 90,
                    );
                    if (picked != null && mounted) {
                      setState(() => photo = picked);
                    }
                  } catch (e) {
                    if (context.mounted) notice(context, e);
                  }
                },
                icon: const Icon(Icons.add_a_photo_outlined),
                label: Text(
                  photo == null ? '프로필 사진 선택' : '사진 선택됨 · 저장하면 업로드됩니다',
                ),
              ),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                initialValue: position,
                decoration: const InputDecoration(labelText: '포지션'),
                items: positions
                    .map((p) => DropdownMenuItem(value: p, child: Text(p)))
                    .toList(),
                onChanged: (v) => position = v!,
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('선수 목록에 표시'),
                subtitle: const Text('경기 기록이 있는 선수는 삭제 대신 비활성화할 수 있습니다.'),
                value: active,
                onChanged: (v) => setState(() => active = v),
              ),
              FilledButton(
                onPressed: busy ? null : save,
                child: Text(busy ? '저장 중…' : '저장'),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
