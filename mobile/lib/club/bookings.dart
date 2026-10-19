import 'package:flutter/material.dart';

import 'auth.dart';
import 'club_api.dart';
import 'ui.dart';
import 'venues.dart';

/// 내 예약: members see account bookings; anyone can find guest bookings
/// after verifying the phone number used (works on a new device too).
class MyBookingsTab extends StatefulWidget {
  const MyBookingsTab(this.api, {super.key});
  final ClubApi api;
  @override
  State<MyBookingsTab> createState() => _MyBookingsTabState();
}

class _MyBookingsTabState extends State<MyBookingsTab> {
  int version = 0;

  Future<Json> load() async {
    final api = widget.api;
    final member = api.loggedIn ? rows((await api.request('GET', 'me/bookings'))['bookings']) : <Json>[];
    var guest = <Json>[];
    String? guestError;
    if (api.hasGuest) {
      try {
        guest = rows((await api.request('GET', 'guest/bookings', guest: true))['bookings']);
      } on ClubApiException catch (e) {
        guestError = e.message;
      }
    }
    final seen = member.map((b) => b['code']).toSet();
    return {'member': member, 'guest': guest.where((b) => !seen.contains(b['code'])).toList(), 'guestError': guestError};
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
        listenable: widget.api,
        builder: (context, _) => AsyncView(
          key: ValueKey('${widget.api.loggedIn}/${widget.api.hasGuest}/$version'),
          load: load,
          builder: (data, refresh) {
            final api = widget.api;
            final member = rows(data['member']), guest = rows(data['guest']);
            return ListView(
              padding: const EdgeInsets.all(16),
              physics: const AlwaysScrollableScrollPhysics(),
              children: [
                if (api.loggedIn) ...[
                  SectionTitle('회원 예약', subtitle: '${api.account!['displayName']} 계정에 연결된 예약'),
                  if (member.isEmpty) const EmptyCard('계정에 연결된 예약이 없습니다.'),
                  for (final b in member) BookingCard(api, b, onChanged: () => setState(() => version++)),
                ],
                SectionTitle('비회원 예약', subtitle: api.hasGuest ? '${api.guestPhone} 인증됨' : '예약할 때 사용한 휴대폰 번호로 찾습니다.'),
                if (!api.hasGuest)
                  Card(
                    child: ListTile(
                      leading: const Icon(Icons.phone_iphone),
                      title: const Text('휴대폰 인증으로 예약 찾기'),
                      subtitle: const Text('다른 기기에서도 본인 확인 후 예약을 확인할 수 있습니다.'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () async {
                        if (await openPage<bool>(context, PhoneVerifyScreen(api, purpose: '예약 조회 본인 확인')) == true) {
                          setState(() => version++);
                        }
                      },
                    ),
                  )
                else ...[
                  if (data['guestError'] != null) Text('${data['guestError']}', style: const TextStyle(color: Colors.redAccent)),
                  if (guest.isEmpty) const EmptyCard('이 번호로 된 예약이 없습니다.'),
                  for (final b in guest) BookingCard(api, b, onChanged: () => setState(() => version++)),
                  Wrap(spacing: 8, children: [
                    if (api.loggedIn && guest.any((b) => b['linkedToAccount'] != true))
                      FilledButton.tonal(
                        onPressed: () async {
                          final ok = await guarded(context, () async {
                            final r = await api.request('POST', 'me/bookings/link', guest: true);
                            if (context.mounted) notice(context, '${r['linked']}건의 예약을 계정에 연결했습니다.');
                          });
                          if (ok) setState(() => version++);
                        },
                        child: const Text('인증된 예약을 내 계정에 연결'),
                      ),
                    TextButton(onPressed: () => api.clearGuest(), child: const Text('이 기기에서 인증 해제')),
                  ]),
                ],
                if (!api.loggedIn)
                  Padding(
                    padding: const EdgeInsets.only(top: 24),
                    child: TextButton(
                      onPressed: () => requireLogin(context, api, reason: '회원 예약을 보려면 로그인하세요'),
                      child: const Text('회원이라면 로그인하고 계정 예약 보기'),
                    ),
                  ),
              ],
            );
          },
        ),
      );
}

class BookingCard extends StatelessWidget {
  const BookingCard(this.api, this.booking, {super.key, this.onChanged});
  final ClubApi api;
  final Json booking;
  final VoidCallback? onChanged;
  @override
  Widget build(BuildContext context) {
    final slot = booking['slot'] as Json, venue = booking['venue'] as Json;
    return Card(
      child: ListTile(
        title: Text('${venue['name']}'),
        subtitle: Text('${slot['date']} ${slot['start']} · ${booking['code']}${booking['isDemo'] == true ? '\n테스트 예약 (실제 예약 아님)' : ''}'),
        isThreeLine: booking['isDemo'] == true,
        trailing: bookingStatusChip(booking['status'] as String),
        onTap: () async {
          await openPage(context, BookingDetailScreen(api, booking));
          onChanged?.call();
        },
      ),
    );
  }
}

class BookingDetailScreen extends StatefulWidget {
  const BookingDetailScreen(this.api, this.initial, {super.key, this.justCreated = false});
  final ClubApi api;
  final Json initial;
  final bool justCreated;
  @override
  State<BookingDetailScreen> createState() => _BookingDetailScreenState();
}

class _BookingDetailScreenState extends State<BookingDetailScreen> {
  late Json booking = widget.initial;
  bool busy = false;

  Future<void> act(Future<Json> Function() call, String done) async {
    setState(() => busy = true);
    final ok = await guarded(context, () async {
      booking = (await call())['booking'] as Json;
    });
    if (mounted) {
      setState(() => busy = false);
      if (ok) notice(context, done);
    }
  }

  Future<void> reload() => act(() => widget.api.request('GET', 'bookings/${booking['code']}', guest: true), '최신 상태를 불러왔습니다.');

  @override
  Widget build(BuildContext context) {
    final b = booking, slot = b['slot'] as Json, venue = b['venue'] as Json;
    final status = b['status'] as String;
    final explanation = switch (status) {
      'confirmed' => venue['isDemo'] == true ? '데모 예약이 확정되었습니다. 실제 구장 예약은 아닙니다.' : '예약이 확정되었습니다.',
      'pending_approval' => '구장 승인 대기 중입니다. 승인 전까지는 확정이 아닙니다.',
      'pending_payment' => '결제 대기 중입니다. 결제 시간 안에 결제하지 않으면 자동으로 만료됩니다.',
      'cancelled' => '취소된 예약입니다.',
      _ => '결제 시간이 지나 만료된 예약입니다.',
    };
    return Scaffold(
      appBar: AppBar(title: const Text('예약 상세'), actions: [IconButton(onPressed: busy ? null : reload, icon: const Icon(Icons.refresh))]),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          if (widget.justCreated)
            Card(
              color: lime.withValues(alpha: 0.12),
              child: const Padding(
                padding: EdgeInsets.all(16),
                child: Text('예약 신청이 저장되었습니다. 앱을 다시 열거나 다른 기기에서도 휴대폰 인증 후 확인할 수 있습니다.'),
              ),
            ),
          Row(children: [Expanded(child: Text('${venue['name']}', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800))), bookingStatusChip(status)]),
          if (b['isDemo'] == true) const Padding(padding: EdgeInsets.only(top: 8), child: DemoBadge(text: '테스트 예약 · 실제 예약 아님')),
          const SizedBox(height: 12),
          Text(explanation),
          const SectionTitle('예약 정보'),
          _row('예약 번호', '${b['code']}'),
          _row('일시', '${slot['date']} ${slot['start']}'),
          _row('예약자', '${b['bookerName']} · ${b['phoneMasked']}'),
          if (b['headcount'] != null) _row('인원', '${b['headcount']}명'),
          if (b['note'] != null) _row('요청 사항', '${b['note']}'),
          _row('요금', won(b['price'] as num)),
          _row('취소 가능', '${_local(b['cancelDeadline'] as String)} 까지'),
          if (status == 'pending_payment' && b['holdExpiresAt'] != null) _row('결제 마감', _local(b['holdExpiresAt'] as String)),
          _row('계정 연결', b['linkedToAccount'] == true ? '회원 계정에 연결됨' : '비회원 예약'),
          const SizedBox(height: 16),
          if (b['canPayDemo'] == true)
            FilledButton.icon(
              onPressed: busy ? null : () => act(() => widget.api.request('POST', 'bookings/${b['code']}/demo-payment', guest: true), '데모 결제가 완료되었습니다.'),
              icon: const Icon(Icons.science_outlined),
              label: const Text('데모 결제하기 (실제 결제 없음)'),
            ),
          if (b['canChange'] == true)
            OutlinedButton.icon(
              onPressed: busy
                  ? null
                  : () async {
                      final changed = await openPage<bool>(context, VenueScreen(widget.api, venue['id'] as int, changeBooking: b));
                      if (changed == true) await reload();
                    },
              icon: const Icon(Icons.edit_calendar),
              label: const Text('시간 변경'),
            ),
          if (b['canCancel'] == true)
            TextButton.icon(
              onPressed: busy
                  ? null
                  : () async {
                      if (!await confirmAction(context, '예약을 취소할까요? 취소 후 이 시간은 다른 사람이 예약할 수 있습니다.', ok: '예약 취소')) return;
                      await act(() => widget.api.request('POST', 'bookings/${b['code']}/cancel', guest: true, body: {}), '예약을 취소했습니다.');
                    },
              icon: const Icon(Icons.cancel_outlined),
              label: const Text('예약 취소'),
            ),
          if (b['canCancel'] != true && ['confirmed', 'pending_approval', 'pending_payment'].contains(status))
            const Text('취소 가능 시간이 지났습니다.', style: TextStyle(color: Colors.white54)),
          const SectionTitle('변경 이력'),
          for (final e in rows(b['events']))
            ListTile(
              dense: true,
              leading: const Icon(Icons.history, size: 18),
              title: Text('${bookingStatusLabels[e['to']] ?? e['to']}${e['detail'] == null ? '' : ' · ${e['detail']}'}'),
              subtitle: Text(_local(e['at'] as String)),
            ),
        ],
      ),
    );
  }

  Widget _row(String k, String v) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SizedBox(width: 90, child: Text(k, style: const TextStyle(color: Colors.white60))),
          Expanded(child: Text(v)),
        ]),
      );
}

String _local(String isoUtc) {
  final t = DateTime.parse(isoUtc).toUtc().add(const Duration(hours: 9));
  String two(int n) => n.toString().padLeft(2, '0');
  return '${t.year}-${two(t.month)}-${two(t.day)} ${two(t.hour)}:${two(t.minute)}';
}

/// Phone ownership check, independent from account sign-up.
class PhoneVerifyScreen extends StatefulWidget {
  const PhoneVerifyScreen(this.api, {super.key, required this.purpose});
  final ClubApi api;
  final String purpose;
  @override
  State<PhoneVerifyScreen> createState() => _PhoneVerifyScreenState();
}

class _PhoneVerifyScreenState extends State<PhoneVerifyScreen> {
  final phone = TextEditingController(), code = TextEditingController();
  String? verificationId, demoCode, error;
  bool busy = false;

  @override
  void dispose() {
    phone.dispose();
    code.dispose();
    super.dispose();
  }

  Future<void> run(Future<void> Function() body) async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await body();
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: Text(widget.purpose)),
        body: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            const Text('휴대폰 번호 확인', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
            const SizedBox(height: 6),
            const Text('앱 회원가입과 별개입니다. 인증한 번호로 예약을 조회·변경·취소할 수 있습니다.', style: TextStyle(color: Colors.white70)),
            const SizedBox(height: 20),
            TextField(
              controller: phone,
              enabled: !busy && verificationId == null,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(labelText: '휴대폰 번호', hintText: '010-1234-5678'),
            ),
            const SizedBox(height: 12),
            if (verificationId == null)
              FilledButton(
                onPressed: busy
                    ? null
                    : () => run(() async {
                          final r = await widget.api.startPhoneVerification(phone.text);
                          setState(() {
                            verificationId = r['verificationId'] as String;
                            demoCode = r['demoCode'] as String?;
                          });
                        }),
                child: const Text('인증번호 받기'),
              )
            else ...[
              if (demoCode != null)
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: Colors.orange.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(12)),
                  child: Text('개발·테스트 서버: 실제 문자는 발송되지 않았습니다.\n데모 인증번호 $demoCode',
                      style: const TextStyle(color: Colors.orangeAccent)),
                ),
              const SizedBox(height: 12),
              TextField(
                controller: code,
                enabled: !busy,
                keyboardType: TextInputType.number,
                maxLength: 6,
                decoration: const InputDecoration(labelText: '인증번호 6자리'),
              ),
              FilledButton(
                onPressed: busy
                    ? null
                    : () => run(() async {
                          await widget.api.confirmPhoneVerification(verificationId!, phone.text, code.text.trim());
                          if (context.mounted) Navigator.pop(context, true);
                        }),
                child: const Text('확인'),
              ),
              TextButton(onPressed: busy ? null : () => setState(() => verificationId = null), child: const Text('번호 다시 입력')),
            ],
            if (error != null)
              Padding(padding: const EdgeInsets.only(top: 12), child: Text(error!, style: TextStyle(color: Theme.of(context).colorScheme.error))),
          ],
        ),
      );
}
