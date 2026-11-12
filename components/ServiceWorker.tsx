"use client";

// Registers public/sw.js. Only in production builds: in development a cached
// page would hide your latest code changes.
import { useEffect } from "react";
import { BASE_PATH } from "@/lib/browser";

export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register(`${BASE_PATH}/sw.js`, { scope: `${BASE_PATH}/` }).catch(() => {
      // Not fatal: the app works without it, just without offline support.
    });
  }, []);
  return null;
}
