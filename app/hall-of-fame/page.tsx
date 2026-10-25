import { getCurrentTeam } from "@/lib/teams";
import type { Metadata } from "next";
import Link from "@/components/TeamLink";
import { HallOfFameHero } from "@/components/HallOfFameHero";
import { HallOfFameRecordCard } from "@/components/HallOfFameRecordCard";
import { formatHallOfFameUpdatedAt, getHallOfFameData } from "@/lib/hall-of-fame";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> { return { title: `명예의 전당 | ${(await getCurrentTeam()).name}` }; }

export default async function HallOfFamePage() {
  const team = await getCurrentTeam();
  const { categories, updatedAt, totalMatches, totalPlayers } = await getHallOfFameData();
  const hasAnyRecord = categories.some((category) => category.slots.length > 0);

  return (
    <div className="space-y-4 sm:space-y-5">
      <HallOfFameHero
        teamName={team.name}
        totalMatches={totalMatches}
        totalPlayers={totalPlayers}
        updatedAtLabel={formatHallOfFameUpdatedAt(updatedAt)}
      />

      {hasAnyRecord ? null : (
        <p className="border border-arena-line bg-arena-panel px-4 py-10 text-center text-sm font-bold text-slate-500">
          아직 기록이 충분하지 않습니다. 경기 결과가 등록되면 명예의 전당이 자동으로 채워집니다.
        </p>
      )}

      <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
        {categories.map((category, index) => {
          // 카드 수가 홀수면 마지막 카드가 두 칸을 차지하며 가로 포디움으로 표시된다.
          const isLastAloneInRow = index === categories.length - 1 && categories.length % 2 === 1;

          return (
            <div className={isLastAloneInRow ? "md:col-span-2" : ""} key={category.key}>
              <HallOfFameRecordCard category={category} variant={isLastAloneInRow ? "wide" : "default"} />
            </div>
          );
        })}
      </div>

      <footer className="flex flex-col gap-2 border border-arena-line bg-arena-panel px-4 py-4 text-xs font-bold text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p>
          모든 기록은 결과 등록이 완료된 경기에서 자동 집계됩니다. 연속 기록은 실제 출전 경기를 날짜순으로 계산하며, 결장 경기는 제외합니다.
        </p>
        <Link className="shrink-0 transition hover:text-arena-red" href="/players">
          전체 선수 기록 보기 →
        </Link>
      </footer>
    </div>
  );
}
