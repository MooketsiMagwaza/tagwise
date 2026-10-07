import { cx } from '../cx';
import { VisuallyHidden } from '../VisuallyHidden/VisuallyHidden';
import styles from './Steps.module.css';

export interface Step {
  label: string;
  state: 'done' | 'current' | 'todo';
}

/** A horizontal progress tracker: one bar per step, filled up to and
 *  including the current one. The state is spelled out for screen readers,
 *  not left to colour. */
export function Steps({ steps, tone = 'success' }: { steps: Step[]; tone?: 'success' | 'danger' }) {
  return (
    <ol className={cx(styles.steps, styles[tone])}>
      {steps.map((step) => (
        <li key={step.label} className={styles[step.state]} aria-current={step.state === 'current' ? 'step' : undefined}>
          {step.label}
          <VisuallyHidden>{step.state === 'done' ? ' (completed)' : step.state === 'current' ? ' (current)' : ' (upcoming)'}</VisuallyHidden>
        </li>
      ))}
    </ol>
  );
}
