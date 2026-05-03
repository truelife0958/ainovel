import withBundleAnalyzerFactory from "@next/bundle-analyzer";

if (process.env.ANALYZE === "1" && !process.env.NEXT_USE_WEBPACK) {
  // eslint-disable-next-line no-console
  console.warn(
    "\n⚠ ANALYZE=1 set but Next 16 default Turbopack ignores @next/bundle-analyzer.\n" +
    "  Run `next build --webpack` (or unset NEXT_TURBOPACK / set NEXT_USE_WEBPACK=1) to actually generate analyzer reports under .next/analyze/.\n",
  );
}

const nextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  outputFileTracingRoot: __dirname,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async redirects() {
    return [
      { source: "/dashboard", destination: "/", permanent: true },
      { source: "/settings", destination: "/", permanent: true },
      { source: "/library", destination: "/", permanent: true },
      { source: "/outline", destination: "/", permanent: true },
      { source: "/writing", destination: "/", permanent: true },
      { source: "/workspace", destination: "/", permanent: true },
      { source: "/ideation", destination: "/", permanent: true },
      { source: "/review", destination: "/", permanent: true },
      { source: "/projects", destination: "/", permanent: true },
      { source: "/connection", destination: "/", permanent: true },
    ];
  },
};

const withBundleAnalyzer = withBundleAnalyzerFactory({
  enabled: process.env.ANALYZE === "1",
  openAnalyzer: false,
});

export default withBundleAnalyzer(nextConfig);
