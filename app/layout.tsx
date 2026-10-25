import type { Metadata } from "next";
import { headers } from "next/headers";
import { getCurrentTeam, getTeamBasePath, isLegacyMode } from "@/lib/teams";
import "./globals.css";
import { isPlatformPath } from "@/lib/team-paths";
import { isStandaloneVotePath } from "@/lib/poll-paths";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const pathname = headers().get("x-futsal-path") || "/";
  if (isLegacyMode() && isStandaloneVotePath(pathname)) return {
    title: "투표 참여", description: "이름을 입력하고 투표에 참여해주세요. 제출 후 변경할 수 없습니다.",
    robots: { index: false, follow: false },
    openGraph: { title: "투표 참여", description: "로그인 없이 이름으로 참여하는 투표입니다.", images: [] },
    twitter: { card: "summary", title: "투표 참여", images: [] }
  };
  const platform = !isLegacyMode() && !getTeamBasePath() && isPlatformPath(pathname);
  const team = platform ? null : await getCurrentTeam();
  const title = team?.name || "ARENA · 축구와 풋살, 함께 뛰는 시작";
  const description = team?.description || "축구·풋살 동호회를 찾고, 함께 뛸 구장을 둘러보세요. 동호회 운영과 경기 기록까지 ARENA에서.";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const images = team?.slug === "arena-fc" ? [{ url: "/images/arena-team.jpg", width: 1200, height: 630, alt: team.name }] : [];
  return { metadataBase: new URL(siteUrl), title, description, openGraph: { title, description, siteName: title, type: "website", images }, twitter: { card: images.length ? "summary_large_image" : "summary", title, description, images: images.map(image => image.url) } };
}
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ko"><body className="arena-light min-h-screen bg-[#f4f6f8] text-slate-900">{children}</body></html>;
}
