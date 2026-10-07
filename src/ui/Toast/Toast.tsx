import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cx } from '../cx';
import styles from './Toast.module.css';

export interface ToastItem {
  id: number;
  message: string;
  kind: 'ok' | 'error';
}

/** The stack of transient messages. Presentation only — the queue and its
 *  timers live in lib/toast.tsx. `role="status"` announces each politely. */
export function ToastStack({ toasts }: { toasts: ToastItem[] }) {
  return (
    <div className={styles.stack} role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={cx(styles.toast, toast.kind === 'error' ? styles.error : styles.ok)}>
          {toast.kind === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          {toast.message}
        </div>
      ))}
    </div>
  );
}
