"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type NavItem = {
  href: string;
  label: string;
};

type MobileNavMenuProps = {
  items: NavItem[];
};

export function MobileNavMenu({ items }: MobileNavMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) => (href === "/" ? pathname === href : pathname.startsWith(href));

  return (
    <div className="sm:hidden">
      <button
        className="grid h-10 w-10 place-items-center rounded-md border border-arena-line bg-black/20 text-slate-200 transition hover:border-arena-cyan hover:text-white"
        type="button"
        aria-label="메뉴 열기"
        aria-expanded={isOpen}
        aria-controls="mobile-nav-drawer"
        onClick={() => setIsOpen(true)}
      >
        <span className="grid gap-1">
          <span className="block h-0.5 w-5 rounded-full bg-current" />
          <span className="block h-0.5 w-5 rounded-full bg-current" />
          <span className="block h-0.5 w-5 rounded-full bg-current" />
        </span>
      </button>

      <button
        className={`fixed inset-0 z-[60] min-h-dvh bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        type="button"
        aria-label="메뉴 닫기"
        onClick={() => setIsOpen(false)}
      />

      <aside
        id="mobile-nav-drawer"
        className={`fixed left-0 top-0 z-[70] flex h-dvh min-h-screen w-[82vw] max-w-[320px] flex-col overflow-y-auto border-r border-arena-line bg-[#101827] shadow-2xl shadow-black/70 transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-arena-line px-5 py-4">
          <Link className="text-xl font-black tracking-wide text-white" href="/" onClick={() => setIsOpen(false)}>
            ARENA <span className="text-arena-lime">FC</span>
          </Link>
          <button className="rounded-md border border-arena-line px-3 py-2 text-sm font-bold text-slate-200" type="button" onClick={() => setIsOpen(false)}>
            닫기
          </button>
        </div>

        <nav className="flex-1 bg-[#0c1220]" aria-label="모바일 탭 메뉴">
          {items.map((item) => (
            <Link
              key={item.href}
              className={`flex items-center justify-between border-b border-arena-line px-5 py-5 text-base font-bold transition ${
                isActive(item.href)
                  ? "bg-arena-lime text-arena-black shadow-lg shadow-arena-lime/15"
                  : "bg-[#121b2b] text-slate-100 hover:bg-[#1b2536] hover:text-white"
              }`}
              href={item.href}
              onClick={() => setIsOpen(false)}
            >
              <span>{item.label}</span>
              <span className={`h-2 w-2 rounded-full ${isActive(item.href) ? "bg-arena-black" : "bg-arena-cyan"}`} />
            </Link>
          ))}
        </nav>
      </aside>
    </div>
  );
}
