/** @type {import('next').NextConfig} */
const nextConfig = {
  // No build-time network calls. Fonts load at runtime from the stylesheet link
  // in the layout, so a blocked or slow font host can never fail a deploy.
  optimizeFonts: false,
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
};
export default nextConfig;
