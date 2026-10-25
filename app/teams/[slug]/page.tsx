import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSignedInAdmin } from "@/lib/auth";
import { requirePlatformMode } from "@/lib/teams";
import { ClubProfile } from "@/components/ClubProfile";
import { clubMembership } from "@/lib/team-roles";

export default async function ClubPage({ params }: { params: { slug: string } }) {
  requirePlatformMode();
  const admin = await getSignedInAdmin();
  const team = await prisma.team.findUnique({ where: { slug: params.slug }, include: { _count: { select: { players: { where: { isActive: true } }, matches: true } }, admins: { where: { adminId: admin?.id ?? -1 }, select: { role: true } } } });
  if (!team) notFound();
  return <ClubProfile club={{ ...team, playerCount: team._count.players, matchCount: team._count.matches, ...clubMembership(team.admins[0]?.role), example: false }} />;
}
