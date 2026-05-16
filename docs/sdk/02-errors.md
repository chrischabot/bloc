# Errors

Re-exported from `@bloc/shared`. Typed exceptions thrown by the SDK transport when the server returns a non-2xx.

## Class hierarchy

```
Error
└── BlocAPIError              { status, code, message, requestId }
    ├── BlocAuthError         (status === 401)
    ├── BlocNotFoundError     (status === 404)
    └── BlocRateLimitError    (status === 429)   + retryAfter
```

## `BlocAPIError`

```ts
class BlocAPIError extends Error {
  status:    number;
  code:      'invalid_request' | 'validation_error' | 'restricted_resource' |
             'insufficient_scope' | 'conflict_error' | 'internal_server_error' |
             'service_unavailable' | 'database_connection_unavailable' |
             'object_not_found' | 'unauthorized' | 'rate_limited' |
             'missing_version' | 'unsupported_version' | 'invalid_request_url';
  message:   string;
  requestId: string;
}
```

Thrown for any non-2xx response that doesn't map to one of the subclasses.

## `BlocAuthError`

Thrown on `401`. `code === 'unauthorized'`. Typical fix: re-issue or refresh the bearer.

## `BlocNotFoundError`

Thrown on `404`. `code === 'object_not_found'`. Note that **403** (page exists but you can't see it) **also** surfaces as `BlocAPIError` with `code === 'restricted_resource'`, *not* as a `NotFoundError`. Notion's public docs sometimes elide the distinction.

## `BlocRateLimitError`

Thrown on `429`. Has `retryAfter: number` (seconds). The SDK retries internally before throwing — you only see this when retries are exhausted.

## Recipes

### Treat 404 as `null`

```ts
try {
  return await bloc.pages.retrieve({ page_id });
} catch (e) {
  if (e instanceof BlocNotFoundError) return null;
  throw e;
}
```

### Re-auth on 401

```ts
try { return await call(); }
catch (e) {
  if (e instanceof BlocAuthError) {
    await refreshToken();
    return await call();
  }
  throw e;
}
```

### Surface validation details

```ts
try { await bloc.pages.create({...}); }
catch (e) {
  if (e instanceof BlocAPIError && e.code === 'validation_error') {
    // 400 with field-level details. The raw details are not on the typed error;
    // use bloc.client.request directly if you need them.
  }
  throw e;
}
```

The typed exceptions intentionally hide the `details` array to keep the surface minimal. To access full error context, call `bloc.client.request(...)` directly and catch the JSON body.
