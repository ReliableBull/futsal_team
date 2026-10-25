import Link from "@/components/TeamLink";
import type { ChemistryPlayer, ChemistryRecord, PlayerChemistry } from "@/lib/player-chemistry";

function PlayerName({ player }: { player: ChemistryPlayer }) {
  return player.isActive
    ? <Link href={`/players/${player.id}`} className="font-bold text-slate-900 hover:text-arena-red hover:underline">{player.name}</Link>
    : <span className="font-bold text-slate-600">{player.name} <span className="text-xs font-normal">(비활성)</span></span>;
}

function RecordRow({ record }: { record: ChemistryRecord }) {
  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 break-words"><PlayerName player={record.player} /></div>
        <span className="shrink-0 text-xl font-black tabular-nums text-arena-red">{record.winRate.toFixed(1)}<span className="ml-0.5 text-xs">%</span></span>
      </div>
      <div className="mt-2 flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-slate-500">
        <span><strong className="text-slate-700">{record.matches}경기</strong> · {record.wins}승 {record.draws}무 {record.losses}패</span>
        <span>팀 득실 {record.goalsFor} : {record.goalsAgainst}</span>
      </div>
      <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        <span className="bg-arena-red" style={{ width: `${record.wins / record.matches * 100}%` }} />
        <span className="bg-slate-300" style={{ width: `${record.draws / record.matches * 100}%` }} />
        <span className="bg-slate-100" style={{ width: `${record.losses / record.matches * 100}%` }} />
      </div>
    </li>
  );
}

function RecordList({ title, description, records, minimum, total }: {
  title: string; description: string; records: ChemistryRecord[]; minimum: number; total: number;
}) {
  return (
    <section className="min-w-0 rounded-xl border border-arena-line bg-white p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-black text-slate-900">{title}</h2>
        <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{records.length}명</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
      {records.length === 0 ? (
        <p className="mt-5 rounded-lg bg-slate-50 p-5 text-sm leading-6 text-slate-500">
          {total > 0 ? `최소 ${minimum}경기를 충족하는 선수가 없습니다. 최소 경기 수를 낮춰보세요.` : "선택한 기간에 함께 출전한 기록이 없습니다."}
        </p>
      ) : (
        <>
          <ol className="mt-5 divide-y divide-slate-100">
            {records.slice(0, 5).map((record) => <RecordRow key={record.player.id} record={record} />)}
          </ol>
          {records.length > 5 && (
            <details className="mt-4 border-t border-slate-100 pt-4">
              <summary className="cursor-pointer text-sm font-bold text-arena-cyan">나머지 {records.length - 5}명 전적 보기</summary>
              <ol start={6} className="mt-5 divide-y divide-slate-100">
                {records.slice(5).map((record) => <RecordRow key={record.player.id} record={record} />)}
              </ol>
            </details>
          )}
        </>
      )}
    </section>
  );
}

export function ChemistryResults({ player, data, minimum }: { player: ChemistryPlayer; data: PlayerChemistry; minimum: number }) {
  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-arena-line bg-white p-5 sm:p-6">
        <p className="text-xs font-black tracking-widest text-arena-red">PLAYER CONNECTIONS</p>
        <h2 className="mt-2 break-words text-2xl font-black text-slate-900">{player.name}의 조합 분석</h2>
        <p className="mt-2 text-sm text-slate-500">
          {data.firstDate ? `${data.firstDate} ~ ${data.lastDate} · 완료된 출전 경기 기준` : "선택한 기간에 완료된 출전 경기가 없습니다."}
        </p>
        <dl className="mt-5 grid grid-cols-3 divide-x divide-slate-200 rounded-lg bg-slate-50 py-4 text-center">
          {[["출전 경기", data.totalMatches], ["함께 뛴 동료", data.teammateCount], ["맞대결 선수", data.opponentCount]].map(([label, value]) => (
            <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 text-2xl font-black tabular-nums text-slate-900">{value}</dd></div>
          ))}
        </dl>
      </section>

      <p className="text-sm leading-6 text-slate-500">
        승률과 승·무·패는 모두 <strong className="text-slate-700">{player.name} 기준</strong>입니다. 무승부도 경기 수에 포함하며, 승률 → 경기 수 순으로 정렬합니다.
        최소 {minimum}경기 조건은 아래 동료·상대 전적에 적용됩니다. 함께 뛴 횟수와 상대 구성이 다르므로 개인 실력 순위로 해석하지 마세요.
      </p>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <RecordList title="함께 뛰었을 때" description="같은 팀으로 출전한 동료와의 승률입니다." records={data.teammates} minimum={minimum} total={data.teammateCount} />
        <RecordList title="상대로 만났을 때" description="다른 팀으로 출전한 선수와의 맞대결 전적입니다." records={data.opponents} minimum={minimum} total={data.opponentCount} />
      </div>

      <section className="rounded-xl border border-arena-line bg-white p-4 sm:p-6">
        <h2 className="text-xl font-black text-slate-900">득점·도움 파트너</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">선택한 기간의 확인된 골 연결을 모두 집계합니다. 받은 도움은 내 득점, 준 도움은 동료의 득점으로 이어진 횟수입니다.</p>
        {data.connections.length > 0 ? (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full table-fixed text-left text-sm">
              <caption className="sr-only">{player.name}의 득점·도움 연결</caption>
              <thead className="border-b border-arena-line text-xs text-slate-500">
                <tr><th scope="col" className="pb-3">선수</th><th scope="col" className="w-16 pb-3 text-right sm:w-24">받은 도움</th><th scope="col" className="w-16 pb-3 text-right sm:w-24">준 도움</th><th scope="col" className="w-12 pb-3 text-right sm:w-24">합계</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.connections.map((connection) => (
                  <tr key={connection.player.id}>
                    <th scope="row" className="break-words py-4 pr-3"><PlayerName player={connection.player} /></th>
                    <td className="py-4 text-right tabular-nums">{connection.received}</td>
                    <td className="py-4 text-right tabular-nums">{connection.supplied}</td>
                    <td className="py-4 text-right font-black tabular-nums text-arena-red">{connection.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="mt-5 rounded-lg bg-slate-50 p-5 text-sm text-slate-500">확인된 득점·도움 연결이 없습니다.</p>}
        {(data.unknownGoalLinks > 0 || data.unknownAssistLinks > 0) && (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            연결 정보 미상: 내 득점 {data.unknownGoalLinks}골 · 내 도움 {data.unknownAssistLinks}개. 해당 기록은 파트너 집계에서 제외했습니다. 도움 없이 넣은 것으로 확인된 골은 미상에 포함하지 않습니다.
          </p>
        )}
      </section>
    </div>
  );
}
