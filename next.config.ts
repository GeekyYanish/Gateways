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
};

export default nextConfig;
