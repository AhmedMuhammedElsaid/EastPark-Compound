import type { NextConfig } from "next";
import { resolve } from "node:path";

// Public origin of the Supabase Storage bucket that serves uploaded images (avatars, feedback
// attachments, shop photos). Build-time env; when unset the CSP falls back to any https: image host.
const storageOrigin = process.env.NEXT_PUBLIC_STORAGE_ORIGIN
  ? new URL(process.env.NEXT_PUBLIC_STORAGE_ORIGIN).origin
  : "";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    root: resolve(process.cwd(), "../.."),
  },
  async redirects() {
    // Public self-registration was removed: residents join through the unit-registration request,
    // admin approval and an emailed invitation. Old links land on the supported entry points.
    return [
      { source: "/register", destination: "/register-unit", permanent: true },
      { source: "/verify-otp", destination: "/login", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          ...(process.env.NODE_ENV === "production"
            ? [
                {
                  key: "Content-Security-Policy",
                  value: [
                    "default-src 'self'",
                    "base-uri 'self'",
                    "font-src 'self'",
                    "form-action 'self'",
                    "frame-ancestors 'none'",
                    "frame-src 'none'",
                    `img-src 'self' data: blob: ${storageOrigin || "https:"}`,
                    "object-src 'none'",
                    "script-src 'self' 'unsafe-inline'",
                    "style-src 'self' 'unsafe-inline'",
                    "connect-src 'self'",
                    "upgrade-insecure-requests",
                  ].join("; "),
                },
              ]
            : []),
        ],
      },
      {
        // Backstop for every BFF route: responses are per-user and must never be stored. Handlers
        // that matter (session, shared relay/error helpers) also set this explicitly.
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
    ];
  },
};

export default nextConfig;
