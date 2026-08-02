import type { WeeklyWeather } from "@/lib/weather";

type WeeklyWeatherCardProps = {
  weather: WeeklyWeather;
};

export function WeeklyWeatherCard({ weather }: WeeklyWeatherCardProps) {
  return (
    <section className="border border-arena-line bg-arena-panel p-4 shadow-xl shadow-black/20 sm:p-5">
      <div className="flex flex-col gap-1 border-b border-arena-line pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase text-arena-red">Matchday Weather</p>
          <h2 className="mt-1 text-xl font-black text-white">{weather.location} 10일 날씨</h2>
        </div>
        <p className="text-xs font-bold text-slate-500">경기 준비 참고용</p>
      </div>

      <div className="arena-scrollbar -mx-4 mt-4 flex overflow-x-auto px-4 pb-2 sm:-mx-5 sm:px-5">
        {weather.items.map((item) => (
          <div key={`${item.dateLabel}-${item.day}`} className="w-32 shrink-0 border-r border-arena-line px-4 py-2 first:border-l">
            <p className="text-xs font-black text-white">
              {item.day} <span className="ml-1 text-slate-500">{item.dateLabel}</span>
            </p>
            <p className="mt-3 text-sm font-black text-slate-200">{item.condition}</p>
            <p className="mt-1 text-sm font-black text-white">
              {item.minTemp}° / {item.maxTemp}°
            </p>
            <p className="mt-1 text-[11px] font-bold text-sky-400">강수 {item.precipitationChance}%</p>
          </div>
        ))}
      </div>
    </section>
  );
}
