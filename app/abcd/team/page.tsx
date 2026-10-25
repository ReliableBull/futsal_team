import { TeamForm } from "@/components/TeamForm";
import { updateTeam } from "@/lib/team-actions";
import { requireAdmin } from "@/lib/auth";
import { getCurrentTeam, requirePlatformMode } from "@/lib/teams";
export default async function TeamSettingsPage() {
  requirePlatformMode();
  await requireAdmin();
  const team = await getCurrentTeam();
  return <section className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 sm:p-8"><h1 className="mb-8 text-3xl font-black">팀 정보 관리</h1><TeamForm action={updateTeam} signedIn initial={team} /></section>;
}
