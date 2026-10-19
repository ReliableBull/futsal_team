"use client";

export default function ChemistryError({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-arena-line bg-white p-8">
      <h1 className="text-xl font-black text-slate-900">조합 기록을 불러오지 못했습니다.</h1>
      <p className="mt-2 text-sm text-slate-500">잠시 후 다시 시도해주세요.</p>
      <button type="button" onClick={reset} className="mt-5 rounded-lg bg-arena-red px-5 py-3 text-sm font-bold text-[#fff]">다시 시도</button>
    </div>
  );
}
