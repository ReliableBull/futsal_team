import type { ClubPollView } from "@/lib/club-polls";

export function PollTurnout({ turnout }: { turnout: NonNullable<ClubPollView["turnout"]> }) {
  const { votedCount, activeMemberCount, percentage } = turnout;
  const rate = percentage === null ? "—" : `${percentage.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%`;
  return <section aria-label="투표 참여 현황" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:p-6">
    <h2 className="text-lg font-black text-emerald-950">투표 참여 현황</h2>
    <dl className="mt-5 grid grid-cols-3 gap-3 text-center">
      <div><dt className="text-xs font-bold text-emerald-900">투표 완료</dt><dd className="mt-2 text-xl font-black text-emerald-950 sm:text-2xl">{votedCount.toLocaleString("ko-KR")}<span className="ml-1 text-xs font-medium">명</span></dd></div>
      <div><dt className="text-xs font-bold text-emerald-900">활성 회원</dt><dd className="mt-2 text-xl font-black text-emerald-950 sm:text-2xl">{activeMemberCount.toLocaleString("ko-KR")}<span className="ml-1 text-xs font-medium">명</span></dd></div>
      <div><dt className="text-xs font-bold text-emerald-900">투표율</dt><dd className="mt-2 text-xl font-black text-emerald-950 sm:text-2xl">{rate}</dd></div>
    </dl>
    {percentage !== null && <div role="progressbar" aria-label="활성 회원 기준 투표율" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(percentage, 100)} aria-valuetext={rate} className="mt-5 h-2.5 overflow-hidden rounded-full bg-emerald-100"><div className="h-full rounded-full bg-emerald-700" style={{ width: `${Math.min(percentage, 100)}%` }} /></div>}
    {!activeMemberCount && <p className="mt-4 text-xs leading-6 text-emerald-900">활성 회원이 등록되면 투표율을 계산합니다.</p>}
  </section>;
}
