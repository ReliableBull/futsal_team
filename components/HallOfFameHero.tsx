import { HallOfFameIcon } from "@/components/HallOfFameIcon";

type HallOfFameHeroProps = {
  teamName: string;
  updatedAtLabel: string;
  totalMatches: number;
  totalPlayers: number;
};

const goldAccent = "#c19a3d";

export function HallOfFameHero({ teamName, updatedAtLabel, totalMatches, totalPlayers }: HallOfFameHeroProps) {
  return (
    <section className="arena-dark relative overflow-hidden border border-arena-line bg-[#0b0d10] shadow-xl shadow-black/30">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(120% 130% at 18% -20%, rgba(193,154,61,0.22), transparent 58%)" }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-16 hidden text-[#c19a3d]/10 sm:block"
      >
        <HallOfFameIcon className="h-56 w-56" name="trophy" />
      </span>

      <div className="relative flex flex-col gap-5 px-5 py-7 sm:px-8 sm:py-9 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 -skew-x-6 place-items-center border-2 border-arena-red text-[11px] font-black text-arena-red">
              A
            </span>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">{teamName}</p>
          </div>
          <h1 className="mt-3 text-3xl font-black italic leading-none text-white sm:text-5xl">
            HALL OF <span style={{ color: goldAccent }}>FAME</span>
          </h1>
          <p className="mt-3 text-sm font-bold text-slate-300 sm:text-base">{teamName}의 기록을 만들어가는 선수들</p>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">THE RECORD HOLDERS</p>
        </div>

        <dl className="flex flex-wrap items-center gap-2 text-xs font-bold sm:gap-3">
          <div className="flex items-center gap-2 border border-arena-line bg-white/[0.04] px-3 py-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-arena-red opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-arena-red" />
            </span>
            <dt className="uppercase tracking-[0.16em] text-slate-300">Live Records</dt>
          </div>
          <div className="border border-arena-line bg-white/[0.04] px-3 py-2">
            <dt className="text-[10px] uppercase tracking-[0.16em] text-slate-500">집계 경기</dt>
            <dd className="mt-0.5 text-sm font-black text-white">{totalMatches}경기</dd>
          </div>
          <div className="border border-arena-line bg-white/[0.04] px-3 py-2">
            <dt className="text-[10px] uppercase tracking-[0.16em] text-slate-500">등록 선수</dt>
            <dd className="mt-0.5 text-sm font-black text-white">{totalPlayers}명</dd>
          </div>
          <div className="border border-arena-line bg-white/[0.04] px-3 py-2">
            <dt className="text-[10px] uppercase tracking-[0.16em] text-slate-500">최근 기록 업데이트</dt>
            <dd className="mt-0.5 text-sm font-black" style={{ color: goldAccent }}>
              {updatedAtLabel}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
