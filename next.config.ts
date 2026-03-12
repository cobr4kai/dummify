import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: ".paperbrief-build",
  serverExternalPackages: ["@prisma/client", "prisma"],
};

export default nextConfig;
