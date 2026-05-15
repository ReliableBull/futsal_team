import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminMatchForm, type MatchFormInitialData } from "@/components/AdminMatchForm";
import { updateMatch } from "@/lib/actions";
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
    location: match.location,
    teamAName: match.teamAName,
    teamBName: match.teamBName,
    teamAScore: match.teamAScore,
    teamBScore: match.teamBScore,
    teamAPlayerIds: teamARecords.map((record) => record.playerId),
    teamBPlayerIds: teamBRecords.map((record) => record.playerId),
    goalsByPlayerId: Object.fromEntries(match.matchPlayers.map((record) => [record.playerId, record.goals])),
    assistsByPlayerId: Object.fromEntries(match.matchPlayers.map((record) => [record.playerId, record.assists])),
    chairmanTeamMvpId: match.chairmanTeamMvpId,
    managerTeamMvpId: match.managerTeamMvpId,
    memo: match.memo ?? ""
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-arena-lime">Edit Match</p>
          <h1 className="text-3xl font-black text-white">경기 수정</h1>
        </div>
        <Link className="rounded-md border border-arena-line px-4 py-2 text-sm font-bold text-slate-200 transition hover:border-arena-cyan hover:text-white" href="/admin">
          관리자 페이지로
        </Link>
      </div>

      <AdminMatchForm
        action={updateMatch.bind(null, match.id)}
        initialData={initialData}
        players={players}
        submitLabel="수정 완료"
      />
    </div>
  );
}
