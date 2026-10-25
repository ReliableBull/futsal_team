import { teamRoleLabels, type TeamRole } from "@/lib/team-roles";

export function TeamRoleBadge({ role }: { role: TeamRole | null }) {
  if (!role) return null;
  return <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${role === "PRESIDENT" ? "bg-emerald-100 text-emerald-900" : "bg-blue-50 text-blue-800"}`}>
    <span className="font-medium">내 역할</span>
    <span>{teamRoleLabels[role]}</span>
  </span>;
}
