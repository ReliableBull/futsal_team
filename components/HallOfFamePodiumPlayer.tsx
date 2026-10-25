import Link from "@/components/TeamLink";
import { MedalBadge, getMedalTone } from "@/components/HallOfFameMedalBadge";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import type { HallOfFameSlot } from "@/lib/hall-of-fame";

/** 포디움 자리별 시각 비중: champion(중앙, 가장 큼) > second(왼쪽) > third(오른쪽) */
export type PodiumVariant = "champion" | "second" | "third";

type HallOfFamePodiumPlayerProps = {
  slot: HallOfFameSlot;
  variant: PodiumVariant;
};

const podiumStyle: Record<PodiumVariant, { ringWidth: number; nameClass: string; valueClass: string }> = {
  champion: { ringWidth: 3, nameClass: "text-lg sm:text-2xl", valueClass: "text-2xl sm:text-3xl" },
  second: { ringWidth: 2, nameClass: "text-sm sm:text-base", valueClass: "text-lg sm:text-xl" },
  third: { ringWidth: 2, nameClass: "text-sm sm:text-[15px]", valueClass: "text-base sm:text-lg" }
};

function getAvatarSize(variant: PodiumVariant, isTied: boolean) {
  if (variant === "champion") return isTied ? "xl" : "2xl";

  return isTied ? "md" : "xl";
}

export function HallOfFamePodiumPlayer({ slot, variant }: HallOfFamePodiumPlayerProps) {
  const tone = getMedalTone(slot.rank);
  const style = podiumStyle[variant];
  const isChampion = variant === "champion";
  const isTied = slot.players.length > 1 || slot.overflowCount > 0;

  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative">
        {isChampion ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -inset-7 -z-10"
            style={{ background: `radial-gradient(circle at 50% 38%, ${tone.accent}24, transparent 70%)` }}
          />
        ) : null}

        <div className={`flex items-end justify-center ${slot.players.length > 1 ? "-space-x-3 sm:-space-x-4" : ""}`}>
          {slot.players.map((player) => (
            <Link
              key={player.playerId}
              aria-label={`${player.playerName} 선수 기록 보기`}
              className="rounded-full transition hover:-translate-y-0.5"
              href={player.playerHref}
              style={{ boxShadow: `0 0 0 ${style.ringWidth}px ${tone.accent}` }}
            >
              <PlayerAvatar
                name={player.playerName}
                playerId={player.playerId}
                profileImageUrl={player.playerPhoto}
                size={getAvatarSize(variant, isTied)}
              />
            </Link>
          ))}
        </div>

        <span className="absolute -bottom-2.5 left-1/2 -translate-x-1/2">
          <MedalBadge rank={slot.rank} size={isChampion ? "md" : "sm"} />
        </span>
      </div>

      <div className={`w-full ${isChampion ? "mt-5" : "mt-4"}`}>
        <div className="flex flex-wrap items-center justify-center gap-x-1.5">
          {slot.players.map((player, index) => (
            <span key={player.playerId} className="flex items-center gap-1.5">
              {index > 0 ? <span aria-hidden="true" className="text-slate-400">·</span> : null}
              <Link className={`font-black text-slate-900 transition hover:text-arena-red ${style.nameClass}`} href={player.playerHref}>
                {player.playerName}
              </Link>
            </span>
          ))}
          {slot.overflowCount > 0 ? (
            <span className="text-xs font-bold text-slate-500">외 {slot.overflowCount}명</span>
          ) : null}
        </div>

        <p className={`mt-1 font-black tabular-nums ${style.valueClass}`} style={{ color: tone.text }}>
          {slot.displayValue}
        </p>

        <p className="mt-0.5 text-[11px] font-bold text-slate-500">
          {isTied ? `공동 ${slot.rank}위` : slot.players[0]?.playerPosition}
        </p>
      </div>
    </div>
  );
}
