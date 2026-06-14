export const defaultStartDate = "2026-01-01";
export const defaultEndDate = "2026-12-31";

export type DateRange = {
  startDate: string;
  endDate: string;
  start: Date;
  end: Date;
};

function isDateInput(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function getDateRange(searchParams?: { startDate?: string; endDate?: string }): DateRange {
  const requestedStartDate = searchParams?.startDate;
  const requestedEndDate = searchParams?.endDate;
  const startDate = isDateInput(requestedStartDate) ? requestedStartDate : defaultStartDate;
  const endDate = isDateInput(requestedEndDate) ? requestedEndDate : defaultEndDate;

  return {
    startDate,
    endDate,
    start: new Date(`${startDate}T00:00:00.000Z`),
    end: new Date(`${endDate}T23:59:59.999Z`)
  };
}

export function getMatchDateWhere(range: Pick<DateRange, "start" | "end">) {
  return {
    gte: range.start,
    lte: range.end
  };
}
