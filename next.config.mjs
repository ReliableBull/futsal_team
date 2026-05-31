/** @type {import('next').NextConfig} */
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const allowedOrigin = siteUrl ? new URL(siteUrl).host : undefined;

const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        "127.0.0.1:3000",
        "192.168.0.28:3000",
        ...(allowedOrigin ? [allowedOrigin] : [])
      ]
    }
  }
};

export default nextConfig;
