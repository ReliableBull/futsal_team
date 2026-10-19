import 'package:flutter/material.dart';

import 'bookings.dart';
import 'club_api.dart';
import 'ui.dart';

const amenityLabels = {'parking': '주차', 'shower': '샤워실', 'restroom': '화장실', 'ballRental': '공 대여'};
const bookingModeLabels = {
  'instant': '예약 즉시 확정',
  'approval': '구장 승인 후 확정',
  'payment': '결제 완료 후 확정',
};

/// Placeholder art. Demo venues never use photos that could pass for a real business.
class VenueArt extends StatelessWidget {
  const VenueArt(this.venue, {super.key, this.height = 120});
  final Json venue;
  final double height;
  @override
  Widget build(BuildContext context) => Container(
        height: height,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          gradient: LinearGradient(
            colors: venue['indoor'] == true
                ? const [Color(0xFF243B55), Color(0xFF141E30)]
                : const [Color(0xFF2E5E3A), Color(0xFF16261B)],
          ),
        ),
        child: Stack(children: [
          Center(child: Icon(venue['indoor'] == true ? Icons.stadium_outlined : Icons.grass, size: height * 0.45, color: Colors.white24)),
          if (venue['isDemo'] == true)
            const Positioned(left: 10, top: 10, child: DemoBadge(text: '예시 풋살장 · 실제 예약 아님')),
        ]),
      );
}

class VenuesTab extends StatefulWidget {
  const VenuesTab(this.api, {super.key});
  final ClubApi api;
  @override
  State<VenuesTab> createState() => _VenuesTabState();
}

class _VenuesTabState extends State<VenuesTab> {
  String q = '';
  String? region;
  bool? indoor;
  final Set<String> amenities = {};

  Map<String, String> get query => {
        if (q.isNotEmpty) 'q': q,
        'region': ?region,
        if (indoor != null) 'indoor': '$indoor',
        if (amenities.isNotEmpty) 'amenities': amenities.join(','),
      };

  @override
  Widget build(BuildContext context) => Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: TextField(
            decoration: const InputDecoration(hintText: '구장 이름·지역 검색', prefixIcon: Icon(Icons.search), isDense: true),
            onSubmitted: (v) => setState(() => q = v.trim()),
          ),
        ),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Row(children: [
            FilterChip(label: const Text('실내'), selected: indoor == true, onSelected: (s) => setState(() => indoor = s ? true : null)),
            const SizedBox(width: 6),
            FilterChip(label: const Text('실외'), selected: indoor == false, onSelected: (s) => setState(() => indoor = s ? false : null)),
            for (final e in amenityLabels.entries) ...[
              const SizedBox(width: 6),
              FilterChip(
                  label: Text(e.value),
                  selected: amenities.contains(e.key),
                  onSelected: (s) => setState(() => s ? amenities.add(e.key) : amenities.remove(e.key))),
            ],
          ]),
        ),
        const Padding(
          padding: EdgeInsets.fromLTRB(16, 4, 16, 0),
          child: Text('위치 권한 없이 지역·구장 이름으로 찾을 수 있습니다.', style: TextStyle(color: Colors.white54, fontSize: 12)),
        ),
        Expanded(
          child: AsyncView(
            key: ValueKey(query.toString()),
            load: () => widget.api.request('GET', 'venues', query: query),
            builder: (data, refresh) {
              final venues = rows(data['venues']);
              final regions = (data['regions'] as List? ?? []).cast<String>();
              return ListView(
                padding: const EdgeInsets.all(16),
                physics: const AlwaysScrollableScrollPhysics(),
                children: [
                  if (regions.length > 1)
                    Wrap(spacing: 6, children: [
                      for (final r in regions)
                        ChoiceChip(label: Text(r), selected: region == r, onSelected: (s) => setState(() => region = s ? r : null)),
                    ]),
                  if (venues.isEmpty) const EmptyCard('조건에 맞는 풋살장이 없습니다. 필터를 줄여보세요.'),
                  for (final v in venues) VenueCard(widget.api, v),
                ],
              );
            },
          ),
        ),
      ]);
}

class VenueCard extends StatelessWidget {
  const VenueCard(this.api, this.venue, {super.key});
  final ClubApi api;
  final Json venue;
  @override
  Widget build(BuildContext context) {
    final amenities = (venue['amenities'] as Map?) ?? {};
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: () => openPage(context, VenueScreen(api, venue['id'] as int)),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            VenueArt(venue, height: 96),
            const SizedBox(height: 10),
            Text('${venue['name']}', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
            Text('${venue['region']} · ${venue['areaLabel']}', style: const TextStyle(color: Colors.white60)),
            const SizedBox(height: 6),
            Wrap(spacing: 6, runSpacing: 4, children: [
              Chip2(venue['indoor'] == true ? '실내' : '실외'),
              Chip2('${venue['playFormat']}'),
              Chip2(bookingModeLabels[venue['bookingMode']] ?? '', color: Colors.lightBlueAccent),
              for (final e in amenityLabels.entries)
                if (amenities[e.key] == true) Chip2(e.value, color: Colors.white38),
            ]),
            const SizedBox(height: 6),
            Text('${(venue['slotMinutes'] as int) ~/ 60}시간 ${won(venue['pricePerSlot'] as num)}',
                style: const TextStyle(color: lime, fontWeight: FontWeight.bold)),
          ]),
        ),
      ),
    );
  }
}

class VenueScreen extends StatefulWidget {
  const VenueScreen(this.api, this.venueId, {super.key, this.changeBooking});
  final ClubApi api;
  final int venueId;

  /// When set, picking a slot moves this booking instead of creating one.
  final Json? changeBooking;
  @override
  State<VenueScreen> createState() => _VenueScreenState();
}

class _VenueScreenState extends State<VenueScreen> {
  String? date;
  int slotsVersion = 0;

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: Text(widget.changeBooking == null ? '풋살장' : '예약 시간 변경')),
        body: AsyncView(
          load: () => widget.api.request('GET', 'venues/${widget.venueId}'),
          builder: (data, refresh) {
            final v = data['venue'] as Json;
            final dates = (data['dates'] as List).cast<String>();
            date ??= dates.isEmpty ? null : dates.first;
            final amenities = (v['amenities'] as Map?) ?? {};
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                VenueArt(v, height: 150),
                const SizedBox(height: 12),
                Text('${v['name']}', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900)),
                if (v['isDemo'] == true)
                  Container(
                    margin: const EdgeInsets.only(top: 8),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: Colors.orange.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(12)),
                    child: const Text('예시 풋살장 · 실제 예약 아님\n가상의 데모 시설입니다. 예약은 테스트 서버에만 저장되며 실제 구장 예약·결제·문자 발송이 일어나지 않습니다.',
                        style: TextStyle(color: Colors.orangeAccent)),
                  ),
                const SizedBox(height: 8),
                Text('${v['region']} · ${v['areaLabel']}', style: const TextStyle(color: Colors.white60)),
                if (v['description'] != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text('${v['description']}')),
                const SectionTitle('시설 정보'),
                Wrap(spacing: 6, runSpacing: 6, children: [
                  Chip2(v['indoor'] == true ? '실내' : '실외'),
                  Chip2('${v['playFormat']}'),
                  if (v['surface'] != null) Chip2('${v['surface']}'),
                  for (final e in amenityLabels.entries)
                    Chip2('${e.value} ${amenities[e.key] == true ? '있음' : '없음'}',
                        color: amenities[e.key] == true ? lime : Colors.white24),
                ]),
                const SectionTitle('요금·예약 규정'),
                Text('${(v['slotMinutes'] as int) ~/ 60}시간 ${won(v['pricePerSlot'] as num)} · 운영 ${v['openHour']}:00~${v['closeHour']}:00'),
                Text('확정 방식: ${bookingModeLabels[v['bookingMode']]}'),
                Text('취소: 이용 시작 ${v['cancelDeadlineHours']}시간 전까지 가능'),
                if (v['bookingMode'] == 'payment') Text('결제 대기 시간: ${v['paymentHoldMinutes']}분 (지나면 자동 만료)'),
                const SectionTitle('예약 가능 시간', subtitle: '서울 시간 기준 오늘부터 14일'),
                SizedBox(
                  height: 64,
                  child: ListView(scrollDirection: Axis.horizontal, children: [
                    for (final d in dates)
                      Padding(
                        padding: const EdgeInsets.only(right: 6),
                        child: ChoiceChip(
                          label: Text('${DateTime.parse(d).month}/${DateTime.parse(d).day}\n${'월화수목금토일'[DateTime.parse(d).weekday - 1]}',
                              textAlign: TextAlign.center),
                          selected: d == date,
                          onSelected: (_) => setState(() => date = d),
                        ),
                      ),
                  ]),
                ),
                const SizedBox(height: 8),
                const Wrap(spacing: 10, children: [
                  _Legend('예약 가능', lime), _Legend('예약 완료', Colors.white24),
                  _Legend('승인/결제 대기', Colors.amberAccent), _Legend('운영 중단', Colors.redAccent),
                ]),
                const SizedBox(height: 8),
                if (date != null)
                  SlotGrid(
                    key: ValueKey('$date/$slotsVersion'),
                    api: widget.api,
                    venueId: widget.venueId,
                    date: date!,
                    onPick: (slot) async {
                      final changed = widget.changeBooking == null
                          ? await openPage<bool>(context, BookingFlowScreen(widget.api, venue: v, slot: slot, date: date!))
                          : await _change(slot);
                      if (!context.mounted) return;
                      if (widget.changeBooking != null && changed == true) {
                        Navigator.pop(context, true);
                      } else {
                        setState(() => slotsVersion++);
                      }
                    },
                  ),
                const SizedBox(height: 24),
              ],
            );
          },
        ),
      );

  Future<bool> _change(Json slot) async {
    if (!await confirmAction(context, '$date ${slot['start']} 으로 예약 시간을 변경할까요?', ok: '변경')) return false;
    if (!mounted) return false;
    return guarded(context, () async {
      await widget.api.request('POST', 'bookings/${widget.changeBooking!['code']}/change',
          body: {'slotId': slot['id']}, guest: true);
      if (mounted) notice(context, '예약 시간을 변경했습니다.');
    });
  }
}

class _Legend extends StatelessWidget {
  const _Legend(this.label, this.color);
  final String label;
  final Color color;
  @override
  Widget build(BuildContext context) => Row(mainAxisSize: MainAxisSize.min, children: [
        Container(width: 10, height: 10, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 4),
        Text(label, style: const TextStyle(fontSize: 12, color: Colors.white70)),
      ]);
}

class SlotGrid extends StatelessWidget {
  const SlotGrid({super.key, required this.api, required this.venueId, required this.date, required this.onPick});
  final ClubApi api;
  final int venueId;
  final String date;
  final ValueChanged<Json> onPick;
  @override
  Widget build(BuildContext context) => SizedBox(
        height: 260,
        child: AsyncView(
          load: () => api.request('GET', 'venues/$venueId/slots', query: {'date': date}),
          builder: (data, refresh) {
            final slots = rows(data['slots']);
            if (slots.isEmpty) return const EmptyCard('이 날짜에는 예약 가능한 시간이 없습니다.');
            return GridView.count(
              crossAxisCount: 3,
              childAspectRatio: 1.7,
              mainAxisSpacing: 8,
              crossAxisSpacing: 8,
              children: [
                for (final s in slots)
                  _SlotButton(slot: s, onTap: s['availability'] == 'available' ? () => onPick(s) : null),
              ],
            );
          },
        ),
      );
}

class _SlotButton extends StatelessWidget {
  const _SlotButton({required this.slot, this.onTap});
  final Json slot;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) {
    final a = slot['availability'] as String;
    final color = switch (a) {
      'available' => lime,
      'pending' => Colors.amberAccent,
      'closed' => Colors.redAccent,
      _ => Colors.white24,
    };
    final label = switch (a) {
      'available' => won(slot['price'] as num),
      'pending' => '승인/결제 대기',
      'booked' => '예약 완료',
      'closed' => '운영 중단',
      _ => '지난 시간',
    };
    return Semantics(
      button: onTap != null,
      label: '${slot['start']} $label',
      child: OutlinedButton(
        style: OutlinedButton.styleFrom(
            padding: const EdgeInsets.all(4), side: BorderSide(color: color.withValues(alpha: 0.7)),
            backgroundColor: a == 'available' ? lime.withValues(alpha: 0.08) : null),
        onPressed: onTap,
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text('${slot['start']}', style: TextStyle(fontWeight: FontWeight.bold, color: onTap == null ? Colors.white38 : Colors.white)),
          FittedBox(child: Text(label, style: TextStyle(fontSize: 11, color: color))),
        ]),
      ),
    );
  }
}

/// 날짜·시간 선택 → 예약자 정보 → 연락처 확인 → 요금·취소 조건 동의 → 신청.
class BookingFlowScreen extends StatefulWidget {
  const BookingFlowScreen(this.api, {super.key, required this.venue, required this.slot, required this.date});
  final ClubApi api;
  final Json venue;
  final Json slot;
  final String date;
  @override
  State<BookingFlowScreen> createState() => _BookingFlowScreenState();
}

class _BookingFlowScreenState extends State<BookingFlowScreen> {
  final form = GlobalKey<FormState>();
  final name = TextEditingController(), note = TextEditingController();
  int headcount = 10;
  bool agree = false, busy = false;
  // Kept across retries so a lost response never creates a second booking.
  final String idempotencyKey = ClubApi.newIdempotencyKey();
  String? error;

  @override
  void initState() {
    super.initState();
    name.text = widget.api.account?['displayName'] as String? ?? '';
  }

  @override
  void dispose() {
    name.dispose();
    note.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    if (!form.currentState!.validate()) return;
    if (!agree) return setState(() => error = '요금과 취소 규정에 동의해주세요.');
    if (!widget.api.hasGuest) {
      final ok = await openPage<bool>(context, PhoneVerifyScreen(widget.api, purpose: '예약자 연락처 확인'));
      if (ok != true || !mounted) return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final data = await widget.api.request('POST', 'venues/${widget.venue['id']}/bookings', guest: true, body: {
        'slotId': widget.slot['id'],
        'bookerName': name.text.trim(),
        'headcount': headcount,
        'note': note.text.trim(),
        'agreePolicy': true,
        'idempotencyKey': idempotencyKey,
      });
      if (!mounted) return;
      await Navigator.pushReplacement(context,
          MaterialPageRoute(builder: (_) => BookingDetailScreen(widget.api, data['booking'] as Json, justCreated: true)));
    } on ClubApiException catch (e) {
      if (!mounted) return;
      if (e.code == 'slot_taken' || e.code == 'slot_closed' || e.code == 'slot_past') {
        await showDialog<void>(
          context: context,
          builder: (c) => AlertDialog(
            title: const Text('예약할 수 없는 시간'),
            content: Text(e.message),
            actions: [FilledButton(onPressed: () => Navigator.pop(c), child: const Text('다른 시간 고르기'))],
          ),
        );
        if (mounted) Navigator.pop(context, false);
        return;
      }
      setState(() => error = e.network ? '${e.message}\n같은 요청으로 다시 시도해도 중복 예약되지 않습니다.' : e.message);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final v = widget.venue;
    return Scaffold(
      appBar: AppBar(title: const Text('예약 신청')),
      body: Form(
        key: form,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            if (v['isDemo'] == true) const DemoBadge(text: '예시 풋살장 · 실제 예약 아님'),
            const SizedBox(height: 8),
            Text('${v['name']}', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
            Text('${widget.date} ${widget.slot['start']} 부터 ${(v['slotMinutes'] as int) ~/ 60}시간'),
            const SectionTitle('예약자 정보', subtitle: '회원가입 없이 개인 명의로 예약합니다.'),
            TextFormField(
              controller: name,
              decoration: const InputDecoration(labelText: '예약자 이름'),
              validator: (s) => (s ?? '').trim().isEmpty ? '이름을 입력해주세요.' : null,
              maxLength: 20,
            ),
            Row(children: [
              const Text('인원'),
              IconButton(onPressed: headcount > 1 ? () => setState(() => headcount--) : null, icon: const Icon(Icons.remove)),
              Text('$headcount명'),
              IconButton(onPressed: headcount < 30 ? () => setState(() => headcount++) : null, icon: const Icon(Icons.add)),
            ]),
            TextFormField(controller: note, decoration: const InputDecoration(labelText: '요청 사항 (선택)'), maxLength: 200),
            const SectionTitle('연락처 확인'),
            ListenableBuilder(
              listenable: widget.api,
              builder: (context, _) => ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(widget.api.hasGuest ? Icons.verified : Icons.phone_iphone, color: widget.api.hasGuest ? lime : null),
                title: Text(widget.api.hasGuest ? '${widget.api.guestPhone} 확인 완료' : '휴대폰 번호 확인이 필요합니다'),
                subtitle: const Text('예약 조회·취소 시 본인 확인에 사용됩니다.'),
                trailing: TextButton(
                  onPressed: () => openPage(context, PhoneVerifyScreen(widget.api, purpose: '예약자 연락처 확인')),
                  child: Text(widget.api.hasGuest ? '변경' : '확인하기'),
                ),
              ),
            ),
            const SectionTitle('요금·취소 조건'),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('이용 요금 ${won(widget.slot['price'] as num)}', style: const TextStyle(fontWeight: FontWeight.bold, color: lime)),
                  Text('확정 방식: ${bookingModeLabels[v['bookingMode']]}'),
                  if (v['bookingMode'] == 'approval') const Text('구장 승인 전까지는 확정이 아닙니다.'),
                  if (v['bookingMode'] == 'payment')
                    Text('신청 후 ${v['paymentHoldMinutes']}분 안에 결제해야 확정됩니다. 데모 시설은 데모 결제만 가능하며 실제 결제가 일어나지 않습니다.'),
                  Text('취소: 이용 시작 ${v['cancelDeadlineHours']}시간 전까지 가능, 이후에는 취소할 수 없습니다.'),
                ]),
              ),
            ),
            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              value: agree,
              onChanged: (value) => setState(() => agree = value ?? false),
              title: const Text('요금과 취소 규정을 확인했습니다.'),
            ),
            if (error != null) Text(error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: busy ? null : submit,
              style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(50)),
              child: Text(busy ? '신청 중…' : (v['bookingMode'] == 'instant' ? '예약하기' : '예약 신청하기')),
            ),
          ],
        ),
      ),
    );
  }
}
