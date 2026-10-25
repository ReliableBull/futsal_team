import { NextResponse } from "next/server";
import { getHallOfFameData, hallOfFameCategoryKeys, type HallOfFameCategoryKey } from "@/lib/hall-of-fame";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const hallOfFame = await getHallOfFameData();
    const records = Object.fromEntries(
      hallOfFameCategoryKeys.map((key) => [key, hallOfFame.categories.find((category) => category.key === key)?.entries ?? []])
    ) as Record<HallOfFameCategoryKey, (typeof hallOfFame.categories)[number]["entries"]>;

    return NextResponse.json({ hallOfFame, ...records });
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error && error.digest === "NEXT_NOT_FOUND") return NextResponse.json({ error: "팀을 찾을 수 없습니다." }, { status: 404 });
    console.error("[hall-of-fame] 집계에 실패했습니다.", error);

    return NextResponse.json({ error: "명예의 전당 기록을 불러올 수 없습니다." }, { status: 500 });
  }
}
