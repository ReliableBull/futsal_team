/** @type {import('next').NextConfig} */
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const allowedOrigin = siteUrl ? new URL(siteUrl).host : undefined;

const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "22mb",
      allowedOrigins: [
        "localhost:3000",
        "127.0.0.1:3000",
        "192.168.0.28:3000",
        "futsal-db-server:3000",
        "*.tail3769e3.ts.net",
        "*.tail3769e3.ts.net:3000",
        ...(allowedOrigin ? [allowedOrigin] : [])
      ]
    }
  }
};

export default nextConfig;
