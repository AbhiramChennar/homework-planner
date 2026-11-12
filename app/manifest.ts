// The web app manifest: what makes "Add to Home Screen" install the app with
// its own icon and no browser bars. Generated as a static file at build time.
import type { MetadataRoute } from "next";
import { BASE_PATH } from "@/lib/browser";

export const dynamic = "force-static"; // required for static export

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Homework Planner",
    short_name: "Homework",
    description: "Plans your homework into the time you have and learns how long it really takes.",
    start_url: `${BASE_PATH}/`,
    scope: `${BASE_PATH}/`,
    display: "standalone",
    background_color: "#f6f7f9",
    theme_color: "#3b5bdb",
    categories: ["education", "productivity"],
    icons: [
      { src: `${BASE_PATH}/icons/icon-192.png`, sizes: "192x192", type: "image/png" },
      { src: `${BASE_PATH}/icons/icon-512.png`, sizes: "512x512", type: "image/png" },
      { src: `${BASE_PATH}/icons/maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
