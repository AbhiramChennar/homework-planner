"use client";

import { useState } from "react";
import { ClassForm } from "@/components/ClassForm";
import { useData } from "@/components/DataProvider";
import { Button, Card, Notice, PageTitle, Spinner } from "@/components/ui";
import { DEFAULT_CLASS_COLOR } from "@/lib/classColors";
import { ClassInUseError } from "@/lib/data/store";
import type { Class } from "@/lib/types";

export default function ClassesPage() {
  const { classes, assignments, loading, error, addClass, editClass, removeClass } = useData();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (loading) return <Spinner />;

  const countFor = (id: string) => assignments.filter((a) => a.class_id === id).length;
  const others = (id?: string) => classes.filter((c) => c.id !== id);

  async function confirmDelete(c: Class) {
    try {
      await removeClass(c.id);
      setMessage(`Deleted ${c.name}.`);
    } catch (e) {
      setMessage(e instanceof ClassInUseError ? e.message : "Couldn't delete the class.");
    }
    setConfirmingId(null);
  }

  const showAddForm = adding || classes.length === 0;

  return (
    <>
      <PageTitle
        action={
          !showAddForm && (
            <Button variant="primary" onClick={() => setAdding(true)}>
              Add class
            </Button>
          )
        }
      >
        Classes
      </PageTitle>

      {error && <Notice tone="danger">{error}</Notice>}

      {classes.length === 0 && (
        <div className="mb-4">
          <Notice>
            <strong>Welcome!</strong> Start by adding the classes you&apos;re taking. Give each a short name
            (like “hist”) so you can add homework fast later.
          </Notice>
        </div>
      )}

      {showAddForm && (
        <Card className="mb-4">
          <h2 className="mb-3 font-medium">New class</h2>
          <ClassForm
            key={classes.length /* fresh form after each add */}
            otherClasses={classes}
            submitLabel="Add class"
            onSubmit={async (input) => {
              await addClass(input);
              // Keep the form open: students usually add several classes in a row.
              setAdding(true);
              setMessage(`Added ${input.name}. Add another, or press Done.`);
            }}
            onCancel={
              classes.length > 0
                ? () => {
                    setAdding(false);
                    setMessage(null);
                  }
                : undefined
            }
            cancelLabel="Done"
          />
        </Card>
      )}

      {message && (
        <div className="mb-3">
          <Notice tone="ok">{message}</Notice>
        </div>
      )}

      <ul className="space-y-2">
        {classes.map((c) => {
          const count = countFor(c.id);
          if (editingId === c.id) {
            return (
              <li key={c.id}>
                <Card>
                  <ClassForm
                    initial={c}
                    otherClasses={others(c.id)}
                    submitLabel="Save"
                    onSubmit={async (input) => {
                      await editClass(c.id, input);
                      setEditingId(null);
                      setMessage(`Saved ${input.name}.`);
                    }}
                    onCancel={() => setEditingId(null)}
                  />
                </Card>
              </li>
            );
          }
          return (
            <li key={c.id}>
              <Card className="space-y-3">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="size-4 shrink-0 rounded-full"
                    style={{ backgroundColor: c.color ?? DEFAULT_CLASS_COLOR }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="text-sm text-muted">
                      {c.short_name ? <code className="font-mono">{c.short_name}</code> : "no short name"}
                      {" · "}
                      {count === 1 ? "1 assignment" : `${count} assignments`}
                    </p>
                  </div>
                </div>

                {confirmingId === c.id ? (
                  count > 0 ? (
                    <div className="space-y-2">
                      <Notice tone="warn">
                        {c.name} still has {count === 1 ? "an assignment" : `${count} assignments`}. Delete or
                        move {count === 1 ? "it" : "them"} first.
                      </Notice>
                      <Button onClick={() => setConfirmingId(null)}>OK</Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm">Delete {c.name}?</span>
                      <Button variant="danger" onClick={() => void confirmDelete(c)}>
                        Delete
                      </Button>
                      <Button onClick={() => setConfirmingId(null)}>Cancel</Button>
                    </div>
                  )
                ) : (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        setEditingId(c.id);
                        setMessage(null);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setConfirmingId(c.id);
                        setMessage(null);
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </Card>
            </li>
          );
        })}
      </ul>
    </>
  );
}
