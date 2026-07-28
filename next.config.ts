import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the dev server's client resources (HMR, chunks) to load when the app
  // is reached through an ngrok tunnel. Without this, Next.js blocks the
  // cross-origin dev requests and client components never hydrate.
  allowedDevOrigins: ["*.ngrok-free.dev", "dweeb-unnoticed-gaming.ngrok-free.dev"],
};

export default nextConfig;
