import type { Metadata } from "next";
import Link from "next/link";
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
      <body className="min-h-screen bg-arena-black text-slate-100">
        <header className="sticky top-0 z-50 border-b border-arena-line bg-arena-navy/95 backdrop-blur">
          <div className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
            <div className="flex items-center gap-3">
              <MobileNavMenu items={navItems} />
              <Link href="/" className="text-2xl font-black tracking-wide text-white">
                ARENA <span className="text-arena-lime">FC</span>
              </Link>
            </div>
            <nav className="hidden gap-2 sm:flex">
              {navItems.map((item) => (
                <Link key={item.href} className="rounded-md border border-arena-line px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-arena-cyan hover:text-white" href={item.href}>
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
