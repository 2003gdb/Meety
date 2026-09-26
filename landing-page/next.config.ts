import path from "node:path";
import type { NextConfig } from "next";

// Repo root, so the app can import ../tavily-research (see src/lib/research.ts).
const repoRoot = path.join(__dirname, "..");

const nextConfig: NextConfig = {
  turbopack: { root: repoRoot },
  outputFileTracingRoot: repoRoot,
};

export default nextConfig;
