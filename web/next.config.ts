import type { NextConfig } from "next";

// FastAPI's address. Unset in development means "no backend yet": the app
// runs against the MSW mocks in src/mocks/ instead (docs/api-contract.md).
const apiUrl = process.env.API_URL;
const mocking = !apiUrl && process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  env: { NEXT_PUBLIC_API_MOCKING: mocking ? "enabled" : "" },
  // Same-origin proxy to FastAPI, so the session cookie needs no CORS (ADR 0001).
  async rewrites() {
    return apiUrl ? [{ source: "/api/:path*", destination: `${apiUrl}/:path*` }] : [];
  },
  async redirects() {
    return [{ source: "/", destination: "/analyse", permanent: false }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
