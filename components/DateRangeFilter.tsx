import Link from "next/link";
import type { DateRange } from "@/lib/date-range";

type DateRangeFilterProps = {
  actionPath: string;
  range: Pick<DateRange, "startDate" | "endDate">;
};

export function DateRangeFilter({ actionPath, range }: DateRangeFilterProps) {
  return (
    <form action={actionPath} className="rounded-lg border border-arena-line bg-arena-panel p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
        <label className="block space-y-2 text-sm font-semibold text-slate-200">
          시작일
          <input className="w-full rounded-md border border-arena-line bg-black/30 px-3 py-2" name="startDate" type="date" defaultValue={range.startDate} />
        </label>
        <label className="block space-y-2 text-sm font-semibold text-slate-200">
          종료일
          <input className="w-full rounded-md border border-arena-line bg-black/30 px-3 py-2" name="endDate" type="date" defaultValue={range.endDate} />
        </label>
        <button className="rounded-md bg-arena-lime px-4 py-2 text-sm font-black text-arena-black transition hover:bg-white" type="submit">
          조회
        </button>
        <Link className="rounded-md border border-arena-line px-4 py-2 text-center text-sm font-bold text-slate-200 transition hover:border-arena-cyan hover:text-white" href={actionPath}>
          기본값
        </Link>
      </div>
    </form>
  );
}
