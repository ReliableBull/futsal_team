import type { Metadata } from "next";
import Link from "next/link";
import { DesktopNav } from "@/components/DesktopNav";
import { MobileNavMenu } from "@/components/MobileNavMenu";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const ogImageUrl = new URL("/images/arena-team.jpg", siteUrl).toString();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "ARENA FC",
  description: "함께 뛰는 시간, 하나가 되는 ARENA FC",
  openGraph: {
    title: "ARENA FC",
    description: "함께 뛰는 시간, 하나가 되는 ARENA FC",
    url: siteUrl,
    siteName: "ARENA FC",
    type: "website",
    images: [
      {
        url: ogImageUrl,
        width: 1200,
        height: 630,
        alt: "ARENA FC team group photo"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "ARENA FC",
    description: "함께 뛰는 시간, 하나가 되는 ARENA FC",
    images: [ogImageUrl]
  }
};

const navItems = [
  { href: "/", label: "홈" },
  { href: "/players", label: "선수목록" },
  { href: "/matches", label: "경기결과" }
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="arena-light min-h-screen bg-[#f4f6f8] text-slate-900">
        <header className="sticky top-0 z-50 border-b border-arena-line bg-arena-navy/95 shadow-sm backdrop-blur-md">
          <div className="relative mx-auto flex min-h-16 max-w-[1480px] items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <MobileNavMenu items={navItems} />
              <Link href="/" className="group flex items-center gap-2.5 text-xl font-black text-white sm:text-2xl">
                <span className="grid h-8 w-8 -skew-x-6 place-items-center border-2 border-arena-red text-base font-black text-arena-red transition group-hover:bg-arena-red group-hover:text-white">
                  A
                </span>
                <span className="italic">ARENA FC</span>
              </Link>
            </div>
            <DesktopNav items={navItems} />
            <span className="hidden border border-arena-line bg-white/[0.03] px-3 py-2 text-xs font-bold text-slate-500 lg:block">
              2026 SEASON RECORD
            </span>
          </div>
        </header>
        <main className="mx-auto max-w-[1480px] px-4 py-5 sm:px-6 sm:py-7">{children}</main>
      </body>
    </html>
  );
}
