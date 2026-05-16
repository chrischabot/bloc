# Security

## Principles

1. **Default deny.** Every API handler resolves the actor and the resource and explicitly authorises before proceeding.
2. **Zod-first inputs.** No handler reads `req.body` without parsing through a Zod schema from `packages/shared`.
3. **No string-built SQL.** Drizzle's parameter binding is mandatory. Raw SQL is allowed only via tagged template literals that bind parameters.
4. **Structured rich text.** Never render user-supplied HTML. Rich-text serializers produce structured DOM, never `innerHTML`.
5. **Secrets in env only.** Never log, never check in. `.env.example` documents required vars; `tools/check-env` validates on boot.

## AuthZ enforcement

`packages/db/src/permissions.ts` exports:

```ts
export async function requirePermission(
  actor: Actor,
  resource: ResourceRef,
  level: PermissionLevel
): Promise<void>;
```

Every handler must call this before any state mutation or sensitive read. A static lint rule (`packages/lint-rules/require-permission`) enforces it: any handler in `apps/api/src/routes/**` that performs a write must contain at least one `requirePermission` call in its control flow.

## Input validation

- Path params: parsed via `z.string().uuid()`.
- Query params: parsed by per-route Zod schemas.
- Bodies: parsed by per-route Zod schemas with `.strict()` to reject unknown fields.
- All schemas live in `packages/shared/api/<route>.ts`.

## File uploads

- Pre-signed PUT URLs only; client never sends bytes through API.
- Allowlisted MIME types per file-attachment context (`image/*`, `video/mp4`, `application/pdf`, …).
- Server-side scan: `file.size` and `file.mime` recorded; max 5 GB per file (Notion's limit on paid plans), 5 MB on free.
- Antivirus hook: an optional `tools/av-scan` worker can be wired in front of public visibility.

## XSS

- Rich text rendered through `<RichText />` component which walks the structured tree and emits DOM nodes; no `dangerouslySetInnerHTML`.
- URLs in `link` annotations validated: scheme must be `http`, `https`, `mailto`, or `tel`. Otherwise the link renders as plain text.
- Embed blocks render through an `<iframe sandbox="…">` with sandbox attrs `allow-scripts allow-same-origin` only for allowlisted hosts.

## CSP

```
default-src 'self';
script-src 'self' 'wasm-unsafe-eval' https://cdn.example;
style-src 'self' 'unsafe-inline';   // necessary for our CSS variable theme
img-src 'self' https: data: blob:;
media-src 'self' https: blob:;
connect-src 'self' https://api.example wss://api.example https://o.<sentry>.io;
frame-src https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://www.figma.com https://www.loom.com https://...;
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
```

Embed allowlist matches Notion's supported embeds (see `docs/api/schemas/block-types.md#embed`).

## CSRF

- State-changing endpoints require `Origin` to match `Host`; mismatches return 403.
- Plus double-submit cookie for cookie-authenticated calls: `X-CSRF-Token` header must equal `csrf` cookie. Bearer-authenticated requests are exempt.

## Secrets

- Stored in `.env` (dev) or in the platform secret manager (prod).
- Loaded once at boot; never logged.
- Integration tokens stored bcrypt-hashed; raw value never persisted.

## Headers

Required response headers on every API response:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

## Dependency hygiene

- Renovate weekly.
- `npm audit` / `pnpm audit` gates CI on high+ severities.
- Lockfile changes reviewed by humans.

## Penetration tests

- Pre-launch external pen-test required.
- Chaos suite (`tests/chaos/`) covers OWASP Top 10 categories applicable to our API (injection, broken authn, broken access control, security misconfig, SSRF in fetch_external embeds, deserialisation in rich-text).