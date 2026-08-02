import { getMatchStatusLabel, matchStatus } from "@/lib/stats";

export function MatchStatusBadge({ status }: { status: string }) {
  const isInProgress = status === matchStatus.inProgress;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-black ${
        isInProgress ? "border-arena-red/60 bg-arena-red/10 text-arena-red" : "border-arena-green/60 bg-arena-green/10 text-arena-green"
      }`}
    >
      {getMatchStatusLabel(status)}
    </span>
  );
}
