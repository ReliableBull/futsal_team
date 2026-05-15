import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "ARENA Futsal Record",
  description: "Local MVP for futsal match records and player rankings"
};

const navItems = [
  { href: "/", label: "홈" },
  { href: "/players", label: "선수" },
  { href: "/matches", label: "경기" },
  { href: "/admin", label: "관리자" }
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-arena-black text-slate-100">
        <header className="border-b border-arena-line bg-arena-navy/95">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/" className="text-2xl font-black tracking-wide text-white">
              ARENA <span className="text-arena-lime">Futsal</span> Record
            </Link>
            <nav className="flex flex-wrap gap-2">
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
