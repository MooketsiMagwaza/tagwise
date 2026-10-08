import { useState } from 'react';
import { Minus, Plus, SearchX } from 'lucide-react';
import { Barcode, Button, Card, CardHeader, EmptyState, Form, Row, Segmented, Text, TextField } from '../ui';
import { Link, navigate } from '../lib/router';
import { useToast } from '../lib/toast';
import { shortDate } from '../lib/format';
import { repo, useLookups, useMe, useQuery } from '../data/hooks';
import { KeyValue, ScreenHeader } from '../app/bits';
import { Expiry, Quantity } from '../app/register/cells';
import { Comments, History } from '../app/Discussion';
import styles from './Detail.module.css';

/** Receive or issue stock: a whole number and a reason, written to history. */
export function AdjustStock({ id, unit, onDone }: { id: string; unit: string; onDone?: () => void }) {
  const { me, can } = useMe();
  const toast = useToast();
  const [mode, setMode] = useState<'issue' | 'receive'>('issue');
  const [amount, setAmount] = useState('1');
  const [reason, setReason] = useState('');
  if (!can('stock.adjust')) return <Text tone="secondary">Your role can read stock levels but not change them.</Text>;
  return (
    <Form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!me) return;
        const n = Math.abs(Math.trunc(Number(amount)));
        const res = await repo().adjustStock(id, mode === 'issue' ? -n : n, reason.trim(), me.id);
        if (res.ok) {
          toast.push(`${mode === 'issue' ? 'Issued' : 'Received'} ${n} ${unit}; ${res.value.quantity} on hand`);
          setReason('');
          onDone?.();
        } else toast.push(res.reason === 'conflict' ? 'Changed by someone else; try again' : res.message, 'error');
      }}
    >
      <Segmented
        label="Issue or receive"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'issue', label: <><Minus size={14} /> Issue</> },
          { value: 'receive', label: <><Plus size={14} /> Receive</> },
        ]}
      />
      <TextField label={`How many (${unit})`} type="number" inputMode="numeric" min={1} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} required />
      <TextField label="Reason" placeholder={mode === 'issue' ? 'For example: Consulting room 2' : 'For example: Delivery note 4471'} value={reason} onChange={(e) => setReason(e.target.value)} />
      <Row justify="end">
        <Button type="submit" disabled={!Number(amount)}>
          {mode === 'issue' ? 'Issue' : 'Receive'}
        </Button>
      </Row>
    </Form>
  );
}

export default function StockDetail({ params }: { params: Record<string, string> }) {
  const l = useLookups();
  const item = useQuery((r) => r.stockItem(params.id), [params.id]);
  const k = item.data;
  if (item.loading && !k) return null;
  if (!k) {
    return (
      <Card>
        <EmptyState icon={<SearchX size={28} />} title="No such stock line" action={{ label: 'Back to stock', onClick: () => navigate('/app/stock') }} />
      </Card>
    );
  }
  const site = l.sites.get(k.siteId);
  return (
    <div className={styles.page}>
      <ScreenHeader
        eyebrow={
          <>
            <Link href="/app/stock">Stock</Link> / <span>{k.sku}</span>
          </>
        }
        title={k.name}
        subtitle={[k.category, site?.name, k.placeId && l.places.get(k.placeId)?.name].filter(Boolean).join(' · ')}
      />
      <div className={styles.grid}>
        <div className={styles.mainCol}>
          <Card>
            <CardHeader title="On hand" meta={`Updated ${shortDate(k.updatedAt)}`} />
            <div className={styles.qtyRow}>
              <Quantity qty={k.quantity} reorderAt={k.reorderAt} unit={k.unit} />
            </div>
            <KeyValue
              items={[
                { label: 'Reorder at', value: `${k.reorderAt} ${k.unit}` },
                { label: 'Batch', value: k.batch },
                { label: 'Expires', value: k.expiresOn && <Expiry date={k.expiresOn} /> },
                { label: 'Site', value: site && <Link href={`/app/sites/${site.id}`}>{site.name}</Link> },
              ]}
            />
          </Card>
          <Comments targetType="stock" targetId={k.id} />
          <History targetType="stock" targetId={k.id} />
        </div>
        <div className={styles.sideCol}>
          <Card>
            <CardHeader title="Issue or receive" />
            <AdjustStock id={k.id} unit={k.unit} />
          </Card>
          <Card>
            <CardHeader title="Barcode" />
            <div className={styles.barcodeWrap}>
              <Barcode value={k.barcode} format="EAN13" label={`EAN-13 barcode ${k.barcode}`} />
            </div>
            <Text variant="caption" tone="secondary">
              Scan this on the shelf to issue or receive without typing.
            </Text>
          </Card>
        </div>
      </div>
    </div>
  );
}
