import { sportLabel } from "@/lib/community";
import { won, type DemoVenue } from "@/lib/demo-venues";
import { PitchArt } from "./PitchArt";

export function VenueCard({ venue }: { venue: DemoVenue }) {
  return <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-1 hover:shadow-lg"><a href={`/venues/${venue.slug}`} className="group block"><div className="relative"><PitchArt theme={venue.theme} /><span className="absolute left-4 top-4 rounded-md bg-white/95 px-2.5 py-1.5 text-[11px] font-bold text-slate-700">예시 구장</span><span className="absolute bottom-4 right-4 rounded-md bg-[#10251f] px-2.5 py-1.5 text-xs font-bold text-[#fff]">{venue.setting} · {venue.format}</span></div><div className="p-5"><p className="text-xs font-semibold text-slate-500">{venue.region} · {sportLabel(venue.sport)}</p><h3 className="mt-2 text-lg font-black group-hover:text-emerald-800">{venue.name} <span className="float-right text-slate-300">↗</span></h3><p className="mt-3 text-xs text-slate-500">{venue.facilities.slice(0, 3).join(" · ")}</p><div className="mt-5 flex items-end justify-between border-t border-slate-100 pt-4"><p><strong className="text-lg">{won(venue.price)}</strong><span className="ml-1 text-xs text-slate-500">/ 2시간</span></p><span className="text-xs font-bold text-emerald-800">시간 선택 →</span></div></div></a></article>;
}
