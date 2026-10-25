import Link from "@/components/TeamLink";
import { getMomResults } from "@/lib/mom-votes";

export async function MomVoteResults({ matchId }: { matchId: number }) {
  const results = await getMomResults(matchId);
  return (
    <section aria-label="MOM 투표 집계" className="rounded-xl border border-arena-line bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-black text-slate-900">MOM 투표 결과</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">총 {results.totalBallots}회 참여</span></div>
      <p className="mt-2 text-sm leading-6 text-slate-600">아래 득표수를 참고해 경기 수정 폼에서 최종 MOM을 선택하고 저장하세요. 동률일 때는 운영자가 결정하며, 여러 명을 선정할 수도 있습니다.</p>
      <Link href={`/abcd/matches/${matchId}/edit`} className="mt-3 inline-block text-sm font-bold text-arena-cyan underline">집계 새로고침</Link>
      <div className="mt-4 grid gap-5 sm:grid-cols-2">{results.teams.map((team) => <div key={team.key}>
        <h3 className="font-black text-slate-900">{team.name}</h3>
        <ol className="mt-2 divide-y divide-slate-100">{team.players.map((player) => <li key={player.id} className="flex items-center justify-between gap-3 py-2 text-sm text-slate-700"><span>{player.name}{player.votes > 0 && player.votes === team.players[0]?.votes && <span className="ml-2 text-xs font-bold text-arena-red">최다 득표</span>}</span><strong>{player.votes}표</strong></li>)}</ol>
        {team.excludedVotes > 0 && <p className="mt-2 text-xs leading-5 text-slate-500">출전 명단이 변경되어 현재 이 팀에 없는 선수의 {team.excludedVotes}표는 집계에서 제외했습니다.</p>}
      </div>)}</div>
      {!results.totalBallots && <p className="mt-3 text-sm text-slate-500">아직 접수된 투표가 없습니다.</p>}
    </section>
  );
}
