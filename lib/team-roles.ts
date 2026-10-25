export const teamRoleLabels = {
  PRESIDENT: "회장 (운영자)",
  MEMBER: "일반 회원"
} as const;

export type TeamRole = keyof typeof teamRoleLabels;

export function clubMembership(value?: string | null): { role: TeamRole | null; managed: boolean } {
  const role = value === "PRESIDENT" || value === "MEMBER" ? value : null;
  return { role, managed: role === "PRESIDENT" };
}
