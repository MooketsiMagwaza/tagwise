import { useEffect, type ReactNode } from 'react';
import { cx } from '../cx';
import styles from './Popover.module.css';

/** A floating panel anchored under its trigger. The parent owns `open`; a
 *  click outside or Escape asks it to close. */
export function Popover({
  open,
  onClose,
  trigger,
  children,
}: {
  open: boolean;
  onClose: () => void;
  trigger: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return (
    <div className={styles.anchor}>
      {trigger}
      {open && (
        <>
          <div className={styles.scrim} onClick={onClose} aria-hidden="true" />
          <div className={styles.panel}>{children}</div>
        </>
      )}
    </div>
  );
}

/** The quiet block at the top of a popover (who's signed in, and so on). */
export function PopoverHeader({ children }: { children: ReactNode }) {
  return <div className={styles.header}>{children}</div>;
}

/** A hairline between groups of menu items. */
export function PopoverDivider() {
  return <div className={styles.divider} role="separator" />;
}

export function MenuItem({
  icon,
  tone = 'default',
  onClick,
  children,
}: {
  icon?: ReactNode;
  tone?: 'default' | 'danger';
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" className={cx(styles.item, tone === 'danger' && styles.danger)} onClick={onClick}>
      {icon}
      {children}
    </button>
  );
}
