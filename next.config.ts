import type { NextConfig } from "next";
import { readFileSync } from "fs";
const pkg = JSON.parse(readFileSync("./package.json", "utf8"));

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
  ...(process.env.GITHUB_PAGES === "true"
    ? {
        output: "export",
        basePath: "/typeracer-stats",
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
