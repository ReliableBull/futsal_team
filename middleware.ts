import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function getClientIp(request: NextRequest) {
  const headers = request.headers;
  const forwardedFor = headers.get("x-forwarded-for");

  return (
    forwardedFor?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    headers.get("true-client-ip") ||
    "unknown"
  );
}

function formatAccessTime(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Seoul"
  }).format(date);
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const ip = getClientIp(request);
  const time = formatAccessTime(new Date());

  console.log(`[access] ${time} ${ip} ${request.method} ${pathname}${search}`);

  const requestHeaders = new Headers(request.headers);
  // Tenant identity must come from the URL, never a client-supplied header.
  requestHeaders.delete("x-futsal-team");
  requestHeaders.set("x-futsal-path", pathname);
  const scoped = pathname.match(/^\/t\/([a-z0-9]+(?:-[a-z0-9]+)*)(\/.*)?$/);
  if (scoped) {
    requestHeaders.set("x-futsal-team", scoped[1]);
    // NextURL normalizes 127.0.0.1 to localhost. Preserve the actual origin so
    // this stays an internal rewrite instead of another HTTP request (which
    // would correctly strip our tenant header as untrusted input).
    const url = new URL(request.url);
    url.pathname = scoped[2] || "/";
    if (!/^\/(?:$|players(?:\/|$)|matches(?:\/|$)|polls(?:\/|$)|chemistry$|hall-of-fame$|abcd(?:\/|$)|api(?:\/|$))/.test(url.pathname)) {
      return new NextResponse("Not found", { status: 404 });
    }
    return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  }
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images/|uploads/).*)"]
};
