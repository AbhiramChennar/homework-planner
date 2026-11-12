// Small helpers for browser-only things.

/** "" locally, "/homework-planner" on GitHub Pages (see next.config.ts). */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * localStorage, or an in-memory stand-in when it's unavailable (private
 * browsing on some browsers, or storage blocked by a school's device policy).
 * The app keeps working; demo data just won't survive a reload.
 */
export function getLocalStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  try {
    const probe = "__hp_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    const memory = new Map<string, string>();
    return {
      getItem: (k) => memory.get(k) ?? null,
      setItem: (k, v) => void memory.set(k, v),
      removeItem: (k) => void memory.delete(k),
    };
  }
}
