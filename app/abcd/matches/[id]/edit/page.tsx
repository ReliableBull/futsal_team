import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminMatchForm, type MatchFormInitialData } from "@/components/AdminMatchForm";
import { DeletePosterButton } from "@/components/DeletePosterButton";
import { deleteMatchPoster, updateMatch, uploadMatchPoster } from "@/lib/actions";
import { requireAdmin } from "@/lib/auth";
import { matchInclude } from "@/lib/matches";
import { prisma } from "@/lib/prisma";

function toInputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function EditMatchPage({ params }: { params: { id: string } }) {
  await requireAdmin();

  const matchId = Number(params.id);
  if (!Number.isInteger(matchId)) notFound();

  const [players, match] = await Promise.all([
    prisma.player.findMany({ orderBy: [{ isActive: "desc" }, { number: "asc" }, { name: "asc" }] }),
    prisma.match.findUnique({
      where: { id: matchId },
      include: matchInclude
    })
  ]);

  if (!match) notFound();

  const teamARecords = match.matchPlayers.filter((record) => record.teamName === match.teamAName);
  const teamBRecords = match.matchPlayers.filter((record) => record.teamName === match.teamBName);
  const initialData: MatchFormInitialData = {
    matchDate: toInputDate(match.matchDate),
    status: match.status === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS",
    location: match.location,
    teamAName: match.teamAName,
    teamBName: match.teamBName,
    teamAScore: match.teamAScore,
    teamBScore: match.teamBScore,
    teamAPlayerIds: teamARecords.map((record) => record.playerId),
    teamBPlayerIds: teamBRecords.map((record) => record.playerId),
    goalsByPlayerId: Object.fromEntries(match.matchPlayers.map((record) => [record.playerId, record.goals])),
    assistsByPlayerId: Object.fromEntries(match.matchPlayers.map((record) => [record.playerId, record.assists])),
    chairmanTeamMvpIds: teamARecords.filter((record) => record.isMvp).map((record) => record.playerId),
    managerTeamMvpIds: teamBRecords.filter((record) => record.isMvp).map((record) => record.playerId),
    memo: match.memo ?? ""
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-arena-lime">Edit Match</p>
          <h1 className="text-3xl font-black text-white">경기 수정</h1>
        </div>
        <Link className="rounded-md border border-arena-line px-4 py-2 text-sm font-bold text-slate-200 transition hover:border-arena-cyan hover:text-white" href="/abcd">
          관리자 페이지로
        </Link>
      </div>

      <AdminMatchForm
        action={updateMatch.bind(null, match.id)}
        initialData={initialData}
        players={players}
        submitLabel="수정 완료"
      />

      <section className="rounded-lg border border-arena-line bg-arena-panel p-5">
        <h2 className="text-xl font-bold text-white">경기 포스터</h2>
        <p className="mt-2 text-sm text-slate-400">경기별 홍보 이미지를 여러 장 업로드할 수 있습니다.</p>

        <form action={uploadMatchPoster.bind(null, match.id)} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            className="w-full rounded-md border border-arena-line bg-black/30 px-3 py-2 text-sm text-slate-200 file:mr-3 file:rounded file:border-0 file:bg-arena-cyan file:px-3 file:py-1.5 file:font-bold file:text-arena-black"
            accept="image/*"
            name="posterImage"
            type="file"
            required
          />
          <button className="rounded-md bg-arena-lime px-4 py-2 text-sm font-black text-arena-black transition hover:bg-white" type="submit">
            포스터 업로드
          </button>
        </form>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {match.posters.length > 0 ? (
            match.posters.map((poster) => (
              <div key={poster.id} className="overflow-hidden rounded-md border border-arena-line bg-black/20">
                <Image
                  alt="경기 포스터"
                  className="h-56 w-full object-cover"
                  height={640}
                  src={poster.imageUrl}
                  unoptimized
                  width={960}
                />
                <div className="p-3">
                  <DeletePosterButton action={deleteMatchPoster.bind(null, match.id, poster.id)} />
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-400">등록된 포스터가 없습니다.</p>
          )}
        </div>
      </section>
    </div>
  );
}
