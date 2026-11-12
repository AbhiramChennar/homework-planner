"use client";

import { useAuth } from "@/components/AuthProvider";
import { Button, Card, PageTitle } from "@/components/ui";

export default function SettingsPage() {
  const { session, signOut } = useAuth();
  if (session.status !== "signedIn") return null;

  return (
    <>
      <PageTitle>More</PageTitle>
      <Card className="space-y-3">
        <p className="text-sm text-muted">
          {session.mode === "demo" ? "You're using the demo." : `Signed in as ${session.email}`}
        </p>
        <Button onClick={() => void signOut()}>
          {session.mode === "demo" ? "Leave demo" : "Sign out"}
        </Button>
      </Card>
    </>
  );
}
