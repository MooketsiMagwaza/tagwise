import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { Avatar, Button, Card, CardHeader, Form, Row } from '../ui';
import { relativeTime } from '../lib/format';
import { repo, useLookups, useMe, useQuery } from '../data/hooks';
import type { Comment } from '../data/types';
import { ActivityLine } from './ActivityLine';
import styles from './Discussion.module.css';

/** Comments on an item, with a box to add one. */
export function Comments({ targetType, targetId }: { targetType: Comment['targetType']; targetId: string }) {
  const l = useLookups();
  const { me, can } = useMe();
  const comments = useQuery((r) => r.comments(targetType, targetId), [targetType, targetId]);
  const [body, setBody] = useState('');
  const list = comments.data ?? [];

  return (
    <Card>
      <CardHeader title="Comments" meta={list.length ? String(list.length) : undefined} />
      {list.length === 0 && (
        <p className={styles.empty}>
          <MessageSquare size={16} aria-hidden="true" /> No comments yet.
        </p>
      )}
      <ol className={styles.list}>
        {list.map((c) => {
          const who = l.people.get(c.authorId);
          return (
            <li key={c.id} className={styles.comment}>
              <Avatar initials={who?.initials ?? '?'} hue={who?.hue} />
              <div className={styles.bubble}>
                <p className={styles.meta}>
                  <strong>{who?.name ?? 'Someone'}</strong> <span>{relativeTime(c.createdAt)}</span>
                </p>
                <p className={styles.body}>{c.body}</p>
              </div>
            </li>
          );
        })}
      </ol>
      {me && can('comment') && (
        <Form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!body.trim()) return;
            await repo().addComment(targetType, targetId, body, me.id);
            setBody('');
          }}
        >
          <label className={styles.composer}>
            <span className={styles.srOnly}>Add a comment</span>
            <textarea
              className={styles.textarea}
              placeholder="Add a comment. Everyone in the workspace can read it."
              value={body}
              rows={2}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
              }}
            />
          </label>
          <Row justify="end">
            <Button type="submit" size="sm" disabled={!body.trim()}>
              Comment
            </Button>
          </Row>
        </Form>
      )}
    </Card>
  );
}

/** Everything that happened to one item, newest first. */
export function History({ targetType, targetId }: { targetType: 'asset' | 'stock' | 'count'; targetId: string }) {
  const l = useLookups();
  const activity = useQuery((r) => r.activity({ targetType, targetId }), [targetType, targetId]);
  const list = (activity.data ?? []).filter((a) => a.kind !== 'commented');
  return (
    <Card>
      <CardHeader title="History" meta={list.length ? `${list.length} events` : undefined} />
      {list.length === 0 ? (
        <p className={styles.empty}>Nothing recorded yet.</p>
      ) : (
        <ol className={styles.list}>
          {list.map((a) => (
            <ActivityLine key={a.id} activity={a} people={l.people} />
          ))}
        </ol>
      )}
    </Card>
  );
}
