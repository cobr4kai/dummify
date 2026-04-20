import type { NextConfig } from "next";

const distDir = process.env.NEXT_DIST_DIR?.trim();

const nextConfig: NextConfig = {
  distDir: distDir && distDir.length > 0 ? distDir : ".paperbrief-build",
  serverExternalPackages: ["@prisma/client", "prisma"],
};

export default nextConfig;
