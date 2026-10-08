import { QrCode } from '../ui';
import type { Asset } from '../data/types';
import styles from './AssetLabel.module.css';

/** The address a label's QR code opens: any phone camera can scan it and
 *  land on the item; Tagwise's own scanner reads the tag out of it. */
export function labelUrl(tag: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://tagwise.example';
  return `${origin}/s/${encodeURIComponent(tag)}`;
}

/** A physical asset label, 62 x 40 mm when printed. Always black on white
 *  (never themed) so it scans in dark mode and on paper. */
export function AssetLabel({ asset, org, size = 'md' }: { asset: Pick<Asset, 'tag' | 'name'>; org: string; size?: 'md' | 'print' }) {
  return (
    <div className={size === 'print' ? styles.print : styles.label}>
      <QrCode value={labelUrl(asset.tag)} size={size === 'print' ? 112 : 104} label={`QR code for ${asset.tag}`} />
      <div className={styles.text}>
        <span className={styles.org}>{org}</span>
        <span className={styles.tag}>{asset.tag}</span>
        <span className={styles.name}>{asset.name}</span>
        <span className={styles.foot}>If found, please return to the office.</span>
      </div>
    </div>
  );
}
