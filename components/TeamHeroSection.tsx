"use client";

import Image from "next/image";
import { useState } from "react";

const badges = ["Since 2026", "Weekly Match", "Team Stats"];

export function TeamHeroSection() {
  const [hasImage, setHasImage] = useState(true);

  return (
    <section className="group relative min-h-[240px] overflow-hidden rounded-lg border border-arena-line bg-[radial-gradient(circle_at_20%_20%,rgba(64,217,255,0.22),transparent_34%),linear-gradient(135deg,#111827,#0b1120_48%,#151d2d)] shadow-2xl shadow-black/40 transition duration-300 hover:shadow-arena-cyan/10 sm:min-h-[280px] lg:min-h-[380px]">
      {hasImage ? (
        <Image
          fill
          alt="ARENA FC team group photo"
          className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.015]"
          onError={() => setHasImage(false)}
          priority
          sizes="(max-width: 768px) 100vw, 1152px"
          src="/images/arena-team.jpg"
        />
      ) : null}

      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,11,18,0.92),rgba(8,11,18,0.58)_46%,rgba(8,11,18,0.2)),linear-gradient(0deg,rgba(8,11,18,0.82),rgba(8,11,18,0.12)_58%,rgba(8,11,18,0.32))]" />

      <div className="relative flex min-h-[240px] flex-col justify-end p-5 sm:min-h-[280px] sm:p-7 lg:min-h-[380px] lg:p-9">
        <div className="max-w-2xl">
          <p className="text-sm font-black uppercase tracking-[0.24em] text-arena-lime">Official Team Record</p>
          <h2 className="mt-2 text-4xl font-black text-white sm:text-5xl lg:text-6xl">ARENA FC</h2>
          <p className="mt-3 max-w-xl text-base font-medium text-slate-100 sm:text-lg">함께 뛰는 순간, 하나가 되는 ARENA FC</p>

          {!hasImage ? <p className="mt-2 text-sm text-slate-300">Team photo will be updated soon</p> : null}

          <div className="mt-5 flex flex-wrap gap-2">
            {badges.map((badge) => (
              <span key={badge} className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white backdrop-blur">
                {badge}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
