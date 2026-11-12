"use client";

// A modal dialog built on the browser's native <dialog> element, which gives us
// for free: Escape to close, focus kept inside the dialog, and a backdrop.
import { useEffect, useRef } from "react";

export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // The browser focuses the first focusable element, which is the close
      // button; jump to the field that most needs attention instead.
      dialog.querySelector<HTMLElement>("[data-autofocus], input, select, textarea")?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose} // fires on Escape too
      aria-label={title}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl border border-border bg-surface p-0 text-text shadow-xl backdrop:bg-black/50"
    >
      {open && (
        <div className="max-h-[85dvh] overflow-y-auto p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="flex size-11 items-center justify-center rounded-lg text-xl text-muted hover:bg-surface-2"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
