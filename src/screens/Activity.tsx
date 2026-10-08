import { useMemo, useState } from 'react';
import { Button, Card, Row, Segmented, SelectField, Text } from '../ui';
import { useLookups, useQuery } from '../data/hooks';
import type { ActivityKind } from '../data/types';
import { ActivityLine } from '../app/ActivityLine';
import { ScreenHeader } from '../app/bits';
import styles from './Activity.module.css';

type Group = 'all' | 'edits' | 'custody' | 'comments' | 'stock' | 'counts';

const KINDS: Record<Exclude<Group, 'all'>, ActivityKind[]> = {
  edits: ['created', 'updated', 'moved', 'labels_printed', 'view_saved', 'member_changed'],
  custody: ['checked_out', 'returned'],
  comments: ['commented'],
  stock: ['stock_adjusted'],
  counts: ['count_started', 'count_closed', 'counted', 'imported'],
};

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function Activity() {
  const l = useLookups();
  const [group, setGroup] = useState<Group>('all');
  const [who, setWho] = useState('');
  const [limit, setLimit] = useState(60);
  const activity = useQuery((r) => r.activity({ kinds: group === 'all' ? undefined : KINDS[group], actorId: who || undefined }), [group, who]);
  const list = useMemo(() => activity.data ?? [], [activity.data]);
  const days = useMemo(() => {
    const out: { day: string; items: typeof list }[] = [];
    for (const a of list.slice(0, limit)) {
      const day = dayLabel(a.at);
      if (out[out.length - 1]?.day !== day) out.push({ day, items: [] });
      out[out.length - 1].items.push(a);
    }
    return out;
  }, [list, limit]);

  return (
    <div className={styles.page}>
      <ScreenHeader title="Activity" subtitle="Everything that happened in the workspace, newest first. Updates live." />
      <div className={styles.filters}>
        <Segmented<Group>
          label="Kind of activity"
          value={group}
          onChange={setGroup}
          options={[
            { value: 'all', label: 'All' },
            { value: 'edits', label: 'Edits' },
            { value: 'custody', label: 'In and out' },
            { value: 'comments', label: 'Comments' },
            { value: 'stock', label: 'Stock' },
            { value: 'counts', label: 'Counts and imports' },
          ]}
        />
        <div className={styles.person}>
          <SelectField
            label="Person"
            value={who}
            onChange={(e) => setWho(e.target.value)}
            options={[{ value: '', label: 'Everyone' }, ...l.peopleList.filter((p) => p.role).map((p) => ({ value: p.id, label: p.name }))]}
          />
        </div>
      </div>
      {days.length === 0 && (
        <Card>
          <Text tone="secondary">Nothing matches.</Text>
        </Card>
      )}
      {days.map((d) => (
        <section key={d.day} className={styles.day}>
          <Text as="h2" variant="small" weight="semibold" tone="secondary">
            {d.day}
          </Text>
          <Card padding="md">
            <ol className={styles.list}>
              {d.items.map((a) => (
                <ActivityLine key={a.id} activity={a} people={l.people} />
              ))}
            </ol>
          </Card>
        </section>
      ))}
      {list.length > limit && (
        <Row justify="center">
          <Button variant="secondary" onClick={() => setLimit(limit + 60)}>
            Show older ({list.length - limit} more)
          </Button>
        </Row>
      )}
    </div>
  );
}
