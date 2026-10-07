import { useEffect, useState } from 'react';
import styles from './QrCode.module.css';

/** A QR code for `value`. Always black on white — never themed — because a
 *  scanner needs the contrast, so it must stay scannable in dark mode and on
 *  paper. The generator is fetched the first time one is shown. */
export function QrCode({ value, size = 160, label }: { value: string; size?: number; label: string }) {
  const [svg, setSvg] = useState('');

  useEffect(() => {
    let alive = true;
    import('qrcode')
      .then((qr) => qr.toString(value, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } }))
      .then((markup) => {
        if (alive) setSvg(markup);
      })
      .catch(() => {
        if (alive) setSvg('');
      });
    return () => {
      alive = false;
    };
  }, [value]);

  return (
    <span
      role="img"
      aria-label={label}
      className={styles.qr}
      style={{ width: size, height: size }}
      // The markup comes from the QR library encoding `value` as shapes only.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
