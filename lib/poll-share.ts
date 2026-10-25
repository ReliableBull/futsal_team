export function pollShareUrl(path: string, browserOrigin: string, configuredSiteUrl?: string) {
  const current = new URL(browserOrigin);
  const loopback = (host: string) => host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  if (loopback(current.hostname) && configuredSiteUrl) {
    try {
      const configured = new URL(configuredSiteUrl);
      if (["http:", "https:"].includes(configured.protocol) && !loopback(configured.hostname) && !configured.username && !configured.password) return new URL(path, configured.origin).href;
    } catch { /* Fall back to the address the member is currently using. */ }
  }
  return new URL(path, current.origin).href;
}
