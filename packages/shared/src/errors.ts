/**
 * Machine-readable error codes returned in the error envelope.
 * See `docs/api/02-errors.md`.
 */
export type BlocErrorCode =
  | 'invalid_request'
  | 'invalid_cursor'
  | 'invalid_grant'
  | 'invalid_client'
  | 'invalid_grant_type'
  | 'validation_error'
  | 'unauthorized'
  | 'restricted_resource'
  | 'object_not_found'
  | 'conflict_error'
  | 'unsupported_media_type'
  | 'unprocessable_entity'
  | 'rate_limited'
  | 'internal_server_error'
  | 'bad_gateway'
  | 'service_unavailable'
  | 'gateway_timeout'
  | 'unsupported_version'
  | 'ai_quota_exhausted'
  | 'linked_source_read_only'
  | 'domain_not_allowed';

export interface BlocErrorDetail {
  path: string;
  issue: string;
}

export interface BlocErrorEnvelope {
  object: 'error';
  status: number;
  code: BlocErrorCode;
  message: string;
  request_id: string;
  details?: BlocErrorDetail[];
}

/** Base class for every API error thrown by the server or SDK. */
export class BlocAPIError extends Error {
  override readonly name: string = 'BlocAPIError';
  readonly status: number;
  readonly code: BlocErrorCode;
  readonly requestId: string;
  readonly details: BlocErrorDetail[] | undefined;

  constructor(args: {
    status: number;
    code: BlocErrorCode;
    message: string;
    requestId: string;
    details?: BlocErrorDetail[];
  }) {
    super(args.message);
    this.status = args.status;
    this.code = args.code;
    this.requestId = args.requestId;
    this.details = args.details;
  }

  toEnvelope(): BlocErrorEnvelope {
    const env: BlocErrorEnvelope = {
      object: 'error',
      status: this.status,
      code: this.code,
      message: this.message,
      request_id: this.requestId,
    };
    if (this.details !== undefined) env.details = this.details;
    return env;
  }
}

export class BlocAuthError extends BlocAPIError {
  override readonly name: string = 'BlocAuthError';
  constructor(message: string, requestId: string) {
    super({ status: 401, code: 'unauthorized', message, requestId });
  }
}

export class BlocNotFoundError extends BlocAPIError {
  override readonly name: string = 'BlocNotFoundError';
  constructor(message: string, requestId: string) {
    super({ status: 404, code: 'object_not_found', message, requestId });
  }
}

export class BlocValidationError extends BlocAPIError {
  override readonly name: string = 'BlocValidationError';
  constructor(message: string, requestId: string, details?: BlocErrorDetail[]) {
    const args: ConstructorParameters<typeof BlocAPIError>[0] = {
      status: 400,
      code: 'invalid_request',
      message,
      requestId,
    };
    if (details !== undefined) args.details = details;
    super(args);
  }
}

export class BlocRateLimitError extends BlocAPIError {
  override readonly name: string = 'BlocRateLimitError';
  readonly retryAfterSec: number;
  constructor(message: string, requestId: string, retryAfterSec: number) {
    super({ status: 429, code: 'rate_limited', message, requestId });
    this.retryAfterSec = retryAfterSec;
  }
}

export class BlocConflictError extends BlocAPIError {
  override readonly name: string = 'BlocConflictError';
  constructor(message: string, requestId: string) {
    super({ status: 409, code: 'conflict_error', message, requestId });
  }
}

export class BlocRestrictedError extends BlocAPIError {
  override readonly name: string = 'BlocRestrictedError';
  constructor(message: string, requestId: string, status: 402 | 403 = 403) {
    super({ status, code: 'restricted_resource', message, requestId });
  }
}

export class BlocUnsupportedVersionError extends BlocAPIError {
  override readonly name: string = 'BlocUnsupportedVersionError';
  constructor(requested: string, requestId: string) {
    super({
      status: 400,
      code: 'unsupported_version',
      message: `Unsupported Notion-Version: ${requested}`,
      requestId,
    });
  }
}
