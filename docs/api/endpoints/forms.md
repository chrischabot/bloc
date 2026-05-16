# Forms

A form is a view on a database that accepts public submissions and creates rows.

## Create a form view

`POST /v1/forms`

```json
{
  "database_id": "uuid",
  "title": "Bug report",
  "description": "Tell us what broke",
  "fields": [
    { "property": "Title", "required": true, "label": "Summary" },
    { "property": "Severity", "required": true, "label": "Severity" }
  ],
  "submit_label": "Send",
  "success_text": "Thanks!",
  "public": true
}
```

## Retrieve a form

`GET /v1/forms/{form_id}` (auth) or `GET /v1/forms/{form_id}/public` (anonymous).

## Update a form

`PATCH /v1/forms/{form_id}`

## Delete a form

`DELETE /v1/forms/{form_id}`

## Submit (public)

`POST /v1/forms/{form_id}/submissions`

No auth required if the form is `public: true`. Body shape matches the form's `fields`:

```json
{ "Title": "Login broken", "Severity": "P1" }
```

Returns the newly created row (as a `PageObject`).

The endpoint enforces per-IP rate limits (`10 burst / 1 sustained / 60 s`).

## List submissions

`GET /v1/forms/{form_id}/submissions` — auth required.

## Webhook on submit

Wire a `page.created` webhook with a `filter` matching `database_id` to be notified on every submission. See [Webhooks](./webhooks.md).
