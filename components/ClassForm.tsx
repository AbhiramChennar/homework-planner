"use client";

// Add/edit form for a class: name, optional short name (for quick-add), color.
import { useState } from "react";
import { CLASS_COLORS, normalizeShortName, suggestShortName } from "@/lib/classColors";
import type { NewClass } from "@/lib/data/store";
import type { Class } from "@/lib/types";
import { Button, Field, Input, Notice } from "./ui";

export function ClassForm({
  initial,
  otherClasses,
  submitLabel,
  onSubmit,
  onCancel,
  cancelLabel = "Cancel",
}: {
  initial?: Class;
  otherClasses: Class[]; // used to stop two classes sharing a short name
  submitLabel: string;
  onSubmit: (input: NewClass) => Promise<void>;
  onCancel?: () => void;
  cancelLabel?: string;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [shortName, setShortName] = useState(initial?.short_name ?? "");
  // Until the user types a short name themselves, keep suggesting one from the name.
  const [shortTouched, setShortTouched] = useState(Boolean(initial?.short_name));
  const [color, setColor] = useState<string>(
    initial?.color ?? CLASS_COLORS[otherClasses.length % CLASS_COLORS.length].value,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveShort = normalizeShortName(shortTouched ? shortName : suggestShortName(name));
  const clash = otherClasses.find(
    (c) => effectiveShort && c.short_name?.toLowerCase() === effectiveShort,
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (clash) {
      setError(`"${effectiveShort}" is already used by ${clash.name}. Pick another short name.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ name: name.trim(), short_name: effectiveShort || null, color });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the class.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Class name">
        <Input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="AP US History"
          autoFocus={!initial}
        />
      </Field>
      <Field label="Short name" hint="What you'll type in quick-add, like “hist essay fri 45m”.">
        <Input
          value={shortTouched ? shortName : effectiveShort}
          onChange={(e) => {
            setShortTouched(true);
            setShortName(e.target.value);
          }}
          placeholder="hist"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
      </Field>
      <fieldset>
        <legend className="mb-1 text-sm font-medium">Color</legend>
        <div className="flex flex-wrap gap-2">
          {CLASS_COLORS.map((c) => (
            <label key={c.value} className="cursor-pointer">
              <input
                type="radio"
                name="color"
                value={c.value}
                checked={color === c.value}
                onChange={() => setColor(c.value)}
                aria-label={c.name}
                className="peer sr-only"
              />
              <span
                title={c.name}
                className="block size-11 rounded-full border-4 border-transparent peer-checked:border-text peer-focus-visible:outline-2 peer-focus-visible:outline-accent"
                style={{ backgroundColor: c.value }}
              >
                <span className="sr-only">{c.name}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {error && <Notice tone="danger">{error}</Notice>}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={busy || !name.trim()} className="flex-1">
          {busy ? "Saving…" : submitLabel}
        </Button>
        {onCancel && (
          <Button onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
        )}
      </div>
    </form>
  );
}
