import { useState } from 'react';
import { ArrowLeftRight, Pencil, Printer, SearchX, Undo2 } from 'lucide-react';
import { Banner, Button, Card, CardHeader, EmptyState, Form, Modal, PrintPortal, printNow, Row, SelectField, Text, TextField } from '../ui';
import { Link, navigate } from '../lib/router';
import { useToast } from '../lib/toast';
import { dueLabel, money, shortDate } from '../lib/format';
import { repo, useLookups, useMe, useQuery } from '../data/hooks';
import type { SaveResult } from '../data/repository';
import type { Asset } from '../data/types';
import { KeyValue, PersonChip, ScreenHeader, StatusPill } from '../app/bits';
import { AssetForm, type AssetDraft } from '../app/AssetForm';
import { AssetLabel } from '../app/AssetLabel';
import { Comments, History } from '../app/Discussion';
import styles from './Detail.module.css';

const draftOf = (a: Asset): AssetDraft => ({
  name: a.name,
  category: a.category,
  model: a.model,
  serial: a.serial,
  siteId: a.siteId,
  placeId: a.placeId,
  status: a.status,
  purchasedOn: a.purchasedOn,
  cost: a.cost,
  notes: a.notes,
});

function CheckOutDialog({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  const l = useLookups();
  const { me } = useMe();
  const toast = useToast();
  const week = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  const [who, setWho] = useState('');
  const [due, setDue] = useState(week);
  const people = l.peopleList.slice().sort((a, b) => a.name.localeCompare(b.name));
  return (
    <Modal title={`Check out ${asset.tag}`} size="sm" onClose={onClose}>
      <Form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!me || !who) return;
          const res = await repo().checkOut(asset.id, who, due, me.id);
          if (res.ok) toast.push(`Checked out to ${l.people.get(who)?.name}`);
          else toast.push(res.reason === 'conflict' ? 'Someone changed it first' : res.message, 'error');
          onClose();
        }}
      >
        <SelectField label="To" value={who} onChange={(e) => setWho(e.target.value)} options={[{ value: '', label: 'Choose a person' }, ...people.map((p) => ({ value: p.id, label: `${p.name}, ${p.team}` }))]} required />
        <TextField label="Due back" type="date" value={due} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDue(e.target.value)} required />
        <Row justify="end">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!who}>
            Check out
          </Button>
        </Row>
      </Form>
    </Modal>
  );
}

function ConflictDialog({ mine, theirs, onKeepTheirs, onUseMine }: { mine: AssetDraft; theirs: Asset; onKeepTheirs: () => void; onUseMine: () => void }) {
  const l = useLookups();
  const who = l.people.get(theirs.updatedBy)?.name ?? 'Someone';
  const keys = (Object.keys(mine) as (keyof AssetDraft)[]).filter((k) => (mine[k] ?? '') !== (theirs[k] ?? ''));
  const show = (k: keyof AssetDraft, v: unknown) => (k === 'siteId' ? l.sites.get(String(v))?.name : k === 'placeId' ? l.places.get(String(v))?.name : v == null || v === '' ? 'empty' : String(v));
  return (
    <Modal title="Someone else saved this first" size="md" onClose={onKeepTheirs}>
      <div className={styles.conflict}>
        <Text tone="secondary">
          {who} changed {theirs.tag} while you were editing. Nothing was overwritten. Choose which version to keep.
        </Text>
        <table className={styles.diff}>
          <thead>
            <tr>
              <th>Field</th>
              <th>Theirs (saved)</th>
              <th>Yours</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k}>
                <td>{k}</td>
                <td>{show(k, theirs[k])}</td>
                <td>{show(k, mine[k])}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Row justify="end">
          <Button variant="secondary" onClick={onKeepTheirs}>
            Keep theirs
          </Button>
          <Button onClick={onUseMine}>Save mine over theirs</Button>
        </Row>
      </div>
    </Modal>
  );
}

export default function AssetDetail({ params }: { params: Record<string, string> }) {
  const l = useLookups();
  const { me, can } = useMe();
  const toast = useToast();
  const ws = useQuery((r) => r.workspace(), []);
  const found = useQuery((r) => r.asset(params.id), [params.id]);
  const [editing, setEditing] = useState<{ version: number } | null>(null);
  const [conflict, setConflict] = useState<{ mine: AssetDraft; theirs: Asset } | null>(null);
  const [checkout, setCheckout] = useState(false);
  const [printing, setPrinting] = useState(false);

  const a = found.data;
  if (found.loading && !a) return null;
  if (!a) {
    return (
      <Card>
        <EmptyState icon={<SearchX size={28} />} title={`No asset with the tag ${params.id}`} hint="It may have been retired, or the label belongs to another workspace." action={{ label: 'Back to assets', onClick: () => navigate('/app/assets') }} />
      </Card>
    );
  }

  const site = l.sites.get(a.siteId);
  const place = a.placeId ? l.places.get(a.placeId) : undefined;

  async function save(draft: AssetDraft, version: number) {
    if (!me || !a) return;
    const res: SaveResult<Asset> = await repo().updateAsset(a.id, draft, version, me.id);
    if (res.ok) {
      setEditing(null);
      setConflict(null);
      toast.push('Saved');
    } else if (res.reason === 'conflict') setConflict({ mine: draft, theirs: res.current });
    else toast.push(res.message, 'error');
  }

  return (
    <div className={styles.page}>
      <ScreenHeader
        eyebrow={
          <>
            <Link href="/app/assets">Assets</Link> / <span>{a.tag}</span>
          </>
        }
        title={a.name}
        subtitle={[a.category, site?.name, place?.name].filter(Boolean).join(' · ')}
        actions={
          <>
            {can('asset.custody') &&
              (a.status === 'checked_out' ? (
                <Button
                  variant="secondary"
                  icon={<Undo2 size={16} />}
                  onClick={async () => {
                    if (!me) return;
                    const res = await repo().checkIn(a.id, me.id);
                    toast.push(res.ok ? 'Checked in' : 'Could not check in', res.ok ? 'ok' : 'error');
                  }}
                >
                  Check in
                </Button>
              ) : (
                <Button variant="secondary" icon={<ArrowLeftRight size={16} />} onClick={() => setCheckout(true)} disabled={a.status === 'retired' || a.status === 'missing'}>
                  Check out
                </Button>
              ))}
            {can('asset.edit') && !editing && (
              <Button icon={<Pencil size={16} />} onClick={() => setEditing({ version: a.version })}>
                Edit
              </Button>
            )}
          </>
        }
      />

      <div className={styles.grid}>
        <div className={styles.mainCol}>
          <Card>
            <CardHeader title="Details" meta={`Version ${a.version} · updated ${shortDate(a.updatedAt)} by ${l.people.get(a.updatedBy)?.name ?? 'someone'}`} />
            {editing ? (
              <>
                {editing.version !== a.version && (
                  <div className={styles.notice}>
                    <Banner tone="warning">Someone saved a newer version while you were editing. Saving will ask which one to keep.</Banner>
                  </div>
                )}
                <AssetForm initial={draftOf(a)} submitLabel="Save changes" onCancel={() => setEditing(null)} onSubmit={(d) => save(d, editing.version)} />
              </>
            ) : (
              <KeyValue
                items={[
                  { label: 'Tag', value: <span className={styles.mono}>{a.tag}</span> },
                  { label: 'Status', value: <StatusPill status={a.status} /> },
                  { label: 'Category', value: a.category },
                  { label: 'Model', value: a.model },
                  { label: 'Serial number', value: a.serial && <span className={styles.mono}>{a.serial}</span> },
                  { label: 'Site', value: site && <Link href={`/app/sites/${site.id}`}>{site.name}</Link> },
                  { label: 'Room or store', value: place?.name },
                  { label: 'Purchased', value: shortDate(a.purchasedOn) },
                  { label: 'Cost', value: money(a.cost) },
                  { label: 'Notes', value: a.notes },
                ]}
              />
            )}
          </Card>
          <Comments targetType="asset" targetId={a.id} />
          <History targetType="asset" targetId={a.id} />
        </div>

        <div className={styles.sideCol}>
          <Card>
            <CardHeader title="Custody" />
            {a.status === 'checked_out' ? (
              <div className={styles.custody}>
                <PersonChip person={l.people.get(a.custodianId ?? '')} detail={l.people.get(a.custodianId ?? '')?.team} />
                <Text tone={a.dueBack && a.dueBack < new Date().toISOString().slice(0, 10) ? 'danger' : 'secondary'}>Checked out, {dueLabel(a.dueBack)}</Text>
              </div>
            ) : a.custodianId ? (
              <div className={styles.custody}>
                <PersonChip person={l.people.get(a.custodianId)} detail="Assigned for everyday use" />
              </div>
            ) : (
              <Text tone="secondary">In the {place?.name ?? 'site'}; nobody has it out.</Text>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Label"
              action={
                can('labels.print') && (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Printer size={14} />}
                    onClick={() => {
                      setPrinting(true);
                      printNow();
                      if (me) repo().logLabelsPrinted([a.id], me.id);
                      window.setTimeout(() => setPrinting(false), 1500);
                    }}
                  >
                    Print
                  </Button>
                )
              }
            />
            <div className={styles.labelWrap}>
              <AssetLabel asset={a} org={ws.data?.name ?? ''} />
            </div>
            <Text variant="caption" tone="secondary">
              Any phone camera can scan it and open this page. Prints at 62 × 40 mm.
            </Text>
          </Card>
        </div>
      </div>

      {checkout && <CheckOutDialog asset={a} onClose={() => setCheckout(false)} />}
      {conflict && (
        <ConflictDialog
          mine={conflict.mine}
          theirs={conflict.theirs}
          onKeepTheirs={() => {
            setConflict(null);
            setEditing(null);
            toast.push('Kept their version');
          }}
          onUseMine={() => save(conflict.mine, conflict.theirs.version)}
        />
      )}
      {printing && (
        <PrintPortal paper="label">
          <AssetLabel asset={a} org={ws.data?.name ?? ''} size="print" />
        </PrintPortal>
      )}
    </div>
  );
}
