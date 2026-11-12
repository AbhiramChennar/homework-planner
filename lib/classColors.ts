// The 8 preset class colors. Each has a name so screen readers can announce it
// (a color swatch alone means nothing to someone who can't see it).
export const CLASS_COLORS = [
  { value: "#dc2626", name: "Red" },
  { value: "#ea580c", name: "Orange" },
  { value: "#ca8a04", name: "Gold" },
  { value: "#16a34a", name: "Green" },
  { value: "#0d9488", name: "Teal" },
  { value: "#2563eb", name: "Blue" },
  { value: "#9333ea", name: "Purple" },
  { value: "#db2777", name: "Pink" },
] as const;

export const DEFAULT_CLASS_COLOR = "#6b7280"; // gray, for classes without a color

/** Suggests a quick-add short name from a class name: "AP US History" → "hist". */
export function suggestShortName(name: string): string {
  // Skip prefixes that many classes share, so they don't all become "ap" or "hon".
  const skip = new Set(["ap", "ib", "honors", "hon", "intro", "advanced", "adv", "us", "the", "to", "of"]);
  const words = name.toLowerCase().match(/[a-z]+/g) ?? [];
  const word = words.find((w) => !skip.has(w)) ?? words[0] ?? "";
  return word.slice(0, 4);
}

/** Short names are typed in quick-add, so keep them to one simple lowercase word. */
export function normalizeShortName(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, "");
}
