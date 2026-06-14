"use client";

import { useState } from "react";
import type { Player } from "@prisma/client";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { parsePlayerPosition, playerPositions } from "@/lib/player-position";

type AdminPlayerEditorProps = {
  player: Player;
  action: (formData: FormData) => void | Promise<void>;
  deleteAction: (formData: FormData) => void | Promise<void>;
  matchCount: number;
};

export function AdminPlayerEditor({ player, action, deleteAction, matchCount }: AdminPlayerEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(player.profileImageUrl ?? "");
  const position = parsePlayerPosition(player.position);

  return (
    <div className="rounded-md border border-arena-line bg-black/20 p-3">
      <button className="flex w-full items-center gap-3 text-left" type="button" onClick={() => setIsOpen((current) => !current)}>
        <PlayerAvatar playerId={player.id} name={player.name} profileImageUrl={previewUrl || player.profileImageUrl} size="sm" />
          <span className="min-w-0 flex-1">
          <span className="block font-bold text-white">{player.name}</span>
          <span className="text-sm text-slate-400">
            {position} · #{player.number ?? "-"}
          </span>
        </span>
        <span className="text-sm font-bold text-arena-cyan">{isOpen ? "닫기" : "수정"}</span>
      </button>

      {isOpen ? (
        <div className="mt-4 grid gap-3">
          <form action={action} className="grid gap-3">
            <label className="space-y-1 text-sm font-semibold text-slate-200">
              이름
              <input className="w-full rounded-md border border-arena-line bg-black/30 px-3 py-2" name="name" defaultValue={player.name} required />
            </label>
            <label className="space-y-1 text-sm font-semibold text-slate-200">
              닉네임
              <input className="w-full rounded-md border border-arena-line bg-black/30 px-3 py-2" name="nickname" defaultValue={player.nickname ?? ""} />
            </label>
            <label className="space-y-1 text-sm font-semibold text-slate-200">
              포지션
              <select className="w-full rounded-md border border-arena-line bg-black/30 px-3 py-2" name="position" defaultValue={position}>
                {playerPositions.map((position) => (
                  <option key={position} value={position}>
                    {position}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm font-semibold text-slate-200">
              프로필 이미지 경로
              <input
                className="w-full rounded-md border border-arena-line bg-black/30 px-3 py-2"
                name="profileImageUrl"
                defaultValue={player.profileImageUrl ?? ""}
                onChange={(event) => setPreviewUrl(event.target.value)}
                placeholder={`/images/players/${player.id}.jpg`}
              />
            </label>
            <label className="space-y-1 text-sm font-semibold text-slate-200">
              등번호
              <input className="w-full rounded-md border border-arena-line bg-black/30 px-3 py-2" name="number" type="number" min="0" defaultValue={player.number ?? ""} />
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <input name="isActive" type="checkbox" defaultChecked={player.isActive} />
              선수 목록 포함
            </label>
            <button className="rounded-md bg-arena-lime px-4 py-2 font-black text-arena-black transition hover:bg-white" type="submit">
              선수 정보 저장
            </button>
          </form>

          <form
            action={deleteAction}
            onSubmit={(event) => {
              if (!window.confirm("정말 삭제하시겠습니까?")) {
                event.preventDefault();
              }
            }}
          >
            <button
              className="w-full rounded-md border border-red-400/40 px-4 py-2 text-sm font-bold text-red-200 transition enabled:hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={matchCount > 0}
              title={matchCount > 0 ? "경기 이력이 있는 선수는 삭제할 수 없습니다." : undefined}
              type="submit"
            >
              선수 삭제
            </button>
            {matchCount > 0 ? <p className="mt-2 text-xs text-slate-500">경기 이력이 있어 삭제할 수 없습니다. 선수 목록 포함을 해제해주세요.</p> : null}
          </form>
        </div>
      ) : null}
    </div>
  );
}
