import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Download, Lock, SearchX } from 'lucide-react';
import { Avatar, Banner, Button, Card, CardHeader, ConfirmDialog, EmptyState, Pill, SelectField, Switch, Text } from '../ui';
import { Link, navigate } from '../lib/router';
import { useToast } from '../lib/toast';
import { relativeTime, shortDate, timeOfDay } from '../lib/format';
import { downloadXlsx } from '../lib/sheet';
import { repo, useLookups, useMe, useQuery } from '../data/hooks';
import type { CountScan, ScanResult } from '../data/types';
import { Progress, ScreenHeader } from '../app/bits';
import { Scanner } from '../app/scan/Scanner';
import { countStats } from './Counts';
import styles from './Counts.module.css';

const RESULT_TEXT: Record<ScanResult, string> = {
  found: 'Found',
  wrong_place: 'Found, but in the wrong room',
  unexpected: 'Not expected at this site',
  unknown: 'Not in the register',
  repeat: 'Already counted',
};
const RESULT_CLASS: Record<ScanResult, string> = { found: styles.found, wrong_place: styles.wrong, unexpected: styles.other, unknown: styles.other, repeat: styles.repeat };

export default function CountBoard({ params }: { params: Record<string, string> }) {
  const l = useLookups();
  const { me, can } = useMe();
  const toast = useToast();
  const ws = useQuery((r) => r.workspace(), []);
  const detail = useQuery((r) => r.count(params.id), [params.id]);
  const assets = useQuery((r) => r.assets(), []);
  const [room, setRoom] = useState('');
  const [last, setLast] = useState<CountScan | null>(null);
  const [closing, setClosing] = useState(false);
  const [markMissing, setMarkMissing] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const simRef = useRef<number | null>(null);

  const session = detail.data?.session;
  const scans = useMemo(() => detail.data?.scans ?? [], [detail.data]);
  const byId = useMemo(() => new Map((assets.data ?? []).map((a) => [a.id, a])), [assets.data]);
  const stats = session ? countStats(session, scans) : null;
  const foundIds = new Set(scans.filter((s) => s.result === 'found' || s.result === 'wrong_place').map((s) => s.assetId));
  const notFound = (session?.expected ?? []).filter((e) => !foundIds.has(e.assetId));
  const rooms = Array.from(l.places.values()).filter((p) => p.siteId === session?.siteId && (!session?.placeIds.length || session.placeIds.includes(p.id)));
  const open = session?.status === 'open';

  // The simulated second counter: a sample teammate "scans" one of the
  // not-yet-found items every few seconds while this page is open. Its
  // scans are real writes, made by this browser, and labelled as simulated.
  useEffect(() => {
    if (!simulating || !session || !open) return;
    const counter = ['p-onalenna', 'p-naledi', 'p-tumelo'].find((p) => p !== me?.id) ?? 'p-naledi';
    simRef.current = window.setInterval(async () => {
      const d = await repo().count(session.id);
      if (!d) return;
      const seen = new Set(d.scans.filter((s) => s.assetId).map((s) => s.assetId));
      const next = d.session.expected.find((e) => !seen.has(e.assetId));
      if (!next) {
        setSimulating(false);
        return;
      }
      const a = await repo().asset(next.assetId);
      if (a) await repo().recordScan(session.id, a.tag, a.placeId, counter);
    }, 2600);
    return () => {
      if (simRef.current) window.clearInterval(simRef.current);
    };
  }, [simulating, session, open, me?.id]);

  if (detail.loading && !detail.data) return null;
  if (!session || !stats) {
    return (
      <Card>
        <EmptyState icon={<SearchX size={28} />} title="No such stock-take" action={{ label: 'All stock-takes', onClick: () => navigate('/app/counts') }} />
      </Card>
    );
  }

  async function onScan(code: string) {
    if (!me || !session) return;
    const scan = await repo().recordScan(session.id, code, room || undefined, me.id);
    setLast(scan);
  }

  async function exportVariance() {
    if (!session) return;
    const rows: unknown[][] = [['Tag', 'Name', 'Expected room', 'Result', 'Counted in', 'Counted by', 'Counted at']];
    for (const e of session.expected) {
      const a = byId.get(e.assetId);
      const s = scans.find((x) => x.assetId === e.assetId && x.result !== 'repeat');
      rows.push([
        a?.tag ?? '',
        a?.name ?? '',
        e.placeId ? l.places.get(e.placeId)?.name ?? '' : '',
        s ? RESULT_TEXT[s.result] : 'Not found',
        s?.placeId ? l.places.get(s.placeId)?.name ?? '' : '',
        s ? l.people.get(s.by)?.name ?? '' : '',
        s ? `${shortDate(s.at)} ${timeOfDay(s.at)}` : '',
      ]);
    }
    for (const s of scans.filter((x) => x.result === 'unexpected' || x.result === 'unknown')) {
      rows.push([s.code, byId.get(s.assetId ?? '')?.name ?? '', '', RESULT_TEXT[s.result], s.placeId ? l.places.get(s.placeId)?.name ?? '' : '', l.people.get(s.by)?.name ?? '', `${shortDate(s.at)} ${timeOfDay(s.at)}`]);
    }
    await downloadXlsx(rows, `${session.name.replace(/[^\w-]+/g, '-').toLowerCase()}-variance.xlsx`, 'Variance');
    toast.push('Variance report exported');
  }

  return (
    <div className={styles.page}>
      <ScreenHeader
        eyebrow={
          <>
            <Link href="/app/counts">Stock-takes</Link> / <span>{l.sites.get(session.siteId)?.name}</span>
          </>
        }
        title={session.name}
        subtitle={`Started ${relativeTime(session.startedAt)} by ${l.people.get(session.startedBy)?.name}${session.closedAt ? ` · closed ${shortDate(session.closedAt)}` : ''} · ${session.placeIds.length ? `${session.placeIds.length} rooms` : 'whole site'}`}
        actions={
          <>
            {can('export') && (
              <Button variant="secondary" icon={<Download size={16} />} onClick={exportVariance}>
                Variance report
              </Button>
            )}
            {open && can('count.manage') && (
              <Button icon={<Lock size={16} />} onClick={() => setClosing(true)}>
                Close
              </Button>
            )}
          </>
        }
      />

      <Card>
        <div className={styles.itemHead}>
          <Text variant="body">
            <strong>{stats.found}</strong> of {stats.expected} found · {notFound.length} still to find
          </Text>
          <Pill tone={open ? 'brand' : 'neutral'} dot>
            {open ? 'In progress, updating live' : 'Closed'}
          </Pill>
        </div>
        <Progress value={stats.found} max={stats.expected} label="Found so far" tone={open ? 'brand' : 'success'} />
        <div className={styles.figures}>
          <div className={styles.figure}>
            <strong>{stats.found}</strong>
            <span>found</span>
          </div>
          <div className={styles.figure}>
            <strong>{notFound.length}</strong>
            <span>{open ? 'to find' : 'not found'}</span>
          </div>
          <div className={styles.figure}>
            <strong>{stats.wrongPlace}</strong>
            <span>wrong room</span>
          </div>
          <div className={styles.figure}>
            <strong>{stats.unexpected}</strong>
            <span>unexpected</span>
          </div>
        </div>
      </Card>

      <div className={styles.board}>
        <div className={styles.col}>
          {open && can('count.run') ? (
            <Card>
              <CardHeader title="Scan into this count" />
              <div className={styles.col}>
                <SelectField label="I am counting in" value={room} onChange={(e) => setRoom(e.target.value)} options={[{ value: '', label: 'Any room (no room check)' }, ...rooms.map((p) => ({ value: p.id, label: p.name }))]} />
                <Scanner onScan={onScan} hint="Scan each label once. Repeats are recognised." />
                {last && (
                  <div className={`${styles.feedback} ${RESULT_CLASS[last.result]}`} role="status">
                    <strong>{RESULT_TEXT[last.result]}</strong> · {byId.get(last.assetId ?? '')?.name ?? last.code}
                  </div>
                )}
              </div>
            </Card>
          ) : (
            open && (
              <Card>
                <Text tone="secondary">Your role can watch this count but not scan into it.</Text>
              </Card>
            )
          )}
          {open && (
            <Card>
              <div className={styles.sim}>
                <div>
                  <Text weight="medium">
                    <Bot size={15} /> Simulated second counter
                  </Text>
                  <Text variant="caption" tone="secondary">
                    A sample teammate scans the next item every few seconds, from this browser, so you can watch the board update. Open this page in a second tab to see real two-tab updates.
                  </Text>
                </div>
                <Switch label={simulating ? 'On' : 'Off'} checked={simulating} onChange={setSimulating} />
              </div>
            </Card>
          )}
          <Card>
            <CardHeader title="By room" />
            <table className={styles.rooms2}>
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Progress</th>
                  <th>Found</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((p) => {
                  const exp = session.expected.filter((e) => e.placeId === p.id);
                  const got = exp.filter((e) => foundIds.has(e.assetId)).length;
                  return (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>
                        <Progress value={got} max={exp.length} label={`${p.name} progress`} tone={got === exp.length && exp.length ? 'success' : 'brand'} />
                      </td>
                      <td>
                        {got} / {exp.length}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </div>

        <div className={styles.col}>
          <Card>
            <CardHeader title="Scans" meta={`${scans.length} so far`} />
            {scans.length === 0 ? (
              <Text tone="secondary">No scans yet.</Text>
            ) : (
              <ol className={styles.feed}>
                {scans.slice(0, 60).map((s) => {
                  const p = l.people.get(s.by);
                  const a = byId.get(s.assetId ?? '');
                  return (
                    <li key={s.id}>
                      <Avatar initials={p?.initials ?? '?'} hue={p?.hue} size="sm" label={p?.name} />
                      <span className={styles.feedText}>
                        <span className={styles.mono}>{s.code}</span> {a?.name ?? ''} · <span className={RESULT_CLASS[s.result]}>{RESULT_TEXT[s.result]}</span>
                      </span>
                      <time dateTime={s.at}>{timeOfDay(s.at)}</time>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
          <Card>
            <CardHeader title={open ? 'Still to find' : 'Not found'} meta={String(notFound.length)} />
            {notFound.length === 0 ? (
              <Text tone="secondary">Everything expected has been found.</Text>
            ) : (
              <ul className={styles.missingList}>
                {notFound.map((e) => {
                  const a = byId.get(e.assetId);
                  return (
                    <li key={e.assetId}>
                      <span className={styles.mono}>{a?.tag}</span>
                      <Link href={`/app/assets/${a?.tag}`}>{a?.name}</Link>
                      <Text as="span" variant="caption" tone="secondary">
                        {e.placeId ? l.places.get(e.placeId)?.name : ''}
                      </Text>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {open && (
        <Banner tone="info">
          Updates between tabs in this browser are live. Live updates between different devices need the server, which is not built yet. Workspace: {ws.data?.name}.
        </Banner>
      )}

      {closing && (
        <ConfirmDialog
          title="Close this stock-take?"
          message={
            <>
              {notFound.length} of {stats.expected} items were not found.
              <br />
              <label>
                <input type="checkbox" checked={markMissing} onChange={(e) => setMarkMissing(e.target.checked)} /> Mark them as missing in the register
              </label>
            </>
          }
          confirmLabel="Close the stock-take"
          onCancel={() => setClosing(false)}
          onConfirm={async () => {
            if (!me) return;
            setSimulating(false);
            await repo().closeCount(session.id, markMissing, me.id);
            setClosing(false);
            toast.push('Stock-take closed');
          }}
        />
      )}
    </div>
  );
}
