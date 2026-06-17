import Link from "next/link";
import { quickDateRanges, type DateRange } from "@/lib/date-range";

type DateRangeFilterProps = {
  actionPath: string;
  range: Pick<DateRange, "startDate" | "endDate">;
};

export function DateRangeFilter({ actionPath, range }: DateRangeFilterProps) {
  return (
    <form key={`${range.startDate}-${range.endDate}`} action={actionPath} className="rounded-lg border border-arena-line bg-arena-panel p-4">
      <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
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
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {quickDateRanges.map((quickRange) => {
          const isActive = range.startDate === quickRange.startDate && range.endDate === quickRange.endDate;
          const href = `${actionPath}?startDate=${quickRange.startDate}&endDate=${quickRange.endDate}`;

          return (
            <Link
              key={quickRange.label}
              className={`rounded-md border px-4 py-2 text-sm font-bold transition ${
                isActive
                  ? "border-arena-lime bg-arena-lime text-arena-black"
                  : "border-arena-line text-slate-200 hover:border-arena-cyan hover:text-white"
              }`}
              href={href}
            >
              {quickRange.label}
            </Link>
          );
        })}
      </div>
    </form>
  );
}
