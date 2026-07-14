"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    // A second confirm() call before the first is answered would otherwise
    // silently orphan the first caller's promise (it would never resolve,
    // leaving that row's button disabled forever) — resolve it as cancelled
    // first.
    resolver.current?.(false);
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const handle = useCallback((result: boolean) => {
    resolver.current?.(result);
    resolver.current = null;
    setOptions(null);
  }, []);

  useEffect(() => {
    if (!options) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") handle(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [options, handle]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 px-6 backdrop-blur-sm"
          onClick={() => handle(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6"
          >
            {options.title && <h2 className="font-display text-lg font-semibold text-paper">{options.title}</h2>}
            <p className="mt-2 text-sm text-muted">{options.message}</p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                autoFocus
                onClick={() => handle(false)}
                className="rounded-full border border-line px-4 py-1.5 text-sm font-medium text-paper transition-colors hover:border-brand"
              >
                {options.cancelLabel ?? "Annuler"}
              </button>
              <button
                onClick={() => handle(true)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                  options.danger ? "bg-no text-paper hover:bg-no/80" : "bg-paper text-ink hover:bg-brand"
                }`}
              >
                {options.confirmLabel ?? "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}
