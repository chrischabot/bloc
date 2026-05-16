import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type ClientHandle, openDb, runMigrations } from '../client.ts';
import {
  type Actor,
  type ResourceRef,
  addMember,
  appendChildren,
  archivePage,
  collectSubtreeIds,
  createDatabase,
  createPage,
  createProperty,
  createUser,
  createWorkspace,
  getDefaultDataSource,
  listChildren,
  listMembers,
  listPagesByParent,
  listProperties,
  recordEvent,
  requirePermission,
  resolveLevel,
  setPageProperty,
} from './index.ts';

let handle: ClientHandle;
let alice: { id: string };
let workspaceId: string;

beforeAll(async () => {
  handle = await openDb();
  await runMigrations(handle);
  const db = handle.db;
  alice = await createUser(db, { email: 'alice@test.local', name: 'Alice', type: 'person' });
  const ws = await createWorkspace(db, { name: 'Test', plan: 'free' });
  workspaceId = ws.id;
  await addMember(db, { workspaceId, userId: alice.id, role: 'owner' });
});

afterAll(async () => {
  await handle.close();
});

describe('workspace + user + member', () => {
  it('creates and lists members', async () => {
    const members = await listMembers(handle.db, workspaceId);
    expect(members).toHaveLength(1);
    expect(members[0]!.userId).toBe(alice.id);
    expect(members[0]!.role).toBe('owner');
  });
});

describe('pages + blocks', () => {
  it('creates a page and lists by parent', async () => {
    const page = await createPage(handle.db, {
      workspaceId,
      parentType: 'workspace',
      createdBy: alice.id,
      lastEditedBy: alice.id,
    });
    expect(page.id).toBeTruthy();
    const root = await createPage(handle.db, {
      workspaceId,
      parentType: 'page',
      parentId: page.id,
      createdBy: alice.id,
      lastEditedBy: alice.id,
    });
    const children = await listPagesByParent(handle.db, page.id);
    expect(children.map((c) => c.id)).toContain(root.id);
  });

  it('appends children with fractional positions', async () => {
    const page = await createPage(handle.db, {
      workspaceId,
      parentType: 'workspace',
      createdBy: alice.id,
      lastEditedBy: alice.id,
    });
    const inserted = await appendChildren(handle.db, {
      workspaceId,
      parentType: 'page',
      parentId: page.id,
      actor: alice.id,
      children: [
        { type: 'paragraph', content: { paragraph: { rich_text: [], color: 'default' } } },
        { type: 'heading_1', content: { heading_1: { rich_text: [], color: 'default' } } },
        { type: 'to_do', content: { to_do: { rich_text: [], checked: false, color: 'default' } } },
      ],
    });
    expect(inserted).toHaveLength(3);
    expect(inserted[0]!.position < inserted[1]!.position).toBe(true);
    expect(inserted[1]!.position < inserted[2]!.position).toBe(true);

    const listed = await listChildren(handle.db, page.id);
    expect(listed).toHaveLength(3);
    expect(listed.map((b) => b.type)).toEqual(['paragraph', 'heading_1', 'to_do']);
  });

  it('round-trips a 6-level nested block tree', async () => {
    const page = await createPage(handle.db, {
      workspaceId,
      parentType: 'workspace',
      createdBy: alice.id,
      lastEditedBy: alice.id,
    });
    let parentId = page.id;
    let parentType: 'page' | 'block' = 'page';
    const trail: string[] = [];
    for (let depth = 1; depth <= 6; depth++) {
      const [block] = await appendChildren(handle.db, {
        workspaceId,
        parentType,
        parentId,
        actor: alice.id,
        children: [
          {
            type: 'paragraph',
            content: {
              paragraph: {
                rich_text: [
                  {
                    type: 'text',
                    text: { content: `L${depth}` },
                    annotations: {},
                    plain_text: `L${depth}`,
                    href: null,
                  },
                ],
                color: 'default',
              },
            },
          },
        ],
      });
      trail.push(block!.id);
      parentId = block!.id;
      parentType = 'block';
    }
    // Walk back top-down and verify each level has exactly one child.
    let currentParent = page.id;
    for (let depth = 0; depth < 6; depth++) {
      const kids = await listChildren(handle.db, currentParent);
      expect(kids).toHaveLength(1);
      expect(kids[0]!.id).toBe(trail[depth]!);
      currentParent = kids[0]!.id;
    }
    // Collect ids and verify subtree size.
    const ids = await collectSubtreeIds(handle.db, page.id);
    expect(ids).toHaveLength(6);
  });

  it('archives a page and its blocks', async () => {
    const page = await createPage(handle.db, {
      workspaceId,
      parentType: 'workspace',
      createdBy: alice.id,
      lastEditedBy: alice.id,
    });
    await appendChildren(handle.db, {
      workspaceId,
      parentType: 'page',
      parentId: page.id,
      actor: alice.id,
      children: [
        { type: 'paragraph', content: {} },
        { type: 'paragraph', content: {} },
      ],
    });
    await archivePage(handle.db, page.id, alice.id);
    const after = await listChildren(handle.db, page.id);
    expect(after).toHaveLength(0); // archived blocks are excluded by default
    const withArchived = await listChildren(handle.db, page.id, { includeArchived: true });
    expect(withArchived).toHaveLength(2);
    expect(withArchived.every((b) => b.archived)).toBe(true);
  });
});

describe('databases + properties + page values', () => {
  it('creates a database with default data source and properties', async () => {
    const parent = await createPage(handle.db, {
      workspaceId,
      parentType: 'workspace',
      createdBy: alice.id,
      lastEditedBy: alice.id,
    });
    const dbRow = await createDatabase(handle.db, {
      workspaceId,
      parentType: 'page',
      parentId: parent.id,
      title: [],
      description: [],
      createdBy: alice.id,
      lastEditedBy: alice.id,
    });
    const def = await getDefaultDataSource(handle.db, dbRow.id);
    expect(def).not.toBeNull();
    expect(def!.type).toBe('owned');

    const title = await createProperty(handle.db, {
      databaseId: dbRow.id,
      name: 'Name',
      type: 'title',
    });
    const status = await createProperty(handle.db, {
      databaseId: dbRow.id,
      name: 'Status',
      type: 'status',
    });
    const props = await listProperties(handle.db, dbRow.id);
    expect(props.map((p) => p.name)).toEqual(['Name', 'Status']);

    // Row in the database with a title property.
    const row = await createPage(handle.db, {
      workspaceId,
      parentType: 'database',
      parentId: dbRow.id,
      dataSourceId: def!.id,
      createdBy: alice.id,
      lastEditedBy: alice.id,
    });
    await setPageProperty(handle.db, {
      pageId: row.id,
      propertyId: title.id,
      value: {
        type: 'title',
        title: [
          {
            type: 'text',
            text: { content: 'Hello' },
            annotations: {},
            plain_text: 'Hello',
            href: null,
          },
        ],
      },
    });
    await setPageProperty(handle.db, {
      pageId: row.id,
      propertyId: status.id,
      value: { type: 'status', status: { name: 'Todo', color: 'gray' } },
    });
  });
});

describe('permissions', () => {
  it('workspace owner gets full_access by default', async () => {
    const page = await createPage(handle.db, {
      workspaceId,
      parentType: 'workspace',
      createdBy: alice.id,
      lastEditedBy: alice.id,
    });
    const actor: Actor = { userId: alice.id, workspaceId };
    const resource: ResourceRef = { type: 'page', id: page.id };
    const level = await resolveLevel(handle.db, actor, resource);
    expect(level).toBe('full_access');
    await expect(
      requirePermission(handle.db, actor, resource, 'can_edit'),
    ).resolves.toBeUndefined();
  });

  it('non-member has no access', async () => {
    const page = await createPage(handle.db, {
      workspaceId,
      parentType: 'workspace',
      createdBy: alice.id,
      lastEditedBy: alice.id,
    });
    const stranger: Actor = { userId: '00000000-0000-0000-0000-000000000000', workspaceId };
    const resource: ResourceRef = { type: 'page', id: page.id };
    const level = await resolveLevel(handle.db, stranger, resource);
    expect(level).toBe('no_access');
    await expect(requirePermission(handle.db, stranger, resource, 'can_read')).rejects.toThrow(
      /no_access/,
    );
  });
});

describe('audit', () => {
  it('records and lists workspace events', async () => {
    const event = await recordEvent(handle.db, {
      workspaceId,
      actorUserId: alice.id,
      action: 'page.created',
      resourceType: 'page',
    });
    expect(event.id).toBeTruthy();
  });
});
