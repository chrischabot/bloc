/**
 * Maps SDK function names to whether they are unblocked for cross-client parity
 * testing. Set to `true` only when the corresponding endpoint passes its
 * contract test.
 */
export const unblocked: Record<string, boolean> = {
  // Phase 2
  'blocks.retrieve': true,
  'blocks.children.list': true,
  'blocks.children.append': true,
  'blocks.update': true,
  'blocks.delete': true,
  // Phase 3
  'pages.create': true,
  'pages.retrieve': true,
  'pages.update': true,
  'pages.properties.retrieve': true,
  // Phase 4
  'databases.create': true,
  'databases.retrieve': true,
  'databases.update': true,
  'databases.query': true,
  // Phase 25 — data sources
  'dataSources.create': false,
  'dataSources.retrieve': false,
  'dataSources.update': false,
  'dataSources.query': false,
  'dataSources.delete': false,
  // Phase 5
  search: true,
  'users.me': true,
  'users.retrieve': true,
  'users.list': true,
  'comments.create': true,
  'comments.list': true,
  // Phase 14 — buttons / automations
  'buttons.invoke': false,
  'automations.list': false,
  'automations.create': false,
  // Phase 21 — webhooks
  'webhooks.create': false,
  'webhooks.list': false,
  'webhooks.delete': false,
  // Phase 24 — internal v3 API (behavioural-equivalent)
  'v3.loadPageChunk': true,
  'v3.getRecordValues': true,
  'v3.submitTransaction': true,
};

export function isUnblocked(fn: keyof typeof unblocked): boolean {
  return unblocked[fn] === true;
}
