"use client";

// The quick-add bar: type "hist essay fri 45m", see what it understood as you
// type, press Enter to save. If something's missing, Enter opens the full form
// with what it did understand already filled in.
import { forwardRef, useMemo, useState } from "react";
import { DEFAULT_CLASS_COLOR } from "@/lib/classColors";
import { formatDue, formatMinutes } from "@/lib/dates";
import { parseQuickAdd, type ParsedQuickAdd } from "@/lib/parser";
import { CATEGORY_LABELS, type Class } from "@/lib/types";
import { Input } from "./ui";

export const QuickAdd = forwardRef<
  HTMLInputElement,
  {
    classes: Class[];
    now: Date;
    /** Called with a complete parse; should save it. */
    onSave: (parsed: ParsedQuickAdd & { classId: string; dueAt: Date; estimatedMinutes: number }) => Promise<void>;
    /** Called with an incomplete parse; should open the full form. */
    onIncomplete: (parsed: ParsedQuickAdd) => void;
  }
>(function QuickAdd({ classes, now, onSave, onIncomplete }, ref) {
  const [text, setText] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const parsed = useMemo(() => parseQuickAdd(text, classes, now), [text, classes, now]);
  const cls = classes.find((c) => c.id === parsed.classId);

  async function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter" || !text.trim()) return;
    e.preventDefault();
    const { classId, dueAt, estimatedMinutes } = parsed;
    // Title is optional here: "hist fri 45m" is enough, the title falls back to
    // the category or "Homework". Class, date and minutes are what the planner needs.
    if (classId && dueAt && estimatedMinutes) {
      // Clear the box immediately so you can type the next one while this one
      // saves over the network; if saving fails, put the text back.
      const typed = text;
      setText("");
      setSaveError(null);
      try {
        await onSave({ ...parsed, classId, dueAt, estimatedMinutes });
      } catch (err) {
        setText((current) => current || typed);
        setSaveError(err instanceof Error ? err.message : "Couldn't save. Try again.");
      }
    } else {
      onIncomplete(parsed);
      setText("");
    }
  }

  return (
    <div>
      <label htmlFor="quick-add" className="mb-1 block text-sm font-medium">
        Quick add <span className="font-normal text-muted">(press n)</span>
      </label>
      <Input
        id="quick-add"
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="hist essay fri 45m"
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="done"
        aria-describedby="quick-add-preview"
      />
      {saveError && <p className="mt-1 text-sm text-danger">{saveError}</p>}
      <div id="quick-add-preview" aria-live="polite" className="mt-2 flex min-h-7 flex-wrap gap-1.5 text-xs">
        {text.trim() ? (
          <>
            <Chip ok={Boolean(cls)}>
              {cls ? (
                <>
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: cls.color ?? DEFAULT_CLASS_COLOR }} />
                  {cls.name}
                </>
              ) : (
                "class?"
              )}
            </Chip>
            <Chip ok={Boolean(parsed.title)} optional>
              {parsed.title || "title"}
            </Chip>
            <Chip ok={Boolean(parsed.dueAt)}>{parsed.dueAt ? `due ${formatDue(parsed.dueAt, now)}` : "due when?"}</Chip>
            <Chip ok={Boolean(parsed.estimatedMinutes)}>
              {parsed.estimatedMinutes ? formatMinutes(parsed.estimatedMinutes) : "how long?"}
            </Chip>
            {parsed.category && <Chip ok>{CATEGORY_LABELS[parsed.category]}</Chip>}
          </>
        ) : (
          <span className="text-muted">Class, what, when, how long. Enter saves.</span>
        )}
      </div>
    </div>
  );
});

function Chip({ ok, optional, children }: { ok: boolean; optional?: boolean; children: React.ReactNode }) {
  const style = ok
    ? "bg-surface-2 text-text"
    : optional
      ? "bg-surface-2 text-muted italic"
      : "bg-warn-soft text-warn font-medium";
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${style}`}>{children}</span>;
}
