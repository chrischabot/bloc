# Building an integration

Long-form: end-to-end pattern for a third-party service that calls Bloc on behalf of users.

## Decide: internal or OAuth?

| | Internal integration | OAuth |
|---|---|---|
| Auth model | One bearer per workspace, created in settings | Standard OAuth 2.0 |
| Best for | Internal tools, cron jobs, server-side scripts | Public apps used by many workspaces |
| Setup cost | 30 seconds | ~1 day of code |

We'll do OAuth here; for internal use, skip the OAuth section and use the bearer directly.

## 1. Register the OAuth client

In Bloc's web app: **Settings → Integrations → New OAuth app**.

- Name, icon.
- Redirect URIs.
- Scopes — start with `read write`.

Bloc returns `client_id` and `client_secret`. Store the secret server-side.

## 2. Authorize the user

```ts
const url = new URL('https://<bloc-host>/v1/auth/oauth/authorize');
url.searchParams.set('client_id',     CLIENT_ID);
url.searchParams.set('redirect_uri',  REDIRECT_URI);
url.searchParams.set('state',         randomString());      // store; verify on return
url.searchParams.set('scope',         'read write');
url.searchParams.set('response_type', 'code');
res.redirect(url.toString());
```

## 3. Handle the callback

```ts
app.get('/callback', async (req, res) => {
  if (req.query.state !== expectedState) return res.status(400).end();
  const { code } = req.query;

  const tokRes = await fetch('https://<bloc-host>/v1/auth/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Notion-Version': '2025-09-03' },
    body: JSON.stringify({
      grant_type:   'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id:    CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });
  const { access_token, refresh_token, workspace_id } = await tokRes.json();

  await db.tokens.upsert({ workspace_id, access_token, refresh_token });
  res.redirect('/done');
});
```

## 4. Call Bloc

```ts
const bloc = new Bloc({
  auth: workspace.access_token,
  baseUrl: 'https://<bloc-host>',
});

const me = await bloc.users.me();
```

## 5. Refresh tokens proactively

```ts
async function getClient(workspace: Workspace) {
  if (Date.now() > workspace.access_expires_at - 5*60_000) {
    const refreshed = await fetch('.../v1/auth/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Notion-Version': '2025-09-03' },
      body: JSON.stringify({
        grant_type:    'refresh_token',
        refresh_token: workspace.refresh_token,
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }),
    }).then(r => r.json());
    await db.tokens.update({ id: workspace.id, ...refreshed });
    workspace = await db.tokens.get(workspace.id);
  }
  return new Bloc({ auth: workspace.access_token, baseUrl: BLOC });
}
```

## 6. Wire webhooks

If your integration cares about changes:

```ts
const wh = await bloc.webhooks.create({
  endpoint_url: 'https://your-app/hook',
  subscribed_events: ['page.created', 'page.updated', 'page.deleted'],
});
// IMPORTANT: persist wh.signing_secret immediately. You can't retrieve it later.
await db.webhooks.upsert({ workspace_id, secret: wh.signing_secret! });
```

See [Writing a webhook receiver](./07-webhook-receiver.md).

## 7. Handle errors

```ts
import { BlocAuthError, BlocRateLimitError } from '@bloc/sdk';

try { ... } catch (e) {
  if (e instanceof BlocAuthError)        return refreshAndRetry();
  if (e instanceof BlocRateLimitError)   return enqueueForLater(e.retryAfter);
  throw e;
}
```

## 8. Observe

- Log every Bloc call with the response's `x-request-id`. That's the join key when filing support tickets.
- Track `ai_tokens_in/out`, `webhook_delivery_attempts_total`, and your own `time_to_user_action_seconds`.
- Alert on `BlocAuthError` rate climbing — usually means a workspace revoked your app.

## Common mistakes

- Forgetting `Notion-Version` → 400.
- Not persisting `signing_secret` on webhook creation → can never verify deliveries.
- Polling instead of webhooks → rate limits, lag.
- Storing tokens in plaintext → leak risk; encrypt at rest.
