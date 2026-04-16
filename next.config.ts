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

export default nextConfig;
