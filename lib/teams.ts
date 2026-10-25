import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { scopeTeamDb } from "@/lib/team-db";
import { legacyTeamSlug, teamPath, teamSlugPattern } from "@/lib/team-paths";

export function isLegacyMode() {
  return process.env.APP_MODE === "legacy";
}

export function getTeamBasePath() {
  const slug = headers().get("x-futsal-team");
  return !isLegacyMode() && slug ? `/t/${slug}` : "";
}

export function currentTeamPath(path: string) {
  return teamPath(getTeamBasePath(), path);
}

export function requirePlatformMode() {
  if (isLegacyMode()) notFound();
}

export async function getTeamBySlug(slug: string) {
  if (!teamSlugPattern.test(slug) || slug.length > 48) notFound();
  if (isLegacyMode() && slug !== legacyTeamSlug) notFound();
  const team = await prisma.team.findUnique({ where: { slug } });
  if (!team) notFound();
  return team;
}

export async function getCurrentTeam() {
  const slug = headers().get("x-futsal-team");
  // The middleware rewrites only routes. This runtime check also makes legacy
  // mode independent of the environment used to compile the middleware.
  if (isLegacyMode() && slug) notFound();
  return getTeamBySlug(slug || legacyTeamSlug);
}

export async function getTeamPrisma() {
  return scopeTeamDb(prisma, (await getCurrentTeam()).id);
}

export async function getPagesTeam(slug: string | string[] | undefined) {
  if (isLegacyMode() && slug) return null;
  if (typeof slug !== "undefined" && (typeof slug !== "string" || !teamSlugPattern.test(slug) || slug.length > 48)) return null;
  return prisma.team.findUnique({ where: { slug: typeof slug === "string" ? slug : legacyTeamSlug } });
}

export function redirectToTeam(path: string): never {
  redirect(currentTeamPath(path));
}
