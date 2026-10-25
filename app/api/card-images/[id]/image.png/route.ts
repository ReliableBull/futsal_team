import { getCurrentTeam } from "@/lib/teams";
import { cardImageStore } from "@/lib/card-image-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  await getCurrentTeam();
  const image = /^[a-f0-9-]{36}$/.test(params.id) ? cardImageStore.get(params.id) : null;
  if (!image) return new Response("저장 시간이 만료되었습니다. 선수 또는 경기 페이지에서 이미지를 다시 준비해주세요.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  const disposition = new URL(request.url).searchParams.get("download") === "1" ? "attachment" : "inline";
  return new Response(new Uint8Array(image.bytes), { headers: {
    "Content-Type": "image/png",
    "Content-Length": String(image.bytes.length),
    "Content-Disposition": `${disposition}; filename="${image.filename}"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff"
  } });
}
