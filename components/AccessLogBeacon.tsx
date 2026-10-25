"use client";
import { useTeamPath } from "@/components/TeamProvider";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/** Records one access log entry per page view, including client-side navigations. */
export function AccessLogBeacon() {
  const scopedPath = useTeamPath();
  const pathname = usePathname();
  const endpoint = scopedPath("/api/access-log");
  const previousUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    const path = `${window.location.pathname}${window.location.search}`;
    if (previousUrl.current === path) return;

    // The first view keeps the external referrer; later views point at the previous page.
    const referrer = previousUrl.current ? `${window.location.origin}${previousUrl.current}` : document.referrer;
    previousUrl.current = path;

    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, referrer }),
      keepalive: true
    }).catch(() => {});
  }, [pathname, endpoint]);

  return null;
}
