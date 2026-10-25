"use client";

import { createContext, useContext } from "react";
import { teamPath } from "@/lib/team-paths";

export type TeamContextValue = { basePath: string; name: string; slug: string; color: string; platform: boolean };
const TeamContext = createContext<TeamContextValue>({ basePath: "", name: "ARENA FC", slug: "arena-fc", color: "#e53935", platform: false });

export function TeamProvider({ value, children }: { value: TeamContextValue; children: React.ReactNode }) {
  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}

export const useTeam = () => useContext(TeamContext);
export function useTeamPath() {
  const { basePath } = useTeam();
  return (path: string) => teamPath(basePath, path);
}
