// What each workspace role may do. The UI hides or disables what a role
// cannot do; the API will enforce the same table on the server.

import type { Role } from './types';

export type Action =
  | 'asset.create'
  | 'asset.edit'
  | 'asset.custody'
  | 'stock.adjust'
  | 'comment'
  | 'import'
  | 'export'
  | 'count.run'
  | 'count.manage'
  | 'labels.print'
  | 'views.save'
  | 'members.manage'
  | 'workspace.manage';

const ALL: Action[] = [
  'asset.create',
  'asset.edit',
  'asset.custody',
  'stock.adjust',
  'comment',
  'import',
  'export',
  'count.run',
  'count.manage',
  'labels.print',
  'views.save',
  'members.manage',
  'workspace.manage',
];

export const PERMISSIONS: Record<Role, Action[]> = {
  owner: ALL,
  admin: ALL.filter((a) => a !== 'workspace.manage'),
  editor: ['asset.create', 'asset.edit', 'asset.custody', 'stock.adjust', 'comment', 'import', 'export', 'count.run', 'labels.print', 'views.save'],
  auditor: ['comment', 'export', 'count.run', 'count.manage', 'views.save'],
  viewer: ['comment'],
};

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Owner',
  admin: 'Admin',
  editor: 'Editor',
  auditor: 'Auditor',
  viewer: 'Viewer',
};

export const ROLE_SUMMARY: Record<Role, string> = {
  owner: 'Everything, including workspace settings.',
  admin: 'Everything except workspace settings; manages members.',
  editor: 'Adds and edits assets and stock, checks things out, imports, prints labels.',
  auditor: 'Runs and closes stock-takes and exports reports. Cannot edit the register.',
  viewer: 'Reads the register and comments.',
};

export const ROLES: Role[] = ['owner', 'admin', 'editor', 'auditor', 'viewer'];

export function can(role: Role | undefined, action: Action): boolean {
  return !!role && PERMISSIONS[role].includes(action);
}
