import { useState } from 'react';
import { ClipboardCheck, Plus } from 'lucide-react';
import { Avatar, Button, Card, EmptyState, Form, Modal, Pill, Row, SelectField, Text, TextField } from '../ui';
import { Link, navigate } from '../lib/router';
import { relativeTime, shortDate } from '../lib/format';
import { repo, useLookups, useMe, useQuery } from '../data/hooks';
import { Progress, ScreenHeader } from '../app/bits';
import type { CountScan, CountSession } from '../data/types';
import styles from './Counts.module.css';

export function countStats(session: CountSession, scans: CountScan[]) {
  const counted = scans.filter((s) => s.countId === session.id);
  const found = new Set(counted.filter((s) => s.result === 'found' || s.result === 'wrong_place').map((s) => s.assetId));
  return {
    expected: session.expected.length,
    found: found.size,
    wrongPlace: counted.filter((s) => s.result === 'wrong_place').length,
    unexpected: counted.filter((s) => s.result === 'unexpected' || s.result === 'unknown').length,
    counters: Array.from(new Set(counted.map((s) => s.by))),
  };
}

function StartCount({ onClose }: { onClose: () => void }) {
  const l = useLookups();
  const { me } = useMe();
  const sites = Array.from(l.sites.values());
  const [siteId, setSiteId] = useState(sites[0]?.id ?? '');
  const [rooms, setRooms] = useState<string[]>([]);
  const site = l.sites.get(siteId);
  const [name, setName] = useState('');
  const places = Array.from(l.places.values()).filter((p) => p.siteId === siteId);
  return (
    <Modal title="Start a stock-take" size="md" onClose={onClose}>
      <Form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!me || !siteId) return;
          const session = await repo().startCount({ name: name.trim() || `${site?.name}, ${shortDate(new Date().toISOString())}`, siteId, placeIds: rooms }, me.id);
          navigate(`/app/counts/${session.id}`);
        }}
      >
        <SelectField
          label="Site"
          value={siteId}
          onChange={(e) => {
            setSiteId(e.target.value);
            setRooms([]);
          }}
          options={sites.map((s) => ({ value: s.id, label: s.name }))}
        />
        <TextField label="Name" placeholder={`${site?.name ?? ''}, ${shortDate(new Date().toISOString())}`} value={name} onChange={(e) => setName(e.target.value)} />
        <fieldset className={styles.rooms}>
          <legend>Rooms to count (none ticked means the whole site)</legend>
          {places.map((p) => (
            <label key={p.id} className={styles.room}>
              <input type="checkbox" checked={rooms.includes(p.id)} onChange={(e) => setRooms(e.target.checked ? [...rooms, p.id] : rooms.filter((r) => r !== p.id))} />
              {p.name}
            </label>
          ))}
        </fieldset>
        <Text variant="caption" tone="secondary">
          The expected list is taken now from the register (everything at the site except retired and checked-out items). Several people can then scan at once.
        </Text>
        <Row justify="end">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Start</Button>
        </Row>
      </Form>
    </Modal>
  );
}

export default function Counts() {
  const l = useLookups();
  const { can } = useMe();
  const counts = useQuery((r) => r.counts(), []);
  const details = useQuery(async (r) => Promise.all((await r.counts()).map((c) => r.count(c.id))), []);
  const [starting, setStarting] = useState(false);
  const scans = (details.data ?? []).flatMap((d) => d?.scans ?? []);
  const list = (counts.data ?? []).slice().sort((a, b) => (a.status === b.status ? b.startedAt.localeCompare(a.startedAt) : a.status === 'open' ? -1 : 1));

  return (
    <div className={styles.page}>
      <ScreenHeader
        title="Stock-takes"
        subtitle="Count a site or a few rooms against the register, with as many people scanning at once as you like."
        actions={
          can('count.run') && (
            <Button icon={<Plus size={16} />} onClick={() => setStarting(true)}>
              Start a stock-take
            </Button>
          )
        }
      />
      {list.length === 0 ? (
        <Card>
          <EmptyState icon={<ClipboardCheck size={28} />} title="No stock-takes yet" />
        </Card>
      ) : (
        <ul className={styles.list}>
          {list.map((c) => {
            const s = countStats(c, scans);
            return (
              <li key={c.id}>
                <Link href={`/app/counts/${c.id}`} className={styles.item}>
                  <div className={styles.itemHead}>
                    <div>
                      <Text as="h2" variant="headline">
                        {c.name}
                      </Text>
                      <Text tone="secondary">
                        {l.sites.get(c.siteId)?.name} · {c.status === 'open' ? `started ${relativeTime(c.startedAt)}` : `closed ${shortDate(c.closedAt)}`} by {l.people.get(c.startedBy)?.name}
                      </Text>
                    </div>
                    <Pill tone={c.status === 'open' ? 'brand' : 'neutral'} dot>
                      {c.status === 'open' ? 'In progress' : 'Closed'}
                    </Pill>
                  </div>
                  <Progress value={s.found} max={s.expected} label={`${c.name} progress`} tone={c.status === 'open' ? 'brand' : 'success'} />
                  <div className={styles.itemFoot}>
                    <span>
                      <strong>{s.found}</strong> of {s.expected} found
                      {s.wrongPlace > 0 && ` · ${s.wrongPlace} in the wrong room`}
                      {c.status === 'closed' && s.expected - s.found > 0 && ` · ${s.expected - s.found} not found`}
                    </span>
                    <span className={styles.avatars}>
                      {s.counters.map((id) => {
                        const p = l.people.get(id);
                        return p ? <Avatar key={id} initials={p.initials} hue={p.hue} size="sm" label={p.name} /> : null;
                      })}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {starting && <StartCount onClose={() => setStarting(false)} />}
    </div>
  );
}
