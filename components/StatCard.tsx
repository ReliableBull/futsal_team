type StatCardProps = {
  label: string;
  value: string | number;
  detail?: string;
};

export function StatCard({ label, value, detail }: StatCardProps) {
  return (
    <div className="rounded-lg border border-arena-line bg-arena-panel p-4 shadow-xl shadow-black/20">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
      {detail ? <p className="mt-1 text-sm text-slate-400">{detail}</p> : null}
    </div>
  );
}
