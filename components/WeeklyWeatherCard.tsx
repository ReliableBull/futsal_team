import type { WeeklyWeather } from "@/lib/weather";

type WeeklyWeatherCardProps = {
  weather: WeeklyWeather;
};

export function WeeklyWeatherCard({ weather }: WeeklyWeatherCardProps) {
  return (
    <section className="rounded-lg border border-arena-line bg-arena-panel p-5 shadow-xl shadow-black/20">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-arena-lime">Weather</p>
          <h2 className="text-xl font-bold text-white">{weather.location} 10일 날씨</h2>
        </div>
        <p className="text-sm text-slate-400">경기 준비 참고용</p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {weather.items.map((item) => (
          <div key={`${item.dateLabel}-${item.day}`} className="rounded-md border border-arena-line bg-black/20 p-3">
            <p className="text-sm font-bold text-arena-cyan">
              {item.day} <span className="text-slate-400">{item.dateLabel}</span>
            </p>
            <p className="mt-2 text-base font-semibold text-white">{item.condition}</p>
            <p className="mt-1 text-sm text-slate-300">
              {item.minTemp}° / {item.maxTemp}°
            </p>
            <p className="mt-1 text-xs text-slate-400">강수 {item.precipitationChance}%</p>
          </div>
        ))}
      </div>
    </section>
  );
}
