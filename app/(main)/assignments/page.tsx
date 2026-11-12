"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AssignmentCard } from "@/components/AssignmentCard";
import { AssignmentForm, type AssignmentFormResult, type AssignmentFormValues } from "@/components/AssignmentForm";
import { useData } from "@/components/DataProvider";
import { Dialog } from "@/components/Dialog";
import { QuickAdd } from "@/components/QuickAdd";
import { Button, Notice, PageTitle, Spinner } from "@/components/ui";
import { useNow } from "@/components/useNow";
import { DUE_GROUP_LABELS, dueGroup, formatDue, type DueGroup } from "@/lib/dates";
import type { ParsedQuickAdd, QuickAddField } from "@/lib/parser";
import { CATEGORY_LABELS, type Assignment } from "@/lib/types";

type DialogState =
  | { kind: "closed" }
  | { kind: "add"; initial: AssignmentFormValues; highlight: QuickAddField[] }
  | { kind: "edit"; assignment: Assignment };

const EMPTY_FORM: AssignmentFormValues = {
  classId: "",
  title: "",
  description: "",
  category: "",
  dueAt: null,
  estimatedMinutes: null,
};

const GROUP_ORDER: DueGroup[] = ["overdue", "today", "tomorrow", "thisWeek", "later"];

export default function AssignmentsPage() {
  const { classes, assignments, loading, error, addAssignment, editAssignment, removeAssignment } = useData();
  const now = useNow();
  const quickAddRef = useRef<HTMLInputElement>(null);
  const [dialog, setDialog] = useState<DialogState>({ kind: "closed" });
  const [toast, setToast] = useState<string | null>(null);

  // Keyboard shortcut: "n" jumps to quick-add (unless you're already typing somewhere).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "n" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable], dialog")) return;
      e.preventDefault();
      quickAddRef.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Toast messages disappear on their own after a few seconds.
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  const groups = useMemo(() => {
    const result = new Map<DueGroup, Assignment[]>();
    const todo = assignments
      .filter((a) => a.status === "todo")
      .sort((a, b) => a.due_at.localeCompare(b.due_at));
    for (const a of todo) {
      const g = dueGroup(new Date(a.due_at), now);
      result.set(g, [...(result.get(g) ?? []), a]);
    }
    return result;
  }, [assignments, now]);

  if (loading) return <Spinner />;

  const classById = new Map(classes.map((c) => [c.id, c]));

  async function save(values: AssignmentFormResult) {
    const row = await addAssignment({ ...values, predicted_minutes: null });
    const cls = classById.get(row.class_id);
    setToast(`Added “${row.title}” for ${cls?.name ?? "class"}, due ${formatDue(new Date(row.due_at), now)}.`);
  }

  async function saveQuickAdd(p: ParsedQuickAdd & { classId: string; dueAt: Date; estimatedMinutes: number }) {
    await save({
      class_id: p.classId,
      title: p.title || (p.category ? CATEGORY_LABELS[p.category] : "Homework"),
      description: null,
      category: p.category,
      due_at: p.dueAt.toISOString(),
      estimated_minutes: p.estimatedMinutes,
    });
  }

  function openIncomplete(p: ParsedQuickAdd) {
    setDialog({
      kind: "add",
      initial: {
        classId: p.classId ?? "",
        title: p.title,
        description: "",
        category: p.category ?? "",
        dueAt: p.dueAt,
        estimatedMinutes: p.estimatedMinutes,
      },
      highlight: p.missing,
    });
  }

  const close = () => {
    setDialog({ kind: "closed" });
  };
  const todoCount = [...groups.values()].reduce((n, g) => n + g.length, 0);

  return (
    <>
      <PageTitle
        action={
          <Button onClick={() => setDialog({ kind: "add", initial: EMPTY_FORM, highlight: [] })}>
            Add assignment
          </Button>
        }
      >
        Homework
      </PageTitle>

      {error && <Notice tone="danger">{error}</Notice>}

      <QuickAdd ref={quickAddRef} classes={classes} now={now} onSave={saveQuickAdd} onIncomplete={openIncomplete} />

      {toast && (
        <div className="mt-2">
          <Notice tone="ok">{toast}</Notice>
        </div>
      )}

      {todoCount === 0 ? (
        <p className="mt-8 text-center text-muted">
          Nothing to do. Add homework with quick add above, like <code className="font-mono">hist essay fri 45m</code>.
        </p>
      ) : (
        GROUP_ORDER.filter((g) => groups.has(g)).map((g) => (
          <section key={g} className="mt-6">
            <h2 className={`mb-2 text-sm font-semibold ${g === "overdue" ? "text-danger" : "text-muted"}`}>
              {DUE_GROUP_LABELS[g]} <span className="font-normal">({groups.get(g)!.length})</span>
            </h2>
            <ul className="space-y-2">
              {groups.get(g)!.map((a) => (
                <li key={a.id}>
                  <AssignmentCard
                    assignment={a}
                    cls={classById.get(a.class_id)}
                    now={now}
                    onOpen={() => setDialog({ kind: "edit", assignment: a })}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <Dialog
        open={dialog.kind !== "closed"}
        onClose={close}
        title={dialog.kind === "edit" ? "Edit assignment" : "Add assignment"}
      >
        {dialog.kind === "add" && (
          <AssignmentForm
            classes={classes}
            initial={dialog.initial}
            highlight={dialog.highlight}
            submitLabel="Add"
            onSubmit={async (values) => {
              await save(values);
              close();
              quickAddRef.current?.focus();
            }}
          />
        )}
        {dialog.kind === "edit" && (
          <AssignmentForm
            classes={classes}
            initial={{
              classId: dialog.assignment.class_id,
              title: dialog.assignment.title,
              description: dialog.assignment.description ?? "",
              category: dialog.assignment.category ?? "",
              dueAt: new Date(dialog.assignment.due_at),
              estimatedMinutes: dialog.assignment.estimated_minutes,
            }}
            submitLabel="Save"
            onSubmit={async (values) => {
              await editAssignment(dialog.assignment.id, values);
              close();
              setToast("Saved.");
            }}
            onDelete={async () => {
              await removeAssignment(dialog.assignment.id);
              close();
              setToast(`Deleted “${dialog.assignment.title}”.`);
            }}
          />
        )}
      </Dialog>
    </>
  );
}
