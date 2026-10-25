import { TeamDirectory } from "@/components/TeamDirectory";
import { requirePlatformMode } from "@/lib/teams";
export default function TeamsPage({ searchParams }: { searchParams: { q?: string; mine?: string; sport?: string; region?: string; recruiting?: string } }) {
  requirePlatformMode();
  return <TeamDirectory search={typeof searchParams.q === "string" ? searchParams.q : ""} mine={searchParams.mine === "1"} sport={typeof searchParams.sport === "string" ? searchParams.sport : ""} region={typeof searchParams.region === "string" ? searchParams.region : ""} recruiting={searchParams.recruiting === "1"} />;
}
