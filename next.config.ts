import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A pre-existing package-lock.json in the user's home directory makes Next
  // infer /Users/yan as the workspace root. Pin it to this project explicitly.
  turbopack: {
    root: __dirname,
  },
  experimental: {
    optimizePackageImports: ["three", "gsap", "framer-motion", "lucide-react"],
  },
  // mysql2 resolves native/optional deps at runtime and must not be bundled.
  serverExternalPackages: ["mysql2"],
  compress: true,
  /**
   * Required by the backend proxy at `src/app/api/v1/[...path]/route.ts`.
   *
   * By default Next 308-redirects `/api/v1/payment-receipts/` to the same path
   * without the trailing slash, and does it BEFORE the route handler runs — so
   * the proxy cannot tell the two apart and forwards the slash-less form. The
   * backend registers that endpoint as `POST /` under a `/payment-receipts`
   * prefix, i.e. `/api/v1/payment-receipts/`, and Fastify does not ignore
   * trailing slashes: the request 404s. Receipt submission fails, and the
   * symptom looks like a missing endpoint rather than a rewritten URL.
   *
   * Skipping the redirect hands the path through untouched, trailing segment
   * and all. Pages still resolve at both spellings; only the automatic redirect
   * is disabled.
   */
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
