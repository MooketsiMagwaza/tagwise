import { useState } from 'react';
import { Download, RotateCcw, UserPlus } from 'lucide-react';
import { Avatar, Banner, Button, Card, CardHeader, ConfirmDialog, Form, Modal, Row, Segmented, SegmentedLinks, SelectField, Switch, Text, TextField } from '../ui';
import { useLocation } from '../lib/router';
import { useToast } from '../lib/toast';
import { relativeTime } from '../lib/format';
import { downloadBlob } from '../lib/csv';
import { repo, setMe, setSimulatedTeammates, useLookups, useMe, useQuery, useSimulatedTeammates } from '../data/hooks';
import { ROLE_LABEL, ROLE_SUMMARY, ROLES } from '../data/permissions';
import type { Role } from '../data/types';
import { setAppearance, useAppearance, type Density, type MotionPref, type ThemePref } from '../theme';
import { ScreenHeader } from '../app/bits';
import styles from './Settings.module.css';

const SECTIONS = [
  { href: '/app/settings', label: 'Workspace' },
  { href: '/app/settings/people', label: 'People and roles' },
  { href: '/app/settings/appearance', label: 'Appearance' },
  { href: '/app/settings/data', label: 'Data' },
];

function WorkspaceSection() {
  const { me, can } = useMe();
  const toast = useToast();
  const ws = useQuery((r) => r.workspace(), []);
  const [name, setName] = useState<string | null>(null);
  if (!ws.data) return null;
  return (
    <Card>
      <CardHeader title="Workspace" />
      <Form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!me || !name?.trim()) return;
          await repo().renameWorkspace(name, me.id);
          setName(null);
          toast.push('Workspace renamed');
        }}
      >
        <TextField label="Name" value={name ?? ws.data.name} onChange={(e) => setName(e.target.value)} disabled={!can('workspace.manage')} hint={can('workspace.manage') ? undefined : 'Only the owner can rename the workspace.'} />
        <TextField label="Tag prefix" value={ws.data.tagPrefix} readOnly hint="New assets get the next number after this prefix, for example MCT-00127." />
        <TextField label="Currency" value="Botswana pula (BWP)" readOnly />
        {can('workspace.manage') && (
          <Row justify="end">
            <Button type="submit" disabled={!name?.trim() || name === ws.data.name}>
              Save
            </Button>
          </Row>
        )}
      </Form>
    </Card>
  );
}

function PeopleSection() {
  const l = useLookups();
  const { me, can } = useMe();
  const toast = useToast();
  const [inviting, setInviting] = useState(false);
  const [draft, setDraft] = useState({ name: '', email: '', role: 'editor' as Role });
  const members = l.peopleList.filter((p) => p.role);
  const owners = members.filter((p) => p.role === 'owner').length;
  const custodians = l.peopleList.length - members.length;

  return (
    <>
      <Card>
        <CardHeader title="You are acting as" />
        <div className={styles.stack}>
          <Text tone="secondary">The prototype has no sign-in. Pick a sample member to see the workspace through their role: a viewer cannot edit, an auditor can run counts but not change the register.</Text>
          <SelectField
            label="Member"
            value={me?.id ?? ''}
            onChange={(e) => {
              setMe(e.target.value);
              toast.push(`Now acting as ${l.people.get(e.target.value)?.name}`);
            }}
            options={members.map((p) => ({ value: p.id, label: `${p.name} · ${ROLE_LABEL[p.role!]}` }))}
          />
        </div>
      </Card>

      <Card padding="none">
        <div className={styles.tableHead}>
          <CardHeader
            title="Members"
            meta={`${members.length} members · ${custodians} more people are custodians without an account`}
            action={
              can('members.manage') && (
                <Button size="sm" icon={<UserPlus size={14} />} onClick={() => setInviting(true)}>
                  Invite
                </Button>
              )
            }
          />
        </div>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">Role</th>
                <th scope="col">Last active</th>
              </tr>
            </thead>
            <tbody>
              {members.map((p) => (
                <tr key={p.id}>
                  <th scope="row">
                    <span className={styles.person}>
                      <Avatar initials={p.initials} hue={p.hue} />
                      <span>
                        {p.name}
                        {p.id === me?.id && <span className={styles.you}> (you)</span>}
                        <span className={styles.team}>{p.team}</span>
                      </span>
                    </span>
                  </th>
                  <td>{p.email}</td>
                  <td>
                    {can('members.manage') && !(p.role === 'owner' && owners === 1) ? (
                      <select
                        className={styles.select}
                        aria-label={`Role for ${p.name}`}
                        value={p.role}
                        onChange={async (e) => {
                          if (!me) return;
                          await repo().setRole(p.id, e.target.value as Role, me.id);
                          toast.push(`${p.name} is now ${ROLE_LABEL[e.target.value as Role].toLowerCase()}`);
                        }}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      ROLE_LABEL[p.role!]
                    )}
                  </td>
                  <td className={styles.muted}>{relativeTime(p.lastActiveAt) || 'Invited'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader title="What each role can do" />
        <dl className={styles.roles}>
          {ROLES.map((r) => (
            <div key={r}>
              <dt>{ROLE_LABEL[r]}</dt>
              <dd>{ROLE_SUMMARY[r]}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {inviting && (
        <Modal title="Invite a member" size="sm" onClose={() => setInviting(false)}>
          <Form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!me) return;
              const p = await repo().invite({ ...draft, team: 'Invited' }, me.id);
              toast.push(`${p.name} added as ${ROLE_LABEL[draft.role].toLowerCase()}`);
              setInviting(false);
              setDraft({ name: '', email: '', role: 'editor' });
            }}
          >
            <Banner tone="info">No email is sent: the prototype has no server. The person is added to this browser's sample workspace only.</Banner>
            <TextField label="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required autoFocus />
            <TextField label="Email" type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} required hint="Use a made-up address, for example someone@morula.example." />
            <SelectField label="Role" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as Role })} options={ROLES.filter((r) => r !== 'owner').map((r) => ({ value: r, label: `${ROLE_LABEL[r]}: ${ROLE_SUMMARY[r]}` }))} />
            <Row justify="end">
              <Button variant="secondary" onClick={() => setInviting(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!draft.name.trim() || !draft.email.trim()}>
                Add member
              </Button>
            </Row>
          </Form>
        </Modal>
      )}
    </>
  );
}

function AppearanceSection() {
  const a = useAppearance();
  const sim = useSimulatedTeammates();
  return (
    <Card>
      <CardHeader title="Appearance" />
      <div className={styles.stack}>
        <div className={styles.setting}>
          <Text weight="medium">Theme</Text>
          <Segmented<ThemePref>
            label="Theme"
            value={a.theme}
            onChange={(theme) => setAppearance({ ...a, theme })}
            options={[
              { value: 'system', label: 'Match the device' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </div>
        <div className={styles.setting}>
          <Text weight="medium">Table rows</Text>
          <Segmented<Density>
            label="Table density"
            value={a.density}
            onChange={(density) => setAppearance({ ...a, density })}
            options={[
              { value: 'comfortable', label: 'Comfortable' },
              { value: 'compact', label: 'Compact' },
            ]}
          />
        </div>
        <div className={styles.setting}>
          <Text weight="medium">Motion</Text>
          <Segmented<MotionPref>
            label="Motion"
            value={a.motion}
            onChange={(motion) => setAppearance({ ...a, motion })}
            options={[
              { value: 'system', label: 'Match the device' },
              { value: 'reduce', label: 'Reduce' },
            ]}
          />
        </div>
        <Switch
          label="Show simulated teammates"
          description="Sample members shown as present on pages (dashed ring), so the shared workspace reads as shared in a one-person demo. Your own other tabs are always shown."
          checked={sim}
          onChange={setSimulatedTeammates}
        />
      </div>
    </Card>
  );
}

function DataSection() {
  const { can } = useMe();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  return (
    <Card>
      <CardHeader title="Data" />
      <div className={styles.stack}>
        <Text tone="secondary">
          Everything in this workspace is sample data kept in this browser's local storage. Nothing is sent to a server, and other people (or other browsers) do not see your changes. Clearing the browser's site data removes it.
        </Text>
        <Row wrap>
          <Button
            variant="secondary"
            icon={<Download size={16} />}
            onClick={async () => {
              const r = repo();
              const dump = {
                exportedAt: new Date().toISOString(),
                note: 'Tagwise sample workspace. Every name and figure is invented.',
                workspace: await r.workspace(),
                people: await r.people(),
                sites: await r.sites(),
                places: await r.places(),
                assets: await r.assets(),
                stock: await r.stock(),
                counts: await r.counts(),
                activity: await r.activity(),
              };
              downloadBlob(new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' }), 'tagwise-workspace.json');
              toast.push('Downloaded the workspace as JSON');
            }}
          >
            Download everything (JSON)
          </Button>
          {can('workspace.manage') && (
            <Button variant="secondary" icon={<RotateCcw size={16} />} onClick={() => setConfirm(true)}>
              Reset the sample workspace
            </Button>
          )}
        </Row>
      </div>
      {confirm && (
        <ConfirmDialog
          title="Reset the sample workspace?"
          message="Your changes in this browser are replaced by a fresh copy of the sample trust. Other tabs reset too."
          confirmLabel="Reset"
          tone="danger"
          onCancel={() => setConfirm(false)}
          onConfirm={async () => {
            await repo().reset();
            setConfirm(false);
            toast.push('Sample workspace reset');
          }}
        />
      )}
    </Card>
  );
}

export default function Settings() {
  const { path } = useLocation();
  const section = SECTIONS.find((s) => s.href === path) ?? SECTIONS[0];
  return (
    <div className={styles.page}>
      <ScreenHeader title="Settings" />
      <SegmentedLinks label="Settings sections" items={SECTIONS.map((s) => ({ ...s, current: s.href === section.href }))} />
      <div className={styles.body}>
        {section.href === '/app/settings' && <WorkspaceSection />}
        {section.href === '/app/settings/people' && <PeopleSection />}
        {section.href === '/app/settings/appearance' && <AppearanceSection />}
        {section.href === '/app/settings/data' && <DataSection />}
      </div>
    </div>
  );
}
