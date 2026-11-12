"use client";

// The full assignment form, used for "Add assignment", for finishing an
// incomplete quick-add (with the missing fields highlighted), and for editing.
import { useState } from "react";
import { fromDateInputValue, toDateInputValue } from "@/lib/dates";
import type { QuickAddField } from "@/lib/parser";
import { CATEGORIES, CATEGORY_LABELS, type Category, type Class } from "@/lib/types";
import { Button, Field, Input, Notice, Select, Textarea } from "./ui";

export interface AssignmentFormValues {
  classId: string;
  title: string;
  description: string;
  category: Category | "";
  dueAt: Date | null;
  estimatedMinutes: number | null;
}

export interface AssignmentFormResult {
  class_id: string;
  title: string;
  description: string | null;
  category: Category | null;
  due_at: string;
  estimated_minutes: number;
}

export function AssignmentForm({
  classes,
  initial,
  highlight = [],
  submitLabel,
  onSubmit,
  onDelete,
}: {
  classes: Class[];
  initial: AssignmentFormValues;
  /** Fields quick-add couldn't figure out: shown with a "needed" marker. */
  highlight?: QuickAddField[];
  submitLabel: string;
  onSubmit: (values: AssignmentFormResult) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [classId, setClassId] = useState(initial.classId);
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [category, setCategory] = useState<Category | "">(initial.category);
  const [date, setDate] = useState(initial.dueAt ? toDateInputValue(initial.dueAt) : "");
  const [minutes, setMinutes] = useState(initial.estimatedMinutes ? String(initial.estimatedMinutes) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const needs = (f: QuickAddField) => highlight.includes(f);
  const ring = (f: QuickAddField) => (needs(f) ? "border-warn ring-2 ring-warn/30" : "");
  const label = (text: string, f: QuickAddField) => (needs(f) ? `${text} (needed)` : text);
  // The dialog focuses the element marked data-autofocus: the first missing field.
  const firstNeeded = (["class", "title", "dueAt", "estimatedMinutes"] as const).find(needs);
  const focusIf = (f: QuickAddField) => (firstNeeded === f ? { "data-autofocus": true } : {});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    let dueAt = fromDateInputValue(date);
    const mins = parseInt(minutes, 10);
    if (!classId || !title.trim() || !dueAt || !(mins > 0)) {
      setError("Fill in the class, title, due date and minutes.");
      return;
    }
    // Editing an assignment due at a specific time (not 11:59pm): keep that time.
    if (initial.dueAt) {
      dueAt = new Date(dueAt);
      dueAt.setHours(initial.dueAt.getHours(), initial.dueAt.getMinutes(), 0, 0);
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        class_id: classId,
        title: title.trim(),
        description: description.trim() || null,
        category: category || null,
        due_at: dueAt.toISOString(),
        estimated_minutes: mins,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label={label("Class", "class")}>
        <Select value={classId} onChange={(e) => setClassId(e.target.value)} className={ring("class")} required {...focusIf("class")}>
          <option value="">Choose a class…</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={label("What", "title")}>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="DBQ essay"
          className={ring("title")}
          required
          {...focusIf("title")}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={label("Due", "dueAt")}>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={ring("dueAt")} required {...focusIf("dueAt")} />
        </Field>
        <Field label={label("Minutes", "estimatedMinutes")} hint="Your best guess">
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={1440}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder="45"
            className={ring("estimatedMinutes")}
            required
            {...focusIf("estimatedMinutes")}
          />
        </Field>
      </div>
      <Field label="Type">
        <Select value={category} onChange={(e) => setCategory(e.target.value as Category | "")}>
          <option value="">Not sure</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Description (optional)" hint="A few words help the app learn which work takes longer.">
        <Textarea rows={2} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>

      {error && <Notice tone="danger">{error}</Notice>}

      <Button type="submit" variant="primary" className="w-full" disabled={busy}>
        {busy ? "Saving…" : submitLabel}
      </Button>

      {onDelete &&
        (confirmDelete ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm">Delete this assignment?</span>
            <Button variant="danger" onClick={() => void onDelete()}>
              Delete
            </Button>
            <Button onClick={() => setConfirmDelete(false)}>Cancel</Button>
          </div>
        ) : (
          <Button variant="ghost" className="w-full" onClick={() => setConfirmDelete(true)}>
            Delete assignment
          </Button>
        ))}
    </form>
  );
}
