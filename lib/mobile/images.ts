import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { ApiError } from "./validation";

export async function saveImage(request: Request, kind: "matches" | "players", id: number) {
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "이미지를 선택해주세요.");
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.length;
    if (size > 10 * 1024 * 1024 + 8192) { await reader.cancel(); throw new ApiError(413, "이미지는 10MB 이하로 선택해주세요."); }
    chunks.push(value);
  }
  let form: FormData;
  try { form = await new Response(Buffer.concat(chunks), { headers: { "Content-Type": request.headers.get("content-type") ?? "" } }).formData(); }
  catch { throw new ApiError(400, "multipart 이미지 요청이 올바르지 않습니다."); }
  const file = form.get("image");
  if (!file || typeof file === "string" || file.size === 0 || file.size > 10 * 1024 * 1024) throw new ApiError(400, "이미지는 10MB 이하로 선택해주세요.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? ".png" : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? ".jpg" : bytes.subarray(0,4).toString() === "RIFF" && bytes.subarray(8,12).toString() === "WEBP" ? ".webp" : null;
  if (!ext) throw new ApiError(400, "JPG, PNG, WebP 이미지만 지원합니다.");
  const dir = join(process.cwd(), "public", "uploads", kind, String(id));
  await mkdir(dir, { recursive: true });
  const name = `${randomUUID()}${ext}`;
  await writeFile(join(dir, name), bytes);
  return `/uploads/${kind}/${id}/${name}`;
}
export async function removeImage(url: string) {
  if (/^\/uploads\/(?:matches|players)\/\d+\/[\w.-]+$/.test(url)) await unlink(join(process.cwd(), "public", url)).catch(() => undefined);
}
