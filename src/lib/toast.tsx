import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { ToastStack, type ToastItem } from '../ui';

const ToastContext = createContext<{ push: (message: string, kind?: ToastItem['kind']) => void } | null>(null);

let nextId = 1;

/** Owns the queue and the timers; how a toast looks is `ui/Toast`'s job. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback((message: string, kind: ToastItem['kind'] = 'ok') => {
    const id = nextId++;
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((toast) => toast.id !== id)), 4000);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastStack toasts={toasts} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
