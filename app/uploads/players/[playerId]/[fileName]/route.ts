import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { NextResponse } from "next/server";

const contentTypes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp"
};

function isSafePathSegment(value: string) {
  return value.length > 0 && !value.includes("/") && !value.includes("\\") && !value.includes("..");
}

export async function GET(_request: Request, { params }: { params: { playerId: string; fileName: string } }) {
  if (!/^\d+$/.test(params.playerId) || !isSafePathSegment(params.fileName)) {
    return NextResponse.json({ error: "Invalid upload path" }, { status: 400 });
  }

  const ext = extname(params.fileName).toLowerCase();
  const contentType = contentTypes[ext];
  if (!contentType) {
    return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
  }

  try {
    const filePath = join(process.cwd(), "public", "uploads", "players", params.playerId, params.fileName);
    const file = await readFile(filePath);

    return new Response(file, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": contentType
      }
    });
  } catch {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }
}
