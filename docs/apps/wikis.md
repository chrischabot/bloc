# Wikis & verification

A wiki is a curated page with a verifying owner. Verified wikis surface a "Verified by X on Y" badge; unverified wikis show "Re-verify".

## Turning a page into a wiki

UI: page menu → **Turn into wiki**. Or, on a page that's already wiki-enabled: page settings → **Wiki settings**.

A wiki page:

- Has a designated **owner** (single user or group).
- Carries a `verification` property surface with `state: verified | expired | none`.
- Auto-expires verification after the configured TTL (default 90 days).
- Triggers a reminder to the owner when verification is about to expire.

## Verifying

UI: badge in the page header → **Verify**. Sets the state to `verified`, records who verified and when.

API:

```
POST   /v1/pages/{page_id}/verify      # set verified
DELETE /v1/pages/{page_id}/verify      # clear
```

The endpoint also writes the equivalent `verification` property if one exists on the page's database.

## Why this exists

Two failure modes Bloc tries to surface:

- A page documents something correctly today but rots silently. Verification timestamps make staleness visible.
- A page has authority but it isn't obvious who owns it. The owner badge surfaces the chain of responsibility.

## Working with verified pages programmatically

`GET /v1/pages/{id}` includes the verification property when present:

```json
{
  "...": "...",
  "properties": {
    "Verification": {
      "type": "verification",
      "verification": {
        "state": "verified",
        "verified_by": { "object": "user", "id": "..." },
        "date": { "start": "2025-05-01T00:00:00.000Z" }
      }
    }
  }
}
```

Search results surface a small "✓" next to verified pages.
