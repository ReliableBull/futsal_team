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

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images|.*\\..*).*)"]
};
