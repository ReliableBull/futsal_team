import Image from "next/image";
import Link from "next/link";
import type { Match, MatchPoster } from "@prisma/client";
import { formatDate } from "@/lib/stats";

type GalleryPoster = MatchPoster & {
  match: Pick<Match, "id" | "matchDate" | "teamAName" | "teamBName">;
};

type MatchPosterGalleryProps = {
  posters: GalleryPoster[];
};

export function MatchPosterGallery({ posters }: MatchPosterGalleryProps) {
  return (
    <section className="border border-arena-line bg-arena-panel p-4 shadow-xl shadow-black/20 sm:p-5">
      <div className="flex items-end justify-between gap-4 border-b border-arena-line pb-4">
        <div>
          <p className="text-xs font-black uppercase text-arena-red">Matchday Archive</p>
          <h2 className="mt-1 text-xl font-black text-white">경기 포스터 갤러리</h2>
        </div>
        <span className="text-xs font-bold text-slate-500">{posters.length} POSTERS</span>
      </div>

      {posters.length > 0 ? (
        <div className="arena-scrollbar -mx-4 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 sm:-mx-5 sm:px-5">
          {posters.map((poster) => (
            <Link
              key={poster.id}
              className="group w-[72vw] max-w-[280px] shrink-0 snap-start overflow-hidden border border-arena-line bg-black/30 transition hover:border-arena-red sm:w-[240px]"
              href={`/matches/${poster.match.id}`}
            >
              <Image
                alt={`${poster.match.teamAName} 대 ${poster.match.teamBName} 경기 포스터`}
                className="aspect-[4/5] w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                height={640}
                src={poster.imageUrl}
                unoptimized
                width={960}
              />
              <div className="border-t border-arena-line p-3">
                <p className="text-[11px] font-black text-arena-red">{formatDate(poster.match.matchDate)}</p>
                <p className="mt-1 truncate text-sm font-black text-white">
                  {poster.match.teamAName} vs {poster.match.teamBName}
                </p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-4 border border-dashed border-arena-line p-5 text-sm text-slate-500">등록된 경기 포스터가 없습니다.</p>
      )}
    </section>
  );
}
