"use client";

// "More": account, feedback, privacy, and (for admins) the pilot dashboard.
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useData } from "@/components/DataProvider";
import { Button, Card, Field, Notice, PageTitle, Textarea } from "@/components/ui";
import { getLocalStorage } from "@/lib/browser";
import { writeDemoData } from "@/lib/data/localStore";
import { createSampleData } from "@/lib/demoData";

export default function SettingsPage() {
  const { session, signOut } = useAuth();
  const { store, reload } = useData();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    store.isAdmin().then(setIsAdmin, () => setIsAdmin(false));
  }, [store]);

  if (session.status !== "signedIn") return null;
  const demo = session.mode === "demo";

  return (
    <>
      <PageTitle>More</PageTitle>

      <div className="space-y-4">
        <Card className="space-y-3">
          <h2 className="font-semibold">Account</h2>
          <p className="text-sm text-muted">
            {demo ? "You're using the demo. Your data stays on this device." : `Signed in as ${session.email}`}
          </p>
          <Button onClick={() => void signOut()}>{demo ? "Leave demo" : "Sign out"}</Button>
        </Card>

        <FeedbackCard onSend={(message) => store.submitFeedback(message)} demo={demo} />

        {isAdmin && (
          <Card className="space-y-2">
            <h2 className="font-semibold">Pilot</h2>
            <Link
              href="/admin/"
              className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-surface-2"
            >
              Open pilot dashboard
            </Link>
          </Card>
        )}

        {demo && (
          <Card className="space-y-2">
            <h2 className="font-semibold">Demo data</h2>
            <p className="text-sm text-muted">Start over with the sample classes and homework.</p>
            <Button
              onClick={async () => {
                writeDemoData(getLocalStorage(), createSampleData(new Date()));
                await reload();
              }}
            >
              Reset demo data
            </Button>
          </Card>
        )}

        <DeleteAccountCard demo={demo} onDelete={() => store.deleteAccount()} onDeleted={signOut} />

        <section className="text-xs leading-relaxed text-muted">
          <h2 className="mb-1 font-semibold">Privacy</h2>
          <p>
            We store only your email, the classes and assignments you add, and the times you log. We never sell or
            share it. Time estimates are improved using anonymized data (no names, emails, titles or descriptions).
            You can delete your account and all your data below at any time.
          </p>
        </section>
      </div>
    </>
  );
}

function FeedbackCard({ onSend, demo }: { onSend: (message: string) => Promise<void>; demo: boolean }) {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  return (
    <Card>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!message.trim()) return;
          setStatus("sending");
          try {
            await onSend(message.trim());
            setMessage("");
            setStatus("sent");
          } catch {
            setStatus("error");
          }
        }}
      >
        <h2 className="font-semibold">Feedback</h2>
        <Field label="What's annoying, confusing, or missing?" hint={demo ? "In the demo, feedback stays on this device." : undefined}>
          <Textarea rows={3} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} />
        </Field>
        <Button type="submit" disabled={!message.trim() || status === "sending"}>
          {status === "sending" ? "Sending…" : "Send feedback"}
        </Button>
        {status === "sent" && <Notice tone="ok">Thanks! Got it.</Notice>}
        {status === "error" && <Notice tone="danger">Couldn&apos;t send. Try again?</Notice>}
      </form>
    </Card>
  );
}

function DeleteAccountCard({
  demo,
  onDelete,
  onDeleted,
}: {
  demo: boolean;
  onDelete: () => Promise<void>;
  onDeleted: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const WORD = "delete";

  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">{demo ? "Delete demo data" : "Delete my account"}</h2>
      {!confirming ? (
        <Button variant="danger" onClick={() => setConfirming(true)}>
          {demo ? "Delete demo data…" : "Delete my account and data…"}
        </Button>
      ) : (
        <div className="space-y-2">
          <p className="text-sm">
            This permanently deletes {demo ? "the demo data on this device" : "your account, classes, homework and logged times"}.
            It can&apos;t be undone. Type <strong>{WORD}</strong> to confirm.
          </p>
          <input
            className="min-h-11 w-full rounded-lg border border-border bg-surface px-3"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            aria-label={`Type ${WORD} to confirm`}
            autoCapitalize="none"
          />
          <div className="flex gap-2">
            <Button
              variant="danger"
              disabled={typed.trim().toLowerCase() !== WORD}
              onClick={async () => {
                try {
                  await onDelete();
                  await onDeleted();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Couldn't delete. Try again.");
                }
              }}
            >
              Delete forever
            </Button>
            <Button onClick={() => setConfirming(false)}>Cancel</Button>
          </div>
          {error && <Notice tone="danger">{error}</Notice>}
        </div>
      )}
    </Card>
  );
}
