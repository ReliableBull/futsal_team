import { hallOfFameCategoryKeys } from "@/lib/hall-of-fame";

function PodiumSkeleton({ size }: { size: "lg" | "sm" }) {
  const avatarClass = size === "lg" ? "h-[104px] w-[104px] sm:h-[136px] sm:w-[136px]" : "h-[72px] w-[72px] sm:h-24 sm:w-24";

  return (
    <div className="flex flex-col items-center gap-2">
      <span className={`rounded-full bg-slate-200 ${avatarClass}`} />
      <span className="h-4 w-14 bg-slate-200" />
      <span className={`bg-slate-200 ${size === "lg" ? "h-6 w-20" : "h-4 w-14"}`} />
    </div>
  );
}

function RecordCardSkeleton() {
  return (
    <section className="border border-arena-line border-t-2 border-t-slate-300 bg-arena-panel shadow-xl shadow-black/20">
      <div className="flex min-h-14 items-center gap-3 border-b border-arena-line px-4 py-3">
        <span className="h-9 w-9 bg-slate-200" />
        <div className="space-y-1.5">
          <span className="block h-2.5 w-20 bg-slate-200" />
          <span className="block h-4 w-28 bg-slate-200" />
        </div>
      </div>
      <div className="px-4 pb-6 pt-8 sm:px-6">
        <PodiumSkeleton size="lg" />
        <div className="mx-auto mt-7 h-px w-3/4 bg-slate-200" />
        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-5">
          <PodiumSkeleton size="sm" />
          <PodiumSkeleton size="sm" />
        </div>
      </div>
    </section>
  );
}

export function HallOfFameSkeleton() {
  return (
    <div className="animate-pulse space-y-5" aria-busy="true" aria-live="polite">
      <div className="h-[200px] border border-arena-line bg-[#0b0d10] sm:h-[220px]" />
      <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
        {Array.from({ length: hallOfFameCategoryKeys.length }).map((_, index) => (
          <div className={index === hallOfFameCategoryKeys.length - 1 && hallOfFameCategoryKeys.length % 2 === 1 ? "md:col-span-2" : ""} key={index}>
            <RecordCardSkeleton />
          </div>
        ))}
      </div>
      <span className="sr-only">명예의 전당 기록을 불러오는 중입니다.</span>
    </div>
  );
}
