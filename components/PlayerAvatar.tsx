"use client";

import Image from "next/image";
import { useState } from "react";

type PlayerAvatarProps = {
  playerId: number;
  name: string;
  profileImageUrl?: string | null;
  size?: "sm" | "md" | "lg";
};

const sizeClass = {
  sm: "h-9 w-9 text-xs",
  md: "h-12 w-12 text-sm",
  lg: "h-24 w-24 text-2xl"
};

function getInitial(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "A";
}

export function PlayerAvatar({ playerId, name, profileImageUrl, size = "md" }: PlayerAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageSrc = profileImageUrl || `/images/players/${playerId}.jpg`;

  return (
    <span className={`relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full border border-arena-line bg-[radial-gradient(circle_at_30%_20%,rgba(64,217,255,0.35),transparent_34%),#111827] font-black text-arena-lime shadow-lg shadow-black/20 ${sizeClass[size]}`}>
      {!imageFailed ? (
        <Image
          fill
          alt={`${name} 프로필 사진`}
          className="object-cover"
          onError={() => setImageFailed(true)}
          sizes={size === "lg" ? "96px" : size === "md" ? "48px" : "36px"}
          src={imageSrc}
        />
      ) : (
        <span>{getInitial(name)}</span>
      )}
    </span>
  );
}
