import Link from "next/link";
import { AdminMatchForm } from "@/components/AdminMatchForm";
import { AdminPlayerEditor } from "@/components/AdminPlayerEditor";
import { DeleteMatchButton } from "@/components/DeleteMatchButton";
import { MatchStatusBadge } from "@/components/MatchStatusBadge";
import { createMatch, createPlayer, deleteMatch, deletePlayer, logoutAdmin, updatePlayer } from "@/lib/actions";
import { requireAdmin } from "@/lib/auth";
import { defaultPlayerPosition, playerPositions } from "@/lib/player-position";
import { prisma } from "@/lib/prisma";
import { formatDate, getTeamMvpNames, matchStatus } from "@/lib/stats";

function toInputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function AdminPage() {
  const admin = await requireAdmin();
  const [players, matches] = await Promise.all([
    prisma.player.findMany({
      include: { _count: { select: { matchPlayers: true } } },
      orderBy: [{ isActive: "desc" }, { number: "asc" }, { name: "asc" }]
    }),
    prisma.match.findMany({
      include: { matchPlayers: { include: { player: true } } },
      orderBy: { matchDate: "desc" }
    })
  ]);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-bold uppercase text-arena-lime">Admin</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-black text-white">관리자 페이지</h1>
            <p className="mt-2 text-sm text-slate-400">{admin.username} 계정으로 로그인됨</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a className="rounded-md bg-arena-lime px-4 py-2 text-sm font-black text-arena-black transition hover:bg-white" href="/api/export/matches">
              엑셀 다운로드
            </a>
            <a className="rounded-md border border-arena-cyan px-4 py-2 text-sm font-bold text-arena-cyan transition hover:bg-arena-cyan hover:text-arena-black" href="/api/export/analysis-text">
              분석 텍스트 다운로드
            </a>
            <form action={logoutAdmin}>
              <button className="rounded-md border border-arena-line px-4 py-2 text-sm font-bold text-slate-200 transition hover:border-arena-cyan hover:text-white" type="submit">
                로그아웃
              </button>
            </form>
          </div>
        </div>
      </div>

      <section className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <form action={createPlayer} className="space-y-4 rounded-lg border border-arena-line bg-arena-panel p-5">
          <h2 className="text-xl font-bold text-white">선수 등록</h2>
          <label className="block space-y-2 text-sm font-semibold text-slate-200">
            이름
            <input className="w-full rounded-md border border-arena-line bg-black/30 px-3 py-2" name="name" required />
          </label>
          <label className="block space-y-2 text-sm font-semibold text-slate-200">
            닉네임
            <input className="w-full rounded-md border border-arena-line bg-black/30 px-3 py-2" name="nickname" />
          </label>
          <label className="block space-y-2 text-sm font-semibold text-slate-200">
            포지션
            <select className="w-full rounded-md border border-arena-line bg-black/30 px-3 py-2" name="position" defaultValue={defaultPlayerPosition}>
              {playerPositions.map((position) => (
                <option key={position} value={position}>
                  {position}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-2 text-sm font-semibold text-slate-200">
            프로필 이미지 경로
            <input className="w-full rounded-md border border-arena-line bg-black/30 px-3 py-2" name="profileImageUrl" placeholder="/images/players/kim-minseok.jpg" />
          </label>
          <label className="block space-y-2 text-sm font-semibold text-slate-200">
            등번호
            <input className="w-full rounded-md border border-arena-line bg-black/30 px-3 py-2" name="number" type="number" min="0" />
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <input name="isActive" type="checkbox" defaultChecked />
            선수 목록 포함
          </label>
          <button className="w-full rounded-md bg-arena-lime px-4 py-3 font-black text-arena-black transition hover:bg-white" type="submit">
            선수 등록
          </button>
        </form>

        <section className="rounded-lg border border-arena-line bg-arena-panel p-5">
          <h2 className="text-xl font-bold text-white">등록된 선수</h2>
          <div className="mt-4 grid gap-3">
            {players.map((player) => (
              <AdminPlayerEditor
                key={player.id}
                player={player}
                action={updatePlayer.bind(null, player.id)}
                deleteAction={deletePlayer.bind(null, player.id)}
                matchCount={player._count.matchPlayers}
              />
            ))}
          </div>
        </section>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold text-white">경기 등록</h2>
        <AdminMatchForm
          action={createMatch}
          players={players.filter((player) => player.isActive)}
          initialData={{
            matchDate: toInputDate(new Date()),
            status: matchStatus.inProgress,
            location: "",
            teamAName: "회장팀",
            teamBName: "총무팀",
            teamAScore: 0,
            teamBScore: 0,
            teamAPlayerIds: [],
            teamBPlayerIds: [],
            goalsByPlayerId: {},
            assistsByPlayerId: {},
            goalAssistPlayerIdsByScorerId: {},
            chairmanTeamMvpIds: [],
            managerTeamMvpIds: [],
            memo: ""
          }}
        />
      </section>

      <section className="rounded-lg border border-arena-line bg-arena-panel p-5">
        <h2 className="text-xl font-bold text-white">등록된 경기</h2>
        <div className="mt-4 grid gap-3">
          {matches.map((match) => (
            <div key={match.id} className="rounded-md border border-arena-line bg-black/20 p-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <Link href={`/matches/${match.id}`} className="min-w-0 hover:text-arena-cyan">
                  <p className="text-sm text-slate-400">{formatDate(match.matchDate)}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <p className="font-bold text-white">
                      {match.teamAName} {match.teamAScore} : {match.teamBScore} {match.teamBName}
                    </p>
                    <MatchStatusBadge status={match.status} />
                  </div>
                  <p className="text-sm text-slate-400">
                    {match.teamAName} MVP: {getTeamMvpNames(match.matchPlayers, match.teamAName)} · {match.teamBName} MVP:{" "}
                    {getTeamMvpNames(match.matchPlayers, match.teamBName)}
                  </p>
                </Link>
                <div className="flex gap-2">
                  <Link className="rounded-md border border-arena-line px-3 py-2 text-sm font-bold text-slate-200 transition hover:border-arena-cyan hover:text-white" href={`/abcd/matches/${match.id}/edit`}>
                    수정
                  </Link>
                  <DeleteMatchButton action={deleteMatch.bind(null, match.id)} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
