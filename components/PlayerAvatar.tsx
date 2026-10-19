"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type PlayerAvatarProps = {
  playerId: number;
  name: string;
  profileImageUrl?: string | null;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
};

const sizeClass = {
  sm: "h-9 w-9 text-xs",
  md: "h-12 w-12 text-sm",
  lg: "h-24 w-24 text-2xl",
  xl: "h-[72px] w-[72px] text-xl sm:h-24 sm:w-24 sm:text-2xl",
  "2xl": "h-[104px] w-[104px] text-3xl sm:h-[136px] sm:w-[136px] sm:text-4xl"
};

const sizeHint = {
  sm: "36px",
  md: "48px",
  lg: "96px",
  xl: "96px",
  "2xl": "136px"
};

function getInitial(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "A";
}

export function PlayerAvatar({ playerId, name, profileImageUrl, size = "md" }: PlayerAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageSrc = profileImageUrl || `/images/players/${playerId}.jpg`;
  const isLocalPreview = imageSrc.startsWith("blob:") || imageSrc.startsWith("data:");

  useEffect(() => {
    setImageFailed(false);
  }, [imageSrc]);

  return (
    <span className={`relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full border border-arena-line bg-[radial-gradient(circle_at_30%_20%,rgba(239,65,54,0.32),transparent_34%),#111315] font-black text-arena-red shadow-lg shadow-black/20 ${sizeClass[size]}`}>
      {!imageFailed && isLocalPreview ? (
        <span className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url("${imageSrc}")` }} />
      ) : !imageFailed ? (
        <Image
          fill
          alt={`${name} 프로필 사진`}
          className="object-cover"
          onError={() => setImageFailed(true)}
          sizes={sizeHint[size]}
          src={imageSrc}
        />
      ) : (
        <span>{getInitial(name)}</span>
      )}
    </span>
  );
}
