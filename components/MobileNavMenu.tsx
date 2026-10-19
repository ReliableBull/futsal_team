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
  const pathname = usePathname() ?? "";

  const isActive = (href: string) => (href === "/" ? pathname === href : pathname.startsWith(href));

  return (
    <div className="md:hidden">
      <button
        className="grid h-10 w-10 place-items-center border border-arena-line bg-black/30 text-slate-200 transition hover:border-arena-red hover:text-white"
        type="button"
        aria-label="메뉴 열기"
        aria-expanded={isOpen}
        aria-controls="mobile-nav-drawer"
        onClick={() => setIsOpen(true)}
      >
        <span className="grid gap-1">
          <span className="block h-0.5 w-5 bg-current" />
          <span className="block h-0.5 w-5 bg-current" />
          <span className="block h-0.5 w-5 bg-current" />
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
        className={`arena-dark fixed left-0 top-0 z-[70] flex h-dvh min-h-screen w-[82vw] max-w-[320px] flex-col overflow-y-auto border-r border-arena-line bg-[#0c0e10] shadow-2xl shadow-black/70 transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-arena-line px-5 py-4">
          <Link className="flex items-center gap-2 text-xl font-black italic text-white" href="/" onClick={() => setIsOpen(false)}>
            <span className="grid h-7 w-7 -skew-x-6 place-items-center border-2 border-arena-red text-sm text-arena-red">A</span>
            ARENA FC
          </Link>
          <button className="grid h-9 w-9 place-items-center border border-arena-line text-xl font-bold text-slate-300" aria-label="메뉴 닫기" type="button" onClick={() => setIsOpen(false)}>
            ×
          </button>
        </div>

        <nav className="flex-1 bg-[#090b0c]" aria-label="모바일 탭 메뉴">
          {items.map((item) => (
            <Link
              key={item.href}
              className={`flex items-center justify-between border-b border-arena-line px-5 py-5 text-base font-black transition ${
                isActive(item.href)
                  ? "border-l-4 border-l-arena-red bg-[#17191b] text-white"
                  : "border-l-4 border-l-transparent bg-[#0f1113] text-slate-400 hover:bg-[#17191b] hover:text-white"
              }`}
              href={item.href}
              onClick={() => setIsOpen(false)}
            >
              <span>{item.label}</span>
              <span className={`h-2 w-2 ${isActive(item.href) ? "bg-arena-red" : "bg-slate-700"}`} />
            </Link>
          ))}
        </nav>
      </aside>
    </div>
  );
}
