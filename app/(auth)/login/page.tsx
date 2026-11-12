"use client";

// Magic-link login: type your email, get a link (and a 6-digit code).
//
// Why offer the code too: on iPhones, an app added to the home screen has its
// own separate storage, so tapping the email link signs you in to Safari, not
// the home-screen app. Typing the code signs in wherever you typed it. The code
// only appears in the email once the Supabase email template includes it
// (see SETUP.md).
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Button, Card, Field, Input, Notice } from "@/components/ui";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { BASE_PATH } from "@/lib/browser";

export default function LoginPage() {
  const { session, startDemo } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session.status === "signedIn") router.replace("/");
  }, [session.status, router]);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await getSupabase().auth.signInWithOtp({
      email: email.trim(),
      // Where the link sends people back to: this site's home page.
      options: { emailRedirectTo: `${window.location.origin}${BASE_PATH}/` },
    });
    setBusy(false);
    if (error) setError(friendlyError(error.message));
    else setSentTo(email.trim());
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!sentTo) return;
    setBusy(true);
    setError(null);
    const { error } = await getSupabase().auth.verifyOtp({ email: sentTo, token: code.trim(), type: "email" });
    setBusy(false);
    // On success AuthProvider sees the new session and the effect above redirects.
    if (error) setError("That code didn't work. Check it, or request a new link.");
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-semibold">Homework Planner</h1>
      <p className="mt-1 text-muted">
        Plans your homework into the time you have, and learns how long your work really takes.
      </p>

      {isSupabaseConfigured && (
        <Card className="mt-6 space-y-4">
          {!sentTo ? (
            <form onSubmit={sendLink} className="space-y-3">
              <Field label="Email">
                <Input
                  type="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@school.org"
                />
              </Field>
              <Button type="submit" variant="primary" className="w-full" disabled={busy}>
                {busy ? "Sending…" : "Send link"}
              </Button>
            </form>
          ) : (
            <>
              <Notice tone="ok">
                Check your email at <strong>{sentTo}</strong>. Tap the link to sign in (look in spam if it isn&apos;t
                there in a minute).
              </Notice>
              <form onSubmit={verifyCode} className="space-y-3">
                <Field label="Or type the code from the email">
                  <Input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6,10}"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="123456"
                  />
                </Field>
                <Button type="submit" variant="primary" className="w-full" disabled={busy || code.trim().length < 6}>
                  Sign in with code
                </Button>
              </form>
              <Button variant="ghost" className="w-full" onClick={() => setSentTo(null)}>
                Use a different email
              </Button>
            </>
          )}
          {error && <Notice tone="danger">{error}</Notice>}
        </Card>
      )}

      <Card className="mt-4 space-y-2">
        <p className="text-sm text-muted">
          {isSupabaseConfigured
            ? "Just looking? Try it with sample homework. Nothing is saved to an account."
            : "Accounts aren't set up on this copy of the app yet, but you can try the demo."}
        </p>
        <Button className="w-full" onClick={startDemo}>
          Try the demo
        </Button>
      </Card>

      <section className="mt-6 text-xs leading-relaxed text-muted">
        <h2 className="mb-1 font-semibold">Privacy</h2>
        <p>
          We store only your email, the classes and assignments you add, and the times you log. We never sell or
          share it, and it&apos;s used only to plan your homework and improve time estimates (in anonymized form,
          with no names, emails, titles or descriptions). You can delete your account and all your data at any time
          from the More page.
        </p>
      </section>
    </main>
  );
}

function friendlyError(message: string): string {
  if (/rate limit/i.test(message)) return "Too many sign-in emails right now. Wait a few minutes and try again.";
  return message;
}
