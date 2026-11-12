"use client";

// The frame around every signed-in page: header, navigation, and the data
// provider. Signed-out visitors are sent to /login.
//
// This replaces the server middleware in PLAN.md step 3: the app is a static
// site, so the check happens in the browser. That's fine for security because
// the database itself (RLS) refuses to return data to signed-out users; this
// redirect just makes the experience sensible.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { DataProvider } from "./DataProvider";
import { Spinner } from "./ui";

const NAV = [
  { href: "/", label: "Tonight" },
  { href: "/assignments/", label: "Homework" },
  { href: "/classes/", label: "Classes" },
  { href: "/insights/", label: "Insights" },
  { href: "/settings/", label: "More" },
];

/** "/classes" and "/classes/" are the same page. */
const normalize = (p: string) => (p.length > 1 ? p.replace(/\/$/, "") : p);

export function AppShell({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const router = useRouter();
  const pathname = normalize(usePathname() ?? "/");

  useEffect(() => {
    if (session.status === "signedOut") router.replace("/login/");
  }, [session.status, router]);

  if (session.status !== "signedIn") return <Spinner />;

  return (
    // `key` resets all page data when the user changes (e.g. demo → real account).
    <DataProvider key={session.userId} store={session.store}>
      <div className="mx-auto flex min-h-dvh max-w-xl flex-col">
        <header className="sticky top-0 z-10 border-b border-border bg-bg/95 px-4 pt-3 backdrop-blur">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold">Homework Planner</span>
            {session.mode === "demo" && (
              <span className="rounded-full bg-warn-soft px-2 py-0.5 text-xs font-medium text-warn">
                Demo: data stays on this device
              </span>
            )}
          </div>
          <nav aria-label="Main" className="-mx-1 mt-2 flex">
            {NAV.map((item) => {
              const active = normalize(item.href) === pathname;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 flex-1 items-center justify-center border-b-2 px-1 text-sm ${
                    active ? "border-accent font-semibold text-accent" : "border-transparent text-muted"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>
        <main className="flex-1 px-4 py-5">{children}</main>
      </div>
    </DataProvider>
  );
}
