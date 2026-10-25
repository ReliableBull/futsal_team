import { getCurrentTeam } from "@/lib/teams";
import { cardImageFilename, cardImageStore, isCardPng, MAX_CARD_IMAGE_BYTES } from "@/lib/card-image-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  await getCurrentTeam();
  const origin = request.headers.get("origin");
  if (origin) {
    let allowed = false;
    try { allowed = origin === new URL(request.url).origin || new URL(origin).host === request.headers.get("host"); } catch { /* Malformed or opaque origins are not accepted. */ }
    if (!allowed) return Response.json({ error: "다른 사이트에서는 이미지를 저장할 수 없습니다." }, { status: 403 });
  }
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "image/png") {
    return Response.json({ error: "PNG 이미지만 저장할 수 있습니다." }, { status: 415 });
  }
  if (!request.body || Number(request.headers.get("content-length")) > MAX_CARD_IMAGE_BYTES) {
    return Response.json({ error: "이미지 크기가 너무 큽니다." }, { status: 413 });
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_CARD_IMAGE_BYTES) {
        await reader.cancel();
        return Response.json({ error: "이미지 크기가 너무 큽니다." }, { status: 413 });
      }
      chunks.push(value);
    }
  } catch {
    return Response.json({ error: "이미지를 전송하지 못했습니다." }, { status: 400 });
  } finally { reader.releaseLock(); }
  const bytes = Buffer.concat(chunks);
  if (!isCardPng(bytes)) return Response.json({ error: "올바른 카드 PNG 이미지가 아닙니다." }, { status: 400 });
  const stored = cardImageStore.put(bytes, cardImageFilename(new URL(request.url).searchParams.get("filename")));
  if (!stored) return Response.json({ error: "잠시 후 다시 저장해주세요." }, { status: 503, headers: { "Retry-After": "60" } });
  return Response.json({ url: `/api/card-images/${stored.id}/image.png`, expiresAt: stored.expiresAt }, { headers: { "Cache-Control": "no-store" } });
}
