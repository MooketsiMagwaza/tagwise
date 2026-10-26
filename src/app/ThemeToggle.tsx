import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { setAppearance, useAppearance, useIsDark } from '../theme';
import styles from './ThemeToggle.module.css';

const FIELD = 'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]), textarea, select, [contenteditable="true"]';

/** The light/dark switch: a small round button floating in a bottom corner,
 *  never in a navigation bar. In the app it sits bottom right on wide
 *  screens and bottom left above the tab bar on phones; on the public page
 *  it sits bottom right. It steps aside while a text field has focus, so it
 *  never covers what someone is typing. */
export function ThemeToggle({ placement = 'app' }: { placement?: 'app' | 'page' }) {
  const dark = useIsDark();
  const appearance = useAppearance();
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    const check = () => requestAnimationFrame(() => setTyping(!!document.activeElement?.matches(FIELD)));
    document.addEventListener('focusin', check);
    document.addEventListener('focusout', check);
    return () => {
      document.removeEventListener('focusin', check);
      document.removeEventListener('focusout', check);
    };
  }, []);

  const label = dark ? 'Switch to the light theme' : 'Switch to the dark theme';
  return (
    <button
      type="button"
      className={`${styles.toggle} ${styles[placement]} ${typing ? styles.away : ''}`}
      aria-label={label}
      title={label}
      onClick={() => setAppearance({ ...appearance, theme: dark ? 'light' : 'dark' })}
    >
      {dark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
    </button>
  );
}
