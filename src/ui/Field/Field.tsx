import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { cx } from '../cx';
import styles from './Field.module.css';

type NativeInput = Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'style' | 'size'>;

/** The bare text input. Reach for `TextField` when there's a label. */
export function Input({
  startIcon,
  invalid,
  narrow,
  ...rest
}: NativeInput & {
  /** A decorative leading icon (search, mail…). */
  startIcon?: ReactNode;
  invalid?: boolean;
  /** A short, centred field — quantities. */
  narrow?: boolean;
}) {
  return (
    <span className={cx(styles.wrap, narrow && styles.narrow)}>
      {startIcon && <span className={styles.startIcon}>{startIcon}</span>}
      <input
        {...rest}
        aria-invalid={invalid || undefined}
        className={cx(styles.input, !!startIcon && styles.hasIcon, narrow && styles.center)}
      />
    </span>
  );
}

/** A search box: a magnifier, and a sensible width instead of filling the row. */
export function SearchField({
  label,
  ...rest
}: Omit<NativeInput, 'type' | 'aria-label'> & { label: string }) {
  return (
    <div className={styles.search}>
      <Input {...rest} type="search" aria-label={label} startIcon={<Search size={16} />} />
    </div>
  );
}

/** A multi-line text box for longer descriptions. */
export function TextAreaField({
  label,
  hint,
  id,
  ...rest
}: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className' | 'style'> & { label: string; hint?: string }) {
  const auto = useId();
  const areaId = id ?? auto;
  return (
    <div className={styles.field}>
      <label htmlFor={areaId} className={styles.label}>
        {label}
      </label>
      <textarea {...rest} id={areaId} className={cx(styles.input, styles.textarea)} />
      {hint && <p className={styles.note}>{hint}</p>}
    </div>
  );
}

/** A native select (so it behaves on every platform), styled to match. */
export function SelectField({
  label,
  options,
  hint,
  id,
  ...rest
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className' | 'style' | 'size'> & {
  label: string;
  options: { value: string; label: string }[];
  hint?: string;
}) {
  const auto = useId();
  const selectId = id ?? auto;
  return (
    <div className={styles.field}>
      <label htmlFor={selectId} className={styles.label}>
        {label}
      </label>
      <span className={styles.wrap}>
        <select {...rest} id={selectId} className={cx(styles.input, styles.select)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className={styles.chevron}>
          <ChevronDown size={16} />
        </span>
      </span>
      {hint && <p className={styles.note}>{hint}</p>}
    </div>
  );
}

/** Label + input + hint/error, wired for assistive tech (`for`/`id`,
 *  `aria-describedby`, `aria-invalid`). */
export function TextField({
  label,
  hint,
  error,
  id,
  ...rest
}: NativeInput & { label: string; hint?: string; error?: string | null }) {
  const auto = useId();
  const inputId = id ?? auto;
  const noteId = `${inputId}-note`;
  const note = error || hint;
  return (
    <div className={styles.field}>
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      <Input {...rest} id={inputId} invalid={!!error} aria-describedby={note ? noteId : undefined} />
      {note && (
        <p id={noteId} className={cx(styles.note, error && styles.error)} role={error ? 'alert' : undefined}>
          {note}
        </p>
      )}
    </div>
  );
}
