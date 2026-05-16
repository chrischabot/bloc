# Forms

A **form view** on a database accepts public submissions and creates rows.

## Creating

UI: open the database, add a view, choose **Form**. Configure:

- **Title** + **description**.
- **Fields** — one per property to surface. Each field has `required: bool`, `label`, optional default.
- **Submit label** + **success text**.
- **Public** — toggle to expose at `/v1/forms/{id}/submissions` without auth.

Or via API:

```ts
await fetch('/v1/forms', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Notion-Version': '2025-09-03' },
  body: JSON.stringify({
    database_id: dbId,
    title: 'Bug report',
    description: 'Tell us what broke',
    fields: [
      { property: 'Title',    required: true,  label: 'Summary' },
      { property: 'Severity', required: true,  label: 'Severity' },
      { property: 'Steps',    required: false, label: 'Steps to reproduce' },
    ],
    submit_label: 'Send',
    success_text: 'Thanks!',
    public: true,
  })
});
```

## Submitting (public)

`POST /v1/forms/{form_id}/submissions` — no auth required when `public: true`. Body keys match the form's `property` names:

```json
{ "Title": "Login broken", "Severity": "P1", "Steps": "1. ..." }
```

Returns the created `PageObject`. Rate-limited per IP (`10 burst / 1 sustained / 60 s`).

## Embedding

- Slash menu → Form → pick form view of a database.
- Or share the standalone URL from the view menu.

## Reacting to submissions

Wire a `page.created` webhook filtered by `database_id` to be notified. Or trigger an automation with `trigger: { type: 'page_created' }` to email the owner, label the row, post to Slack, etc.

## File uploads

Fields bound to a `files` property render an upload control. The form posts to a pre-signed URL the same way the editor does.

## Captcha

Public forms can require a captcha. Configure under the form view's settings → **Anti-spam**. Bloc supports hCaptcha and Cloudflare Turnstile out of the box.

## Limits

- Max fields per form: 50.
- Max file uploads per submission: 5.
- Max payload size: 5 MB.
