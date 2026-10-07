import type { ReactNode } from 'react';
import { Button } from '../Button/Button';
import { Text } from '../Text/Text';
import styles from './EmptyState.module.css';

/** What a list shows when there's nothing in it. A user should never land on
 *  a dead end — where there's somewhere useful to go, `action` puts the
 *  button right here. */
export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className={styles.empty}>
      <span className={styles.icon}>{icon}</span>
      <Text as="p" variant="body" weight="semibold">
        {title}
      </Text>
      {hint && (
        <Text variant="small" tone="secondary">
          {hint}
        </Text>
      )}
      {action && <Button onClick={action.onClick}>{action.label}</Button>}
    </div>
  );
}
