import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  outputFileTracingIncludes: { "/api/issp/export": ["./assets/fonts/*.ttf"] },
};
export default config;
