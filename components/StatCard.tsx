import Link from "next/link";

type StatCardProps = {
  label: string;
  value: string | number;
  detail?: string;
  href?: string;
};

export function StatCard({ label, value, detail, href }: StatCardProps) {
  const content = (
    <>
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
      {detail ? <p className="mt-1 text-sm text-slate-400">{detail}</p> : null}
    </>
  );

  return href ? (
    <Link
      className="group rounded-lg border border-arena-line bg-arena-panel p-4 shadow-xl shadow-black/20 transition hover:border-arena-red hover:shadow-lg"
      href={href}
    >
      {content}
      <span className="mt-3 inline-flex text-xs font-black text-arena-red group-hover:underline">상세 기록 보기 →</span>
    </Link>
  ) : (
    <div className="rounded-lg border border-arena-line bg-arena-panel p-4 shadow-xl shadow-black/20">{content}</div>
  );
}
