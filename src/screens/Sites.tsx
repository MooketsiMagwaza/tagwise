import { useState } from 'react';
import { Building2, GraduationCap, Stethoscope, Warehouse } from 'lucide-react';
import type { ReactNode } from 'react';
import { Text } from '../ui';
import { Link } from '../lib/router';
import { useLookups, useQuery } from '../data/hooks';
import type { Site } from '../data/types';
import { ScreenHeader } from '../app/bits';
import { SiteMap } from '../app/map/SiteMap';
import styles from './Sites.module.css';

export const KIND: Record<Site['kind'], { label: string; icon: ReactNode }> = {
  office: { label: 'Office', icon: <Building2 size={16} /> },
  warehouse: { label: 'Store', icon: <Warehouse size={16} /> },
  school: { label: 'School', icon: <GraduationCap size={16} /> },
  clinic: { label: 'Clinic', icon: <Stethoscope size={16} /> },
};

export default function Sites() {
  const l = useLookups();
  const assets = useQuery((r) => r.assets(), []);
  const stock = useQuery((r) => r.stock(), []);
  const counts = useQuery((r) => r.counts(), []);
  const [selected, setSelected] = useState<string | undefined>();
  const sites = Array.from(l.sites.values());

  return (
    <div className={styles.page}>
      <ScreenHeader title="Sites" subtitle={`${sites.length} places the trust keeps things: offices, a store, a school and clinics.`} />
      <div className={styles.grid}>
        <div className={styles.mapCol}>{l.ready && <SiteMap sites={sites} selected={selected} onSelect={setSelected} />}</div>
        <ul className={styles.list} aria-label="Sites">
          {sites.map((s) => {
            const here = (assets.data ?? []).filter((a) => a.siteId === s.id && a.status !== 'retired');
            const out = here.filter((a) => a.status === 'checked_out').length;
            const low = (stock.data ?? []).filter((k) => k.siteId === s.id && k.quantity <= k.reorderAt).length;
            const open = (counts.data ?? []).find((c) => c.siteId === s.id && c.status === 'open');
            return (
              <li key={s.id}>
                <button type="button" className={`${styles.site} ${selected === s.id ? styles.selected : ''}`} onClick={() => setSelected(s.id)} aria-pressed={selected === s.id}>
                  <span className={`${styles.kind} ${styles[s.kind]}`}>{KIND[s.kind].icon}</span>
                  <span className={styles.siteText}>
                    <span className={styles.siteName}>{s.name}</span>
                    <span className={styles.siteMeta}>
                      {KIND[s.kind].label} · {s.town}
                    </span>
                    <span className={styles.siteFigures}>
                      {here.length} assets{out ? ` · ${out} out` : ''}
                      {low ? ` · ${low} low stock` : ''}
                      {open ? ' · counting now' : ''}
                    </span>
                  </span>
                </button>
                {selected === s.id && (
                  <div className={styles.links}>
                    <Link href={`/app/sites/${s.id}`}>Open the site</Link>
                    <Link href={`/app/assets?site=${s.id}`}>Its assets</Link>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      <Text variant="caption" tone="secondary">
        Map data © OpenStreetMap contributors, tiles by OpenFreeMap. Site positions are town centres, not real addresses.
      </Text>
    </div>
  );
}
