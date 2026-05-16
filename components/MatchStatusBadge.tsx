import { getMatchStatusLabel, matchStatus } from "@/lib/stats";

export function MatchStatusBadge({ status }: { status: string }) {
  const isInProgress = status === matchStatus.inProgress;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-black ${
        isInProgress ? "border-arena-cyan/50 bg-arena-cyan/15 text-arena-cyan" : "border-arena-lime/50 bg-arena-lime/15 text-arena-lime"
      }`}
    >
      {getMatchStatusLabel(status)}
    </span>
  );
}
