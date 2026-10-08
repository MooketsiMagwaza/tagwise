import { useEffect, useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import { Button, Card, Input, PrintPortal, printNow, SelectField, Text } from '../ui';
import { useLocation } from '../lib/router';
import { useToast } from '../lib/toast';
import { repo, useLookups, useMe, useQuery } from '../data/hooks';
import { ScreenHeader } from '../app/bits';
import { AssetLabel } from '../app/AssetLabel';
import styles from './Labels.module.css';

const PER_SHEET = 18; // 3 x 6 labels of 62 x 40 mm on A4 with 8 mm margins

export default function Labels() {
  const { search } = useLocation();
  const l = useLookups();
  const { me, can } = useMe();
  const toast = useToast();
  const ws = useQuery((r) => r.workspace(), []);
  const assets = useQuery((r) => r.assets({ sort: { field: 'tag', dir: 'asc' } }), []);
  const [site, setSite] = useState('');
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [printing, setPrinting] = useState(false);

  // Arriving from the register with ?ids=TAG,TAG preselects those.
  useEffect(() => {
    const ids = search.get('ids');
    if (ids && assets.data) {
      const tags = new Set(ids.split(','));
      setChosen(new Set(assets.data.filter((a) => tags.has(a.tag)).map((a) => a.id)));
    }
  }, [search, assets.data]);

  const list = useMemo(
    () =>
      (assets.data ?? []).filter(
        (a) => a.status !== 'retired' && (!site || a.siteId === site) && (!query || `${a.tag} ${a.name} ${a.category}`.toLowerCase().includes(query.toLowerCase())),
      ),
    [assets.data, site, query],
  );
  const picked = (assets.data ?? []).filter((a) => chosen.has(a.id));
  const sheets = Math.max(1, Math.ceil(picked.length / PER_SHEET));

  function print() {
    if (!picked.length) return;
    setPrinting(true);
    printNow();
    if (me) repo().logLabelsPrinted(picked.map((a) => a.id), me.id);
    toast.push(`Sent ${picked.length} labels to the printer`);
    window.setTimeout(() => setPrinting(false), 1500);
  }

  return (
    <div className={styles.page}>
      <ScreenHeader
        title="Labels"
        subtitle="Choose assets and print QR labels on A4: 18 per sheet, 62 × 40 mm each. Any phone camera opens the item from its label."
        actions={
          can('labels.print') && (
            <Button icon={<Printer size={16} />} onClick={print} disabled={!picked.length}>
              Print {picked.length || ''} {picked.length === 1 ? 'label' : 'labels'}
            </Button>
          )
        }
      />
      <div className={styles.grid}>
        <Card padding="md">
          <div className={styles.filters}>
            <SelectField label="Site" value={site} onChange={(e) => setSite(e.target.value)} options={[{ value: '', label: 'All sites' }, ...Array.from(l.sites.values()).map((s) => ({ value: s.id, label: s.name }))]} />
            <label className={styles.searchLabel}>
              <span>Search</span>
              <Input type="search" placeholder="Tag, name or category" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
          </div>
          <div className={styles.listHead}>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={list.length > 0 && list.every((a) => chosen.has(a.id))}
                onChange={(e) => {
                  const next = new Set(chosen);
                  list.forEach((a) => (e.target.checked ? next.add(a.id) : next.delete(a.id)));
                  setChosen(next);
                }}
              />
              Select all {list.length} shown
            </label>
            <Text variant="caption" tone="secondary">
              {picked.length} chosen · {sheets} {sheets === 1 ? 'sheet' : 'sheets'}
            </Text>
          </div>
          <ul className={styles.list}>
            {list.map((a) => (
              <li key={a.id}>
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={chosen.has(a.id)}
                    onChange={(e) => {
                      const next = new Set(chosen);
                      if (e.target.checked) next.add(a.id);
                      else next.delete(a.id);
                      setChosen(next);
                    }}
                  />
                  <span className={styles.tag}>{a.tag}</span>
                  <span className={styles.name}>{a.name}</span>
                  <span className={styles.site}>{l.sites.get(a.siteId)?.name}</span>
                </label>
              </li>
            ))}
          </ul>
        </Card>

        <div className={styles.previewCol}>
          <Text variant="caption" tone="secondary">
            Preview of sheet 1
          </Text>
          <div className={styles.sheet} aria-label="Label sheet preview">
            {Array.from({ length: PER_SHEET }).map((_, i) => {
              const a = picked[i];
              return <div key={i} className={styles.slot}>{a ? <AssetLabel asset={a} org={ws.data?.name ?? ''} size="print" /> : null}</div>;
            })}
          </div>
        </div>
      </div>

      {printing && (
        <PrintPortal paper="sheet">
          <div className={styles.printSheet}>
            {picked.map((a) => (
              <AssetLabel key={a.id} asset={a} org={ws.data?.name ?? ''} size="print" />
            ))}
          </div>
        </PrintPortal>
      )}
    </div>
  );
}
