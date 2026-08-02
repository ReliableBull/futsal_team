"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
};

export function DesktopNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="hidden h-full items-stretch sm:flex" aria-label="주요 메뉴">
      {items.map((item) => {
        const isActive = item.href === "/" ? pathname === item.href : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            className={`relative flex min-h-16 items-center px-5 text-sm font-black transition after:absolute after:inset-x-4 after:bottom-0 after:h-0.5 after:origin-left after:bg-arena-red after:transition-transform ${
              isActive
                ? "text-white after:scale-x-100"
                : "text-slate-400 after:scale-x-0 hover:text-white hover:after:scale-x-100"
            }`}
            href={item.href}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
