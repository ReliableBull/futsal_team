export function isStandaloneVotePath(pathname: string) {
  return /^\/vote\/[a-zA-Z0-9_-]+\/?$/.test(pathname);
}
