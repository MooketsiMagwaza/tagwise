import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '../cx';
import styles from './Button.module.css';

type NativeButton = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'style'>;

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'link' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

/** The one button. `type` defaults to "button" so nothing inside a form
 *  submits by accident; pass `type="submit"` where it should. */
export function Button({
  variant = 'primary',
  size = 'md',
  full = false,
  icon,
  type = 'button',
  children,
  ...rest
}: NativeButton & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button {...rest} type={type} className={cx(styles.button, styles[variant], styles[size], full && styles.full)}>
      {icon}
      {children}
    </button>
  );
}

/** A link that looks like a button (for navigation, so it stays a real link:
 *  middle-click, copy address, and the right semantics for screen readers). */
export function ButtonLink({
  variant = 'primary',
  size = 'md',
  icon,
  children,
  ...rest
}: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'style'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
}) {
  return (
    <a {...rest} className={cx(styles.button, styles[variant], styles[size])}>
      {icon}
      {children}
    </a>
  );
}

/** Icon-only button. `label` is required: an icon alone names nothing to a
 *  screen reader, so the type system won't let it be omitted. */
export function IconButton({
  label,
  variant = 'secondary',
  size = 'md',
  badge,
  type = 'button',
  children,
  ...rest
}: NativeButton & {
  label: string;
  variant?: 'secondary' | 'plain' | 'overlay';
  size?: 'sm' | 'md';
  /** A count shown on the corner. Hidden at 0. */
  badge?: number;
}) {
  return (
    <button
      {...rest}
      type={type}
      aria-label={label}
      title={label}
      className={cx(styles.icon, styles[`icon-${variant}`], styles[`icon-${size}`])}
    >
      {children}
      {!!badge && (
        <span className={styles.count} aria-hidden="true">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}
