import { openDb, runMigrations } from '../src/client.ts';
import {
  addMember,
  appendChildren,
  createDatabase,
  createPage,
  createProperty,
  createUser,
  createWorkspace,
  setPageProperty,
} from '../src/index.ts';

const handle = await openDb();
console.log(`[seed] driver=${handle.driver}`);
await runMigrations(handle);
const db = handle.db;

// User + workspace.
const user = await createUser(db, {
  email: 'alice@example.com',
  name: 'Alice',
  type: 'person',
});
const workspace = await createWorkspace(db, { name: 'Acme', plan: 'business' });
await addMember(db, { workspaceId: workspace.id, userId: user.id, role: 'owner' });
console.log(`[seed] workspace=${workspace.id} user=${user.id}`);

// 5 plain pages.
const rootPages = await Promise.all(
  ['Welcome', 'Roadmap', 'Engineering', 'Marketing', 'HR'].map((title) =>
    createPage(db, {
      workspaceId: workspace.id,
      parentType: 'workspace',
      cover: { type: 'external', external: { url: `https://placehold.co/1200x300?text=${title}` } },
      icon: { type: 'emoji', emoji: '📄' },
      createdBy: user.id,
      lastEditedBy: user.id,
    }),
  ),
);
console.log(`[seed] created ${rootPages.length} top-level pages`);

// 1 database with all 20 property types.
const tasksDb = await createDatabase(db, {
  workspaceId: workspace.id,
  parentType: 'page',
  parentId: rootPages[0]!.id,
  title: [
    { type: 'text', text: { content: 'Tasks' }, annotations: {}, plain_text: 'Tasks', href: null },
  ],
  description: [],
  createdBy: user.id,
  lastEditedBy: user.id,
});

const propertyTypes: { name: string; type: string; config?: unknown }[] = [
  { name: 'Name', type: 'title' },
  { name: 'Description', type: 'rich_text' },
  { name: 'Story points', type: 'number', config: { format: 'number' } },
  {
    name: 'Priority',
    type: 'select',
    config: {
      options: [
        { name: 'P0', color: 'red' },
        { name: 'P1', color: 'orange' },
      ],
    },
  },
  { name: 'Tags', type: 'multi_select', config: { options: [] } },
  { name: 'Status', type: 'status' },
  { name: 'Due', type: 'date' },
  { name: 'Assignees', type: 'people' },
  { name: 'Attachments', type: 'files' },
  { name: 'Done', type: 'checkbox' },
  { name: 'Link', type: 'url' },
  { name: 'Email', type: 'email' },
  { name: 'Phone', type: 'phone_number' },
  { name: 'Formula', type: 'formula', config: { expression: 'prop("Story points") * 2' } },
  { name: 'Related', type: 'relation', config: {} },
  { name: 'Rollup', type: 'rollup', config: {} },
  { name: 'Created at', type: 'created_time' },
  { name: 'Created by', type: 'created_by' },
  { name: 'Last edited at', type: 'last_edited_time' },
  { name: 'Last edited by', type: 'last_edited_by' },
];

const propRecords = [];
for (const p of propertyTypes) {
  propRecords.push(
    await createProperty(db, {
      databaseId: tasksDb.id,
      name: p.name,
      type: p.type,
      ...(p.config !== undefined ? { config: p.config } : {}),
    }),
  );
}
console.log(`[seed] created database '${tasksDb.id}' with ${propRecords.length} properties`);

// One row in the database with values for each property.
const sampleRow = await createPage(db, {
  workspaceId: workspace.id,
  parentType: 'database',
  parentId: tasksDb.id,
  createdBy: user.id,
  lastEditedBy: user.id,
});
const propByName = new Map(propRecords.map((p) => [p.name, p]));
await setPageProperty(db, {
  pageId: sampleRow.id,
  propertyId: propByName.get('Name')!.id,
  value: {
    type: 'title',
    title: [
      {
        type: 'text',
        text: { content: 'First task' },
        annotations: {},
        plain_text: 'First task',
        href: null,
      },
    ],
  },
});
await setPageProperty(db, {
  pageId: sampleRow.id,
  propertyId: propByName.get('Done')!.id,
  value: { type: 'checkbox', checkbox: false },
});
await setPageProperty(db, {
  pageId: sampleRow.id,
  propertyId: propByName.get('Story points')!.id,
  value: { type: 'number', number: 3 },
});

// Sample page demonstrating ~20 block types.
const blockTypes = [
  'paragraph',
  'heading_1',
  'heading_2',
  'heading_3',
  'bulleted_list_item',
  'numbered_list_item',
  'to_do',
  'toggle',
  'quote',
  'callout',
  'code',
  'divider',
  'equation',
  'image',
  'video',
  'file',
  'pdf',
  'bookmark',
  'table_of_contents',
  'breadcrumb',
];

const samplePage = await createPage(db, {
  workspaceId: workspace.id,
  parentType: 'workspace',
  icon: { type: 'emoji', emoji: '🧩' },
  createdBy: user.id,
  lastEditedBy: user.id,
});

const inserted = await appendChildren(db, {
  parentId: samplePage.id,
  parentType: 'page',
  workspaceId: workspace.id,
  actor: user.id,
  children: blockTypes.map((t) => ({
    type: t,
    content: {
      [t]: {
        rich_text: [
          {
            type: 'text',
            text: { content: `${t} example` },
            annotations: {},
            plain_text: `${t} example`,
            href: null,
          },
        ],
        color: 'default',
      },
    },
  })),
});
console.log(`[seed] sample page=${samplePage.id} blocks=${inserted.length}`);

await handle.close();
console.log('[seed] done');
