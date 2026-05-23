"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export type ConfirmDialogTone = "danger" | "neutral";

export type ConfirmRequest = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmDialogTone;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "确定",
  cancelLabel = "取消",
  tone = "danger",
  onConfirm,
  onCancel,
}: ConfirmRequest & {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      } else if (event.key === "Enter") {
        event.preventDefault();
        onConfirm();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  const confirmStyle =
    tone === "danger"
      ? {
          background: "var(--warm)",
          color: "#ffffff",
          boxShadow: "0 4px 12px rgba(182, 110, 68, 0.28)",
        }
      : {
          background: "var(--green-600)",
          color: "#ffffff",
          boxShadow: "0 4px 12px rgba(44, 74, 58, 0.22)",
        };

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{ background: "rgba(29, 37, 32, 0.42)" }}
      onClick={onCancel}
    >
      <div
        className="relative flex w-[min(440px,100%)] flex-col rounded-3xl"
        style={{
          background: "var(--paper)",
          boxShadow: "var(--shadow-lg)",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="px-7 pb-3 pt-7">
          <h2
            className="text-[19px] font-medium leading-snug"
            style={{
              color: "var(--ink)",
              fontFamily: "var(--font-serif-sc), var(--font-serif), serif",
              letterSpacing: "-0.01em",
            }}
          >
            {title}
          </h2>
        </header>
        <div className="px-7 pb-6">
          <p
            className="text-[13.5px] leading-[1.7]"
            style={{ color: "var(--ink-soft)" }}
          >
            {description}
          </p>
        </div>
        <footer className="flex justify-end gap-2 px-7 pb-7">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full px-5 py-2 text-[13px] font-medium transition-colors"
            style={{
              background: "transparent",
              color: "var(--ink-soft)",
              border: "1px solid var(--paper-edge)",
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            autoFocus
            className="rounded-full px-5 py-2 text-[13px] font-medium transition-transform active:scale-[0.98]"
            style={confirmStyle}
          >
            {confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}

export function useConfirm(): {
  confirm: (request: ConfirmRequest) => Promise<boolean>;
  dialog: ReactNode;
} {
  const [pending, setPending] = useState<ConfirmRequest | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((request: ConfirmRequest) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current?.(false);
      resolverRef.current = resolve;
      setPending(request);
    });
  }, []);

  const resolve = useCallback((result: boolean) => {
    const resolver = resolverRef.current;
    resolverRef.current = null;
    setPending(null);
    resolver?.(result);
  }, []);

  const dialog = pending ? (
    <ConfirmDialog
      open
      {...pending}
      onConfirm={() => resolve(true)}
      onCancel={() => resolve(false)}
    />
  ) : null;

  return { confirm, dialog };
}
