import type { NextConfig } from "next";

// The app is exported as plain static files (HTML/JS/CSS) so it can be hosted
// anywhere: GitHub Pages, Vercel, Netlify, Cloudflare Pages. That means no
// server code: pages talk to Supabase directly from the browser, and Supabase's
// row-level security (see supabase/migrations) is what protects each user's data.
//
// On GitHub Pages the site lives under /<repo-name>/, so the build sets
// NEXT_PUBLIC_BASE_PATH=/homework-planner. Locally it's empty.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  // GitHub Pages serves /login/ as /login/index.html; trailing slashes make
  // every route a folder with an index.html so refreshes and direct links work.
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
