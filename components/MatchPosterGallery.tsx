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
    <section className="rounded-lg border border-arena-line bg-arena-panel p-5 shadow-xl shadow-black/20">
      <div>
        <p className="text-sm font-bold uppercase text-arena-lime">Gallery</p>
        <h2 className="text-xl font-bold text-white">경기 포스터 갤러리</h2>
      </div>

      {posters.length > 0 ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {posters.map((poster) => (
            <Link
              key={poster.id}
              className="group overflow-hidden rounded-md border border-arena-line bg-black/20 transition hover:border-arena-cyan"
              href={`/matches/${poster.match.id}`}
            >
              <Image
                alt={`${poster.match.teamAName} 대 ${poster.match.teamBName} 경기 포스터`}
                className="h-64 w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                height={640}
                src={poster.imageUrl}
                unoptimized
                width={960}
              />
              <div className="p-3">
                <p className="text-xs font-bold text-arena-cyan">{formatDate(poster.match.matchDate)}</p>
                <p className="mt-1 truncate text-sm font-semibold text-white">
                  {poster.match.teamAName} vs {poster.match.teamBName}
                </p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-400">등록된 경기 포스터가 없습니다.</p>
      )}
    </section>
  );
}
