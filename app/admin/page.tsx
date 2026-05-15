import Link from "next/link";
import { AdminMatchForm } from "@/components/AdminMatchForm";
import { DeleteMatchButton } from "@/components/DeleteMatchButton";
import { createMatch, createPlayer, deleteMatch, logoutAdmin } from "@/lib/actions";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/stats";

export default async function AdminPage() {
  const admin = await requireAdmin();
  const [players, matches] = await Promise.all([
    prisma.player.findMany({ orderBy: [{ isActive: "desc" }, { number: "asc" }, { name: "asc" }] }),
    prisma.match.findMany({
      include: { chairmanTeamMvp: true, managerTeamMvp: true },
      orderBy: { matchDate: "desc" },
      take: 10
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
          <form action={logoutAdmin}>
            <button className="rounded-md border border-arena-line px-4 py-2 text-sm font-bold text-slate-200 transition hover:border-arena-cyan hover:text-white" type="submit">
              로그아웃
            </button>
          </form>
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
            <input className="w-full rounded-md border border-arena-line bg-black/30 px-3 py-2" name="position" placeholder="FW / MF / DF / GK" required />
          </label>
          <label className="block space-y-2 text-sm font-semibold text-slate-200">
            등번호
            <input className="w-full rounded-md border border-arena-line bg-black/30 px-3 py-2" name="number" type="number" min="0" />
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <input name="isActive" type="checkbox" defaultChecked />
            활성 선수
          </label>
          <button className="w-full rounded-md bg-arena-lime px-4 py-3 font-black text-arena-black transition hover:bg-white" type="submit">
            선수 등록
          </button>
        </form>

        <section className="rounded-lg border border-arena-line bg-arena-panel p-5">
          <h2 className="text-xl font-bold text-white">등록된 선수</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {players.map((player) => (
              <Link key={player.id} href={`/players/${player.id}`} className="rounded-md border border-arena-line bg-black/20 px-3 py-2 text-sm hover:border-arena-cyan">
                <span className="font-bold text-white">{player.name}</span>
                <span className="ml-2 text-slate-400">
                  {player.position} · #{player.number ?? "-"}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold text-white">경기 등록</h2>
        <AdminMatchForm action={createMatch} players={players.filter((player) => player.isActive)} />
      </section>

      <section className="rounded-lg border border-arena-line bg-arena-panel p-5">
        <h2 className="text-xl font-bold text-white">등록된 경기</h2>
        <div className="mt-4 grid gap-3">
          {matches.map((match) => (
            <div key={match.id} className="rounded-md border border-arena-line bg-black/20 p-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <Link href={`/matches/${match.id}`} className="min-w-0 hover:text-arena-cyan">
                  <p className="text-sm text-slate-400">{formatDate(match.matchDate)}</p>
                  <p className="mt-1 font-bold text-white">
                    {match.teamAName} {match.teamAScore} : {match.teamBScore} {match.teamBName}
                  </p>
                  <p className="text-sm text-slate-400">
                    회장팀 MVP: {match.chairmanTeamMvp?.name ?? "-"} · 총무팀 MVP: {match.managerTeamMvp?.name ?? "-"}
                  </p>
                </Link>
                <div className="flex gap-2">
                  <Link className="rounded-md border border-arena-line px-3 py-2 text-sm font-bold text-slate-200 transition hover:border-arena-cyan hover:text-white" href={`/admin/matches/${match.id}/edit`}>
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
