# Mail / Inbox app

Bloc's "Mail" surface is the workspace inbox plus optional integrations that pull external messages into the same feed.

## Built-in inbox

Driven by `/v1/inbox`. See [Web › Inbox](../web/12-inbox.md). Kinds: `mention`, `comment`, `page_update`, `reminder`.

## External providers

Configured per workspace under **Settings → Connections**:

- **Gmail / Outlook** — OAuth, read-only by default. Pulls threads tagged with labels you specify.
- **Slack** — pulls DMs and mentions.
- **Linear / Jira / GitHub** — pulls issue updates.

Each provider writes into the inbox as kind `external`. The web app's inbox feed treats them uniformly.

## Routing rules

In **Settings → Inbox routing**, configure rules:

- Match by `actor.email`, `target_page_id`, `kind`, or external `subject_pattern`.
- Action: tag, snooze, archive, forward.

Rules evaluate in order; first match wins.

## Notifications

Each provider can fan out to:

- **Email digest** at the workspace SMTP.
- **Web push**.
- **Slack** (if the bidirectional Slack connection is enabled).

## API

Inbox itself is exposed via [SDK › inbox](../sdk/14-inbox.md). External-provider state is not exposed via the public API in v1 — it's surfaced only through the inbox feed.
