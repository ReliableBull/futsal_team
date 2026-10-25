export const legacyTeamSlug = "arena-fc";
export const teamSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function teamPath(basePath: string, path: string) {
  if (!basePath || !path.startsWith("/") || path.startsWith("//")) return path;
  if (/^\/(?:t|teams|venues|bookings|login|images|uploads|_next)(?:\/|\?|$)/.test(path)) return path;
  return `${basePath}${path === "/" ? "" : path}`;
}

export function isPlatformPath(pathname: string) {
  return pathname === "/" || /^\/(teams|venues|bookings|login)(\/|$)/.test(pathname);
}
