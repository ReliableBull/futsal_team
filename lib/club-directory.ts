import { prisma } from "./prisma";
import { clubMembership } from "./team-roles";
import { exampleClubs, isSport, matchesSport, type ClubSummary } from "./community";

export async function findClubs({ search = "", sport = "", region = "", recruiting = false, mine = false, adminId = -1 }: { search?: string; sport?: string; region?: string; recruiting?: boolean; mine?: boolean; adminId?: number } = {}): Promise<ClubSummary[]> {
  const query = search.trim().slice(0, 60);
  const area = region.trim().slice(0, 60);
  const teams = await prisma.team.findMany({
    where: {
      ...(query ? { OR: [{ name: { contains: query, mode: "insensitive" as const } }, { region: { contains: query, mode: "insensitive" as const } }] } : {}),
      ...(area ? { region: { contains: area } } : {}),
      ...(isSport(sport) ? { sport: { in: [sport, "BOTH"] } } : {}),
      ...(recruiting ? { recruiting: true } : {}),
      ...(mine ? { admins: { some: { adminId } } } : {})
    },
    include: { _count: { select: { players: { where: { isActive: true } }, matches: true } }, admins: { where: { adminId }, select: { role: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100
  });
  const real: ClubSummary[] = teams.map(team => ({ ...team, playerCount: team._count.players, matchCount: team._count.matches, ...clubMembership(team.admins[0]?.role), example: false }));
  const examples = mine ? [] : exampleClubs.filter(club => (!query || `${club.name} ${club.region}`.toLowerCase().includes(query.toLowerCase())) && (!area || club.region.includes(area)) && matchesSport(club.sport, sport) && (!recruiting || club.recruiting));
  return [...real, ...examples];
}
