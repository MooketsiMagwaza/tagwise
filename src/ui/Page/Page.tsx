import type { ReactNode } from 'react';
import { Text } from '../Text/Text';
import styles from './Page.module.css';

/** The centred content column under the nav bar. */
export function Page({ children }: { children: ReactNode }) {
  return <main className={styles.page}>{children}</main>;
}

/** A large page title with a one-line description beneath it. */
export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className={styles.header}>
      <Text variant="display">{title}</Text>
      {subtitle && (
        <Text variant="body" tone="secondary">
          {subtitle}
        </Text>
      )}
    </div>
  );
}
