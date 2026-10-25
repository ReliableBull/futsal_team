import Link from "@/components/TeamLink";
import type { Prisma } from "@prisma/client";
import { describeIpScope, describeUserAgent, formatKstDateTime, getRetentionDays, startOfKstDay } from "@/lib/access-logs";
import { requireAdmin } from "@/lib/auth";
import { getTeamPrisma } from "@/lib/teams";

const pageSize = 50;
const dayMs = 24 * 60 * 60 * 1000;

const rangeOptions = [
  { value: "today", label: "오늘" },
  { value: "7d", label: "최근 7일" },
  { value: "30d", label: "최근 30일" },
  { value: "all", label: "전체" }
] as const;

type Range = (typeof rangeOptions)[number]["value"];

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function getRangeStart(range: Range) {
  const today = startOfKstDay();
  if (range === "today") return today;
  if (range === "7d") return new Date(today.getTime() - 6 * dayMs);
  if (range === "30d") return new Date(today.getTime() - 29 * dayMs);
  return null;
}

function parseFilters(searchParams: SearchParams) {
  const requestedRange = first(searchParams.range);
  const range = rangeOptions.find((option) => option.value === requestedRange)?.value ?? "7d";
  const page = Math.max(1, Math.min(10000, Number.parseInt(first(searchParams.page), 10) || 1));

  return {
    range: range as Range,
    ip: first(searchParams.ip).slice(0, 45),
    path: first(searchParams.path).slice(0, 200),
    hideAdmin: first(searchParams.hideAdmin) === "1",
    page
  };
}

type Filters = ReturnType<typeof parseFilters>;

function buildHref(filters: Filters, overrides: Partial<Filters>) {
  const next = { ...filters, ...overrides };
  const params = new URLSearchParams();
  if (next.range !== "7d") params.set("range", next.range);
  if (next.ip) params.set("ip", next.ip);
  if (next.path) params.set("path", next.path);
  if (next.hideAdmin) params.set("hideAdmin", "1");
  if (next.page > 1) params.set("page", String(next.page));
  const query = params.toString();
  return `/abcd/access-logs${query ? `?${query}` : ""}`;
}

async function countVisitors(where: Prisma.AccessLogWhereInput) {
  const prisma = await getTeamPrisma();
  const [views, visitors] = await Promise.all([prisma.accessLog.count({ where }), prisma.accessLog.groupBy({ by: ["ip"], where })]);
  return { views, visitors: visitors.length };
}

function formatReferrer(referrer: string | null) {
  if (!referrer) return "직접 접속";
  try {
    const url = new URL(referrer);
    return url.host === new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").host ? `${url.pathname}${url.search}` : url.host;
  } catch {
    return referrer;
  }
}

export default async function AccessLogsPage({ searchParams }: { searchParams: SearchParams }) {
  const prisma = await getTeamPrisma();
  await requireAdmin();

  const filters = parseFilters(searchParams);
  const rangeStart = getRangeStart(filters.range);
  const adminWhere: Prisma.AccessLogWhereInput = filters.hideAdmin ? { isAdmin: false } : {};
  const where: Prisma.AccessLogWhereInput = {
    ...adminWhere,
    ...(rangeStart && { createdAt: { gte: rangeStart } }),
    ...(filters.ip && { ip: filters.ip }),
    ...(filters.path && { path: { contains: filters.path, mode: "insensitive" as const } })
  };
  const today = startOfKstDay();

  const [todayStats, weekStats, total, logs, topIps, topPaths] = await Promise.all([
    countVisitors({ ...adminWhere, createdAt: { gte: today } }),
    countVisitors({ ...adminWhere, createdAt: { gte: new Date(today.getTime() - 6 * dayMs) } }),
    prisma.accessLog.count({ where }),
    prisma.accessLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * pageSize,
      take: pageSize
    }),
    prisma.accessLog.groupBy({
      by: ["ip"],
      where,
      _count: { _all: true },
      _max: { createdAt: true },
      orderBy: { _count: { ip: "desc" } },
      take: 10
    }),
    prisma.accessLog.groupBy({
      by: ["path"],
      where,
      _count: { _all: true },
      orderBy: { _count: { path: "desc" } },
      take: 10
    })
  ]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const summaryCards = [
    { label: "오늘 페이지뷰", value: todayStats.views },
    { label: "오늘 방문 IP", value: todayStats.visitors },
    { label: "최근 7일 페이지뷰", value: weekStats.views },
    { label: "최근 7일 방문 IP", value: weekStats.visitors }
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-bold uppercase text-arena-lime">Admin</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-black text-white">접속 로그</h1>
            <p className="mt-2 text-sm text-slate-400">
              페이지를 열 때마다 접속 시간·IP·경로·기기를 기록합니다. 시간은 한국 시간 기준이며 {getRetentionDays()}일이 지난 기록은 자동 삭제됩니다.
            </p>
          </div>
          <Link className="rounded-md border border-arena-line px-4 py-2 text-sm font-bold text-slate-200 transition hover:border-arena-cyan hover:text-white" href="/abcd">
            관리자 페이지로
          </Link>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded-lg border border-arena-line bg-arena-panel p-4">
            <p className="text-sm font-semibold text-slate-400">{card.label}</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-white">{card.value.toLocaleString("ko-KR")}</p>
          </div>
        ))}
      </section>

      <form className="flex flex-col gap-3 rounded-lg border border-arena-line bg-arena-panel p-4 lg:flex-row lg:items-end" method="get">
        <label className="block space-y-1 text-sm font-semibold text-slate-200">
          기간
          <select className="w-full rounded-md border border-arena-line bg-black/30 px-3 py-2 lg:w-36" name="range" defaultValue={filters.range}>
            {rangeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block flex-1 space-y-1 text-sm font-semibold text-slate-200">
          IP
          <input className="w-full rounded-md border border-arena-line bg-black/30 px-3 py-2" name="ip" defaultValue={filters.ip} placeholder="예: 203.0.113.10" />
        </label>
        <label className="block flex-1 space-y-1 text-sm font-semibold text-slate-200">
          페이지 경로 포함
          <input className="w-full rounded-md border border-arena-line bg-black/30 px-3 py-2" name="path" defaultValue={filters.path} placeholder="예: /players" />
        </label>
        <label className="flex items-center gap-2 py-2 text-sm font-semibold text-slate-200">
          <input type="checkbox" name="hideAdmin" value="1" defaultChecked={filters.hideAdmin} />
          관리자 접속 제외
        </label>
        <div className="flex gap-2">
          <button className="rounded-md bg-arena-lime px-4 py-2 text-sm font-black text-[#fff] transition hover:opacity-90" type="submit">
            조회
          </button>
          <Link className="rounded-md border border-arena-line px-4 py-2 text-sm font-bold text-slate-200 transition hover:border-arena-cyan hover:text-white" href="/abcd/access-logs">
            초기화
          </Link>
        </div>
      </form>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-lg border border-arena-line bg-arena-panel p-5">
          <h2 className="text-lg font-bold text-white">많이 접속한 IP</h2>
          {topIps.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">기록이 없습니다.</p>
          ) : (
            <ul className="mt-3 divide-y divide-arena-line">
              {topIps.map((row) => {
                const scope = describeIpScope(row.ip);
                return (
                  <li key={row.ip} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <Link className="min-w-0 truncate font-mono font-semibold text-arena-cyan hover:underline" href={buildHref(filters, { ip: row.ip, page: 1 })}>
                      {row.ip}
                      {scope && <span className="ml-2 font-sans text-xs text-slate-400">{scope}</span>}
                    </Link>
                    <span className="shrink-0 text-right text-slate-400">
                      <span className="font-bold tabular-nums text-white">{row._count._all.toLocaleString("ko-KR")}회</span>
                      {row._max.createdAt && <span className="ml-2 hidden text-xs sm:inline">최근 {formatKstDateTime(row._max.createdAt)}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="rounded-lg border border-arena-line bg-arena-panel p-5">
          <h2 className="text-lg font-bold text-white">많이 본 페이지</h2>
          {topPaths.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">기록이 없습니다.</p>
          ) : (
            <ul className="mt-3 divide-y divide-arena-line">
              {topPaths.map((row) => (
                <li key={row.path} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <Link className="min-w-0 truncate font-semibold text-arena-cyan hover:underline" href={buildHref(filters, { path: row.path, page: 1 })}>
                    {row.path}
                  </Link>
                  <span className="shrink-0 font-bold tabular-nums text-white">{row._count._all.toLocaleString("ko-KR")}회</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-arena-line bg-arena-panel p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold text-white">상세 기록</h2>
          <p className="text-sm text-slate-400">총 {total.toLocaleString("ko-KR")}건</p>
        </div>
        {logs.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">조건에 맞는 접속 기록이 없습니다.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-arena-line text-xs uppercase text-slate-400">
                <tr>
                  <th className="py-2 pr-4 font-bold">접속 시간</th>
                  <th className="py-2 pr-4 font-bold">IP</th>
                  <th className="py-2 pr-4 font-bold">페이지</th>
                  <th className="py-2 pr-4 font-bold">기기 · 브라우저</th>
                  <th className="py-2 font-bold">유입 경로</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-arena-line">
                {logs.map((log) => {
                  const scope = describeIpScope(log.ip);
                  return (
                    <tr key={log.id} className="align-top">
                      <td className="whitespace-nowrap py-2 pr-4 font-mono tabular-nums text-slate-300">{formatKstDateTime(log.createdAt)}</td>
                      <td className="whitespace-nowrap py-2 pr-4">
                        <Link className="font-mono font-semibold text-arena-cyan hover:underline" href={buildHref(filters, { ip: log.ip, page: 1 })}>
                          {log.ip}
                        </Link>
                        {scope && <span className="ml-2 text-xs text-slate-400">{scope}</span>}
                        {log.isAdmin && <span className="ml-2 rounded bg-arena-red px-1.5 py-0.5 text-[11px] font-bold text-[#fff]">관리자</span>}
                      </td>
                      <td className="max-w-[260px] truncate py-2 pr-4 text-white" title={log.path}>
                        {log.path}
                      </td>
                      <td className="whitespace-nowrap py-2 pr-4 text-slate-300" title={log.userAgent ?? undefined}>
                        {describeUserAgent(log.userAgent)}
                      </td>
                      <td className="max-w-[220px] truncate py-2 text-slate-400" title={log.referrer ?? undefined}>
                        {formatReferrer(log.referrer)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {pageCount > 1 && (
          <nav className="mt-4 flex items-center justify-center gap-3 text-sm" aria-label="페이지 이동">
            {filters.page > 1 ? (
              <Link className="rounded-md border border-arena-line px-3 py-1.5 font-bold text-slate-200 hover:border-arena-cyan" href={buildHref(filters, { page: filters.page - 1 })}>
                이전
              </Link>
            ) : (
              <span className="rounded-md border border-arena-line px-3 py-1.5 font-bold text-slate-400 opacity-50">이전</span>
            )}
            <span className="tabular-nums text-slate-400">
              {filters.page} / {pageCount}
            </span>
            {filters.page < pageCount ? (
              <Link className="rounded-md border border-arena-line px-3 py-1.5 font-bold text-slate-200 hover:border-arena-cyan" href={buildHref(filters, { page: filters.page + 1 })}>
                다음
              </Link>
            ) : (
              <span className="rounded-md border border-arena-line px-3 py-1.5 font-bold text-slate-400 opacity-50">다음</span>
            )}
          </nav>
        )}
      </section>
    </div>
  );
}
