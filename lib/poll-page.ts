import { redirect } from "next/navigation";
import { getSignedInAdmin, getTeamRole } from "./auth";
import { getCurrentTeam, isLegacyMode } from "./teams";
import { pollAccess } from "./poll-access";

export async function pollPageContext(suffix = "") {
  const legacy = isLegacyMode();
  const team = await getCurrentTeam();
  const account = await getSignedInAdmin();
  const base = legacy ? "/polls" : `/t/${team.slug}/polls`;
  if (!account && !legacy) redirect(`/login?next=${encodeURIComponent(base + suffix)}`);
  const role = account ? await getTeamRole(account.id, team.id) : null;
  // Legacy management pages require an administrator; individual shared links
  // remain available for members to vote by name without signing in.
  if (legacy && (suffix === "" || suffix === "/new") && role !== "PRESIDENT") redirect(`/abcd/login?next=${encodeURIComponent(base + suffix)}`);
  return { team, account, base, legacy, access: pollAccess(), role };
}
