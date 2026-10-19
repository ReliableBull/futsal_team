"use client";

export default function HallOfFameError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="border border-arena-line bg-arena-panel px-4 py-14 text-center shadow-xl shadow-black/20">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-arena-red">Hall of Fame</p>
      <h1 className="mt-2 text-xl font-black text-white">기록을 불러오지 못했습니다.</h1>
      <p className="mt-2 text-sm font-bold text-slate-500">
        잠시 후 다시 시도해 주세요. 문제가 계속되면 관리자에게 문의해 주세요.
      </p>
      <button
        className="mt-5 border border-arena-line bg-black/25 px-4 py-2 text-sm font-black text-slate-200 transition hover:border-arena-red hover:text-white"
        onClick={reset}
        type="button"
      >
        다시 시도
      </button>
    </section>
  );
}
