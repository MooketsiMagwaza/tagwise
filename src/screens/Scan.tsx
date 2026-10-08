import { useRef, useState } from 'react';
import { ArrowLeftRight, ClipboardCheck, ExternalLink, PackageSearch, ScanLine, Undo2 } from 'lucide-react';
import { Button, ButtonLink, Card, CardHeader, EmptyState, Row, SelectField, Text } from '../ui';
import { useToast } from '../lib/toast';
import { dueLabel, timeOfDay } from '../lib/format';
import { repo, useLookups, useMe, useQuery } from '../data/hooks';
import type { LookupResult } from '../data/repository';
import { PersonChip, ScreenHeader, StatusPill } from '../app/bits';
import { Scanner } from '../app/scan/Scanner';
import { Quantity } from '../app/register/cells';
import { AdjustStock } from './StockDetail';
import styles from './Scan.module.css';

interface Read {
  at: string;
  raw: string;
  result: LookupResult;
}

function AssetResult({ id }: { id: string }) {
  const l = useLookups();
  const { me, can } = useMe();
  const toast = useToast();
  const asset = useQuery((r) => r.asset(id), [id]);
  const counts = useQuery((r) => r.counts(), []);
  const [room, setRoom] = useState('');
  const a = asset.data;
  if (!a) return null;
  const open = counts.data?.find((c) => c.status === 'open' && c.siteId === a.siteId);
  const rooms = Array.from(l.places.values()).filter((p) => p.siteId === a.siteId);

  return (
    <div className={styles.result}>
      <div className={styles.resultHead}>
        <span className={styles.code}>{a.tag}</span>
        <StatusPill status={a.status} />
      </div>
      <Text as="h2" variant="headline">
        {a.name}
      </Text>
      <Text tone="secondary">{[a.category, l.sites.get(a.siteId)?.name, a.placeId && l.places.get(a.placeId)?.name].filter(Boolean).join(' · ')}</Text>
      {a.custodianId && <PersonChip person={l.people.get(a.custodianId)} detail={a.status === 'checked_out' ? dueLabel(a.dueBack) : 'everyday use'} />}

      <div className={styles.actions}>
        <ButtonLink href={`/app/assets/${a.tag}`} variant="secondary" size="sm" icon={<ExternalLink size={14} />}>
          Open
        </ButtonLink>
        {can('asset.custody') && a.status === 'checked_out' && (
          <Button
            size="sm"
            icon={<Undo2 size={14} />}
            onClick={async () => {
              if (!me) return;
              const res = await repo().checkIn(a.id, me.id);
              toast.push(res.ok ? `Checked in ${a.tag}` : 'Could not check in', res.ok ? 'ok' : 'error');
            }}
          >
            Check in
          </Button>
        )}
        {can('asset.custody') && a.status !== 'checked_out' && (
          <ButtonLink href={`/app/assets/${a.tag}`} size="sm" variant="secondary" icon={<ArrowLeftRight size={14} />}>
            Check out
          </ButtonLink>
        )}
        {open && can('count.run') && (
          <Button
            size="sm"
            variant="secondary"
            icon={<ClipboardCheck size={14} />}
            onClick={async () => {
              if (!me) return;
              const scan = await repo().recordScan(open.id, a.tag, a.placeId, me.id);
              toast.push(scan.result === 'repeat' ? `Already counted in ${open.name}` : `Counted in ${open.name}`);
            }}
          >
            Count it in “{open.name}”
          </Button>
        )}
      </div>

      {can('asset.edit') && (
        <div className={styles.move}>
          <SelectField label="Move to" value={room} onChange={(e) => setRoom(e.target.value)} options={[{ value: '', label: 'Choose a room or store' }, ...rooms.filter((p) => p.id !== a.placeId).map((p) => ({ value: p.id, label: p.name }))]} />
          <Button
            variant="secondary"
            disabled={!room}
            onClick={async () => {
              if (!me || !room) return;
              const res = await repo().updateAsset(a.id, { placeId: room }, a.version, me.id);
              toast.push(res.ok ? `Moved to ${l.places.get(room)?.name}` : 'Someone changed it first; try again', res.ok ? 'ok' : 'error');
              setRoom('');
            }}
          >
            Move
          </Button>
        </div>
      )}
    </div>
  );
}

function StockResult({ id }: { id: string }) {
  const l = useLookups();
  const item = useQuery((r) => r.stockItem(id), [id]);
  const k = item.data;
  if (!k) return null;
  return (
    <div className={styles.result}>
      <div className={styles.resultHead}>
        <span className={styles.code}>{k.sku}</span>
        <Quantity qty={k.quantity} reorderAt={k.reorderAt} unit={k.unit} />
      </div>
      <Text as="h2" variant="headline">
        {k.name}
      </Text>
      <Text tone="secondary">{[k.category, l.sites.get(k.siteId)?.name].filter(Boolean).join(' · ')}</Text>
      <AdjustStock id={k.id} unit={k.unit} />
      <Row>
        <ButtonLink href={`/app/stock/${k.id}`} variant="link" size="sm">
          Open the stock line
        </ButtonLink>
      </Row>
    </div>
  );
}

export default function Scan() {
  const { can } = useMe();
  const assets = useQuery((r) => r.assets({ filters: [{ field: 'siteId', op: 'is', value: 's-hq' }] }), []);
  const stock = useQuery((r) => r.stock(), []);
  const [reads, setReads] = useState<Read[]>([]);
  const current = reads[0];
  const resultRef = useRef<HTMLDivElement>(null);

  async function handle(raw: string) {
    const result = await repo().lookup(raw);
    setReads((list) => [{ at: new Date().toISOString(), raw, result }, ...list].slice(0, 12));
    // On a phone the result sits under the camera: bring it into view.
    window.requestAnimationFrame(() => resultRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  }

  const samples = [
    ...(assets.data ?? []).slice(0, 2).map((a) => ({ code: a.tag, label: `${a.tag} (asset)` })),
    ...(stock.data ?? []).slice(0, 1).map((k) => ({ code: k.barcode, label: `${k.barcode} (stock)` })),
    { code: 'MCT-99999', label: 'MCT-99999 (unknown)' },
  ];

  return (
    <div className={styles.page}>
      <ScreenHeader title="Scan" subtitle="Look something up, check it in or out, move it, or count it. Works with any phone camera on https." />
      <div className={styles.grid}>
        <Card>
          <Scanner onScan={handle} />
          <div className={styles.samples}>
            <Text variant="caption" tone="secondary">
              No camera or label to hand? Try a sample code:
            </Text>
            <div className={styles.sampleRow}>
              {samples.map((s) => (
                <button key={s.code} type="button" className={styles.sample} onClick={() => handle(s.code)}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </Card>

        <div className={styles.side} ref={resultRef}>
          <Card>
            {!current ? (
              <EmptyState icon={<ScanLine size={28} />} title="Nothing scanned yet" hint="The item appears here with what you can do next." />
            ) : current.result.kind === 'asset' ? (
              <AssetResult id={current.result.asset.id} />
            ) : current.result.kind === 'stock' ? (
              <StockResult id={current.result.item.id} />
            ) : (
              <EmptyState
                icon={<PackageSearch size={28} />}
                title={`${current.result.code} is not in the register`}
                hint={can('asset.create') ? 'If this is a new label, add the asset and keep this tag.' : 'Ask an editor to add it.'}
              />
            )}
          </Card>
          {reads.length > 1 && (
            <Card>
              <CardHeader title="This session" meta={`${reads.length} reads`} />
              <ol className={styles.reads}>
                {reads.slice(1).map((r, i) => (
                  <li key={`${r.at}-${i}`}>
                    <span className={styles.code}>{r.result.kind === 'asset' ? r.result.asset.tag : r.result.kind === 'stock' ? r.result.item.sku : r.result.code}</span>
                    <span className={styles.readName}>{r.result.kind === 'asset' ? r.result.asset.name : r.result.kind === 'stock' ? r.result.item.name : 'Not in the register'}</span>
                    <time>{timeOfDay(r.at)}</time>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
