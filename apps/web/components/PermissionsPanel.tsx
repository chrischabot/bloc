'use client';

import { type GranteeType, Bloc, type PermissionLevel, type PermissionObject } from '@bloc/sdk';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';

const API_BASE =
  typeof process !== 'undefined' && process.env['NEXT_PUBLIC_API_URL']
    ? process.env['NEXT_PUBLIC_API_URL']
    : 'http://localhost:3001';

function devBearer(): string {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const w = params.get('w') ?? '00000000-0000-0000-0000-000000000001';
    const u = params.get('u') ?? '00000000-0000-0000-0000-000000000002';
    return `Bearer test_${w}_${u}`;
  }
  return 'Bearer test_00000000-0000-0000-0000-000000000001_00000000-0000-0000-0000-000000000002';
}

const LEVEL_LABEL: Record<PermissionLevel, string> = {
  full_access: 'Full access',
  can_edit: 'Can edit',
  can_edit_content: 'Can edit content',
  can_comment: 'Can comment',
  can_read: 'Can view',
  no_access: 'No access',
};

const GRANTEE_LABEL: Record<GranteeType, string> = {
  user: 'User',
  workspace: 'Workspace',
  public: 'Public',
  link: 'Link',
  teamspace: 'Teamspace',
  group: 'Group',
};

export default function PermissionsPanel({
  pageId,
  authToken,
}: {
  pageId: string;
  authToken?: string;
}): React.JSX.Element {
  const [permissions, setPermissions] = useState<PermissionObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [granteeType, setGranteeType] = useState<GranteeType>('user');
  const [granteeId, setGranteeId] = useState('');
  const [level, setLevel] = useState<PermissionLevel>('can_read');

  const client = useState(
    () => new Bloc({ auth: authToken ?? devBearer(), baseUrl: API_BASE }),
  )[0];

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await client.permissions.list({ page_id: pageId });
      setPermissions(result.results);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [client, pageId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function addGrant(): Promise<void> {
    const requiresId =
      granteeType === 'user' || granteeType === 'group' || granteeType === 'teamspace';
    if (requiresId && granteeId.trim().length === 0) {
      setError(`${GRANTEE_LABEL[granteeType]} grants require a grantee_id`);
      return;
    }
    try {
      await client.permissions.grant({
        page_id: pageId,
        grantee_type: granteeType,
        grantee_id: requiresId ? granteeId.trim() : null,
        level,
      });
      setGranteeId('');
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function revoke(perm: PermissionObject): Promise<void> {
    try {
      const args: Parameters<typeof client.permissions.revoke>[0] = { page_id: pageId };
      if (perm.grantee_id !== null) args.grantee_id = perm.grantee_id;
      await client.permissions.revoke(args);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section className="permissions" aria-label="Page permissions">
      <header className="permissions__header">
        <h3>Page permissions</h3>
      </header>
      {error !== null && <p className="permissions__error">{error}</p>}
      <div className="permissions__form">
        <select
          value={granteeType}
          onChange={(e) => setGranteeType(e.target.value as GranteeType)}
          aria-label="Grantee type"
        >
          {Object.entries(GRANTEE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Grantee id (uuid)"
          value={granteeId}
          onChange={(e) => setGranteeId(e.target.value)}
          aria-label="Grantee id"
        />
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value as PermissionLevel)}
          aria-label="Permission level"
        >
          {Object.entries(LEVEL_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => void addGrant()} className="permissions__cta">
          Grant
        </button>
      </div>
      {loading ? (
        <p className="permissions__empty">Loading…</p>
      ) : permissions.length === 0 ? (
        <p className="permissions__empty">No permissions granted yet.</p>
      ) : (
        <ul className="permissions__list">
          {permissions.map((p) => (
            <li key={p.id} className="permissions__row">
              <span className="permissions__grantee">
                {GRANTEE_LABEL[p.grantee_type]}
                {p.grantee_id ? `: ${p.grantee_id.slice(0, 8)}…` : ''}
              </span>
              <span className={`permissions__level permissions__level--${p.level}`}>
                {LEVEL_LABEL[p.level] ?? p.level}
              </span>
              <button
                type="button"
                className="permissions__revoke"
                onClick={() => void revoke(p)}
                aria-label="Revoke"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
