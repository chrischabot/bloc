# Parent Objects

Every page, database, block, and comment carries a `parent` field. Shape:

```jsonc
{ "type": "page_id"|"database_id"|"block_id"|"workspace", "page_id": "uuid", "database_id": "uuid", "block_id": "uuid", "workspace": true }
```

Exactly one of the type-specific keys is present per `type`.

## Allowed parents per child object

| Child | Allowed parent types |
|-------|----------------------|
| Page | `database_id`, `page_id`, `workspace` |
| Database | `page_id`, `workspace` |
| Block | `page_id`, `block_id`, `database_id` (only for templates) |
| Comment | `page_id`, `block_id` |

## Workspace parent

```jsonc
{ "type": "workspace", "workspace": true }
```

Returned for top-level pages and databases.

## Validation

Server rejects:

- Parent type not in the allowed set for the child (400).
- Parent ID not found (404).
- Caller has no permission on the parent (404 to avoid existence-leak).
- Move that would create a cycle (e.g. a page moved under its own descendant) — 422.