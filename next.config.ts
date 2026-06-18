import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.GITHUB_PAGES === "true"
    ? {
        output: "export",
        basePath: "/typeracer-stats",
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
