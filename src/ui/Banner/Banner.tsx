import type { ReactNode } from 'react';
import { cx } from '../cx';
import styles from './Banner.module.css';

/** A quiet one-line notice. Used to label anything that isn't the real thing
 *  (sample data, a simulated teammate) so it can never be mistaken for it. */
export function Banner({
  tone = 'info',
  icon,
  children,
}: {
  tone?: 'info' | 'warning' | 'brand';
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div role="status" className={cx(styles.banner, styles[tone])}>
      {icon}
      <span>{children}</span>
    </div>
  );
}
