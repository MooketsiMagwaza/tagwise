import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './PrintPortal.module.css';

export type Paper = 'a4' | 'label' | 'receipt';

const PAGE: Record<Paper, string> = {
  a4: '@page { size: A4; margin: 14mm; }',
  label: '@page { size: 62mm 40mm; margin: 2mm; }',
  receipt: '@page { size: 80mm auto; margin: 3mm; }',
};

/** Content that exists only on paper. It renders off-screen; when the user
 *  prints, everything else on the page is hidden and this is what comes out,
 *  on the paper size given. Mount it only while a print preview is open. */
export function PrintPortal({ children, paper = 'a4' }: { children: ReactNode; paper?: Paper }) {
  useEffect(() => {
    const style = document.createElement('style');
    style.dataset.printPage = paper;
    style.textContent = PAGE[paper];
    document.head.appendChild(style);
    return () => style.remove();
  }, [paper]);

  return createPortal(<div className={styles.portal}>{children}</div>, document.body);
}

/** Opens the print dialog, after a beat so the portal has painted. In the
 *  desktop app that is the operating system's dialog (asked of the shell); in a
 *  browser, the browser's. */
export function printNow() {
  window.setTimeout(() => {
    const tauri = (window as { __TAURI__?: { core: { invoke: (c: string) => Promise<unknown> } } }).__TAURI__;
    if (tauri) tauri.core.invoke('print_page').catch(() => window.print());
    else window.print();
  }, 60);
}
