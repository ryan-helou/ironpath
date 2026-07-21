import type { NextConfig } from "next";
import path from "node:path";

const root = path.resolve(process.cwd());

const nextConfig: NextConfig = {
  // pin the workspace root to this project (a stray lockfile in $HOME otherwise
  // confuses Turbopack's root inference)
  turbopack: { root },
  outputFileTracingRoot: root,
};

export default nextConfig;
