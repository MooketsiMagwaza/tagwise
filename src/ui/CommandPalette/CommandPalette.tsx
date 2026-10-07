import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Search } from 'lucide-react';
import styles from './CommandPalette.module.css';

export interface Command {
  id: string;
  label: string;
  /** A line under the label — where it goes, or why it's suggested. */
  detail?: string;
  icon?: ReactNode;
  /** Extra words that should find it ("dark" for the theme switch). */
  keywords?: string;
  onSelect: () => void;
}

export interface CommandGroup {
  heading: string;
  commands: Command[];
}

/** Does `text` contain every word of `query`, in any order? Case-insensitive.
 *  An empty query matches everything. */
function matches(query: string, text: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const hay = text.toLowerCase();
  return words.every((w) => hay.includes(w));
}

/** A search-and-run box: type to filter, ↑ ↓ to move, Enter to run, Esc to close.
 *  The list is given to it, grouped; it knows nothing about what the commands do.
 *  Open it from the keyboard (see the app's ⌘K / Ctrl+K handler). */
export function CommandPalette({
  groups,
  placeholder = 'Search or run a command…',
  onClose,
}: {
  groups: CommandGroup[];
  placeholder?: string;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const shown = useMemo(
    () =>
      groups
        .map((g) => ({ heading: g.heading, commands: g.commands.filter((c) => matches(query, `${c.label} ${c.detail ?? ''} ${c.keywords ?? ''}`)) }))
        .filter((g) => g.commands.length > 0),
    [groups, query],
  );
  const flat = shown.flatMap((g) => g.commands);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    input.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
  }, []);

  // Keep the highlighted row inside the list as the query narrows it.
  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    document.getElementById(`${listId}-${active}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [active, listId]);

  function run(command: Command | undefined) {
    if (!command) return;
    onCloseRef.current();
    command.onSelect();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCloseRef.current();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((i) => (flat.length ? (i + 1) % flat.length : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => (flat.length ? (i - 1 + flat.length) % flat.length : 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      run(flat[active]);
    }
  }

  let index = -1;
  return createPortal(
    <div
      className={styles.scrim}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-label="Search and commands" className={styles.panel} onKeyDown={onKeyDown}>
        <div className={styles.search}>
          <Search size={18} aria-hidden="true" />
          <input
            ref={input}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={flat.length ? `${listId}-${active}` : undefined}
            aria-autocomplete="list"
            className={styles.input}
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd className={styles.hint}>Esc</kbd>
        </div>
        {flat.length === 0 ? (
          <p className={styles.empty}>Nothing matches “{query}”.</p>
        ) : (
          <ul id={listId} role="listbox" className={styles.list}>
            {shown.map((group) => (
              <li key={group.heading} role="presentation">
                <div className={styles.heading} role="presentation">
                  {group.heading}
                </div>
                <ul role="presentation" className={styles.group}>
                  {group.commands.map((c) => {
                    index += 1;
                    const i = index;
                    return (
                      <li
                        key={c.id}
                        id={`${listId}-${i}`}
                        role="option"
                        aria-selected={i === active}
                        className={styles.option}
                        onMouseMove={() => setActive(i)}
                        onClick={() => run(c)}
                      >
                        {c.icon && <span className={styles.icon}>{c.icon}</span>}
                        <span className={styles.text}>
                          <span className={styles.label}>{c.label}</span>
                          {c.detail && <span className={styles.detail}>{c.detail}</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>,
    document.body,
  );
}
