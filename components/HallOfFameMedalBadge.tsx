export type MedalTone = {
  /** 메달/테두리 기본 색 */
  accent: string;
  /** 배지 배경 */
  surface: string;
  /** 배지 텍스트 색 */
  text: string;
  label: string;
};

export const medalTones: Record<number, MedalTone> = {
  1: { accent: "#c19a3d", surface: "#fbf4e3", text: "#8a6414", label: "GOLD" },
  2: { accent: "#98a2b0", surface: "#f4f6f8", text: "#55606e", label: "SILVER" },
  3: { accent: "#b07647", surface: "#faf0e7", text: "#875428", label: "BRONZE" }
};

export function getMedalTone(rank: number) {
  return medalTones[rank] ?? medalTones[3];
}

type MedalBadgeProps = {
  rank: number;
  size?: "sm" | "md";
};

export function MedalBadge({ rank, size = "md" }: MedalBadgeProps) {
  const tone = getMedalTone(rank);
  const isCompact = size === "sm";

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap border font-black uppercase tracking-wide ${
        isCompact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"
      }`}
      style={{ borderColor: `${tone.accent}59`, backgroundColor: tone.surface, color: tone.text }}
    >
      <svg
        aria-hidden="true"
        className={isCompact ? "h-3.5 w-3.5" : "h-4 w-4"}
        fill="none"
        stroke={tone.accent}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.6}
        viewBox="0 0 24 24"
      >
        <path d="M8.5 2.5 11 8M15.5 2.5 13 8" />
        <circle cx="12" cy="15" fill={`${tone.accent}26`} r="6.2" />
      </svg>
      <span>{rank}위</span>
      <span className="sr-only">{tone.label}</span>
    </span>
  );
}
