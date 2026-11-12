// Small shared building blocks so every page looks and behaves the same.
// Buttons and inputs are at least 44px tall (min-h-11) for easy tapping.
import { forwardRef } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-fg hover:opacity-90",
  secondary: "bg-surface text-text border border-border hover:bg-surface-2",
  danger: "bg-danger-soft text-danger border border-danger/30 hover:opacity-90",
  ghost: "text-accent hover:bg-accent-soft",
};

export function Button({
  variant = "secondary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_STYLES[variant]} ${className}`}
      {...props}
    />
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = "", ...props }, ref) {
    return (
      <input
        ref={ref}
        className={`min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-base text-text placeholder:text-muted/70 ${className}`}
        {...props}
      />
    );
  },
);

export function Select({ className = "", ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-base text-text ${className}`}
      {...props}
    />
  );
}

export function Textarea({ className = "", ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full rounded-lg border border-border bg-surface px-3 py-2 text-base text-text placeholder:text-muted/70 ${className}`}
      {...props}
    />
  );
}

/** A label above a form control. */
export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Card({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-xl border border-border bg-surface p-4 ${className}`} {...props} />;
}

export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "warn" | "danger" | "ok";
  children: React.ReactNode;
}) {
  const styles = {
    info: "bg-accent-soft text-text",
    warn: "bg-warn-soft text-warn",
    danger: "bg-danger-soft text-danger",
    ok: "bg-ok-soft text-ok",
  }[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`rounded-lg px-3 py-2 text-sm ${styles}`}>
      {children}
    </div>
  );
}

export function PageTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <h1 className="text-xl font-semibold">{children}</h1>
      {action}
    </div>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return <p className="py-8 text-center text-sm text-muted">{label}</p>;
}
