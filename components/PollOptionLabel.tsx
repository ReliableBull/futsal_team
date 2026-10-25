import { PlayerAvatar } from "./PlayerAvatar";

export type PollOptionDisplay = { label: string; detail?: string; playerId?: number | null; profileImageUrl?: string | null };

export function PollOptionLabel({ option, compact = false }: { option: PollOptionDisplay; compact?: boolean }) {
  return <span className="flex min-w-0 items-center gap-3">
    {option.playerId && <PlayerAvatar playerId={option.playerId} name={option.label} profileImageUrl={option.profileImageUrl} size={compact ? "sm" : "md"} />}
    <span className="min-w-0"><span className="block break-words text-sm font-bold">{option.label}</span>{option.detail && <span className="mt-0.5 block break-words break-keep text-xs font-normal leading-5 text-slate-500">{option.detail}</span>}</span>
  </span>;
}
