/* global process */
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
      : "";
    const connectSources = [
      "'self'",
      supabaseHost,
      "https://*.supabase.co",
      "https://vitals.vercel-insights.com",
    ].filter(Boolean).join(" ");
    // Dev only: React needs eval() for debugging, and Vercel Analytics loads its
    // debug script from its CDN. Production serves analytics from 'self'.
    const isDev = process.env.NODE_ENV === "development";
    const scriptSources = [
      "'self'",
      "'unsafe-inline'",
      isDev && "'unsafe-eval'",
      isDev && "https://va.vercel-scripts.com",
    ]
      .filter(Boolean)
      .join(" ");
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      `script-src ${scriptSources}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://i.scdn.co https://images.unsplash.com",
      `connect-src ${connectSources}`,
      "media-src 'self' blob:",
      "font-src 'self'",
      "upgrade-insecure-requests",
    ].join("; ");
    return [{
      source: "/(.*)",
      headers: [
        { key: "Content-Security-Policy", value: csp },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      ],
    }];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "i.scdn.co",
      },
    ],
  },
};

export default nextConfig;
