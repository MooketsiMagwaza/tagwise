import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cx } from '../cx';
import { Text } from '../Text/Text';
import styles from './Card.module.css';

/** The standard in-flow surface: flat white on the page colour, no border,
 *  no shadow — separation comes from colour, not effects. */
export function Card({
  padding = 'lg',
  ...rest
}: Omit<ComponentPropsWithoutRef<'div'>, 'className' | 'style'> & { padding?: 'none' | 'md' | 'lg' }) {
  return <div {...rest} className={cx(styles.card, styles[`pad-${padding}`])} />;
}

/** Title on the left, quiet meta text and an optional action on the right. */
export function CardHeader({ title, meta, action }: { title: ReactNode; meta?: ReactNode; action?: ReactNode }) {
  return (
    <div className={styles.header}>
      <Text as="h2" variant="headline">
        {title}
      </Text>
      <div className={styles.aside}>
        {meta != null && (
          <Text as="span" variant="caption" tone="secondary">
            {meta}
          </Text>
        )}
        {action}
      </div>
    </div>
  );
}
