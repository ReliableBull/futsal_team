import { HallOfFameIcon } from "@/components/HallOfFameIcon";
import { HallOfFamePodiumPlayer } from "@/components/HallOfFamePodiumPlayer";
import type { HallOfFameCategory, HallOfFameHighlight, HallOfFameSlot } from "@/lib/hall-of-fame";

const goldAccent = "#c19a3d";

const highlightToneClass: Record<HallOfFameHighlight["tone"], string> = {
  new: "border-arena-red/40 bg-arena-red/10 text-arena-red",
  up: "border-arena-green/40 bg-arena-green/10 text-arena-green",
  tie: "border-arena-line bg-black/25 text-slate-500"
};

/** 기록 변동 배지. 현재는 랭킹 snapshot 데이터가 없어 항상 null 이지만 확장 지점으로 남겨둔다. */
function RecordChangeBadge({ highlight }: { highlight: HallOfFameHighlight | null }) {
  if (!highlight) return null;

  return (
    <span className={`border px-2 py-0.5 text-[10px] font-black uppercase ${highlightToneClass[highlight.tone]}`}>
      {highlight.label}
    </span>
  );
}

function PodiumDivider() {
  return (
    <div
      aria-hidden="true"
      className="mx-auto mt-7 h-px w-3/4"
      style={{ background: `linear-gradient(90deg, transparent, ${goldAccent}59, transparent)` }}
    />
  );
}

/** 세로 포디움: 1위를 위쪽 중앙에, 2·3위를 아래 두 칸에 배치한다. */
function StackedPodium({ champion, runners }: { champion: HallOfFameSlot; runners: HallOfFameSlot[] }) {
  return (
    <>
      <HallOfFamePodiumPlayer slot={champion} variant="champion" />
      <PodiumDivider />

      {runners.length > 0 ? (
        <div className={`mt-8 grid gap-3 sm:gap-5 ${runners.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {runners.map((slot, index) => (
            <div key={slot.rank} className={index === 1 ? "pt-3 sm:pt-5" : ""}>
              <HallOfFamePodiumPlayer slot={slot} variant={index === 0 ? "second" : "third"} />
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-8 text-center text-xs font-bold text-slate-500">아직 2·3위 기록이 없습니다.</p>
      )}
    </>
  );
}

/** 가로 포디움: 넓은 카드에서 2위 - 1위 - 3위를 한 줄로 배치한다. */
function WidePodium({ champion, runners }: { champion: HallOfFameSlot; runners: HallOfFameSlot[] }) {
  const [second, third] = runners;

  return (
    <div className="grid grid-cols-3 items-end gap-4 px-4 pb-8 pt-10 lg:gap-6 lg:px-6">
      <div>{second ? <HallOfFamePodiumPlayer slot={second} variant="second" /> : null}</div>
      <div className="pb-8">
        <HallOfFamePodiumPlayer slot={champion} variant="champion" />
      </div>
      <div className="pt-4">{third ? <HallOfFamePodiumPlayer slot={third} variant="third" /> : null}</div>
    </div>
  );
}

type HallOfFameRecordCardProps = {
  category: HallOfFameCategory;
  /** wide 는 2열을 차지하는 카드에서 데스크톱 전용 가로 포디움을 함께 렌더링한다. */
  variant?: "default" | "wide";
};

export function HallOfFameRecordCard({ category, variant = "default" }: HallOfFameRecordCardProps) {
  const [champion, ...runners] = category.slots;
  const isWide = variant === "wide";

  return (
    <section className="flex h-full flex-col border border-arena-line border-t-2 bg-arena-panel shadow-xl shadow-black/20" style={{ borderTopColor: goldAccent }}>
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-arena-line px-4 py-3">
        <div className="flex items-center gap-3">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center border"
            style={{ borderColor: `${goldAccent}4d`, backgroundColor: `${goldAccent}14`, color: goldAccent }}
          >
            <HallOfFameIcon name={category.icon} />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: goldAccent }}>
              {category.englishTitle}
            </p>
            <h2 className="truncate text-base font-black text-white sm:text-lg">{category.title}</h2>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <RecordChangeBadge highlight={category.highlight} />
          <p className="hidden max-w-[190px] text-right text-[11px] font-bold leading-4 text-slate-500 lg:block">
            {category.description}
          </p>
        </div>
      </div>

      {champion ? (
        <>
          {isWide ? (
            <div className="hidden flex-1 md:block">
              <WidePodium champion={champion} runners={runners} />
            </div>
          ) : null}

          <div className={`flex flex-1 flex-col px-4 pb-6 pt-8 sm:px-6 sm:pt-9 ${isWide ? "md:hidden" : ""}`}>
            <StackedPodium champion={champion} runners={runners} />
          </div>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center px-4 py-14">
          <p className="text-sm font-bold text-slate-500">아직 기록이 충분하지 않습니다.</p>
        </div>
      )}
    </section>
  );
}
