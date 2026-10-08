import { useEffect, useRef } from 'react';
import styles from './Barcode.module.css';

/** A Code 128 barcode with its digits beneath, black on white (see QrCode for
 *  why it is never themed). */
export function Barcode({ value, height = 56, label, format = 'CODE128' }: { value: string; height?: number; label: string; format?: 'CODE128' | 'EAN13' }) {
  const svg = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let alive = true;
    import('jsbarcode').then(({ default: JsBarcode }) => {
      if (!alive || !svg.current) return;
      try {
        JsBarcode(svg.current, value, {
          format,
          displayValue: true,
          height,
          margin: 6,
          fontSize: 13,
          background: '#ffffff',
          lineColor: '#000000',
        });
      } catch {
        /* a value Code 128 can't encode leaves the box empty */
      }
    });
    return () => {
      alive = false;
    };
  }, [value, height, format]);

  return <svg ref={svg} role="img" aria-label={label} className={styles.barcode} />;
}
