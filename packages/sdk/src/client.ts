import {
  LATEST_VERSION,
  BlocAPIError,
  BlocAuthError,
  BlocNotFoundError,
  BlocRateLimitError,
  type NotionVersion,
} from '@bloc/shared';
import {
  DEFAULT_BASE_URL,
  DEFAULT_INITIAL_RETRY_DELAY_MS,
  DEFAULT_MAX_RETRIES,
  DEFAULT_MAX_RETRY_DELAY_MS,
  DEFAULT_TIMEOUT_MS,
} from './constants.ts';

export interface ClientOptions {
  auth: string;
  baseUrl?: string;
  notionVersion?: NotionVersion;
  timeoutMs?: number;
  maxRetries?: number;
  initialRetryDelayMs?: number;
  maxRetryDelayMs?: number;
  fetch?: typeof fetch;
}

export interface RequestArgs<TBody = unknown> {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  body?: TBody;
  query?: Record<string, string | number | boolean | undefined>;
  notionVersion?: NotionVersion;
}

/** Low-level transport. Public for use by namespace classes. */
export class BlocClient {
  readonly auth: string;
  readonly baseUrl: string;
  readonly notionVersion: NotionVersion;
  readonly timeoutMs: number;
  readonly maxRetries: number;
  readonly initialRetryDelayMs: number;
  readonly maxRetryDelayMs: number;
  readonly fetchImpl: typeof fetch;

  constructor(options: ClientOptions) {
    this.auth = options.auth;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.notionVersion = options.notionVersion ?? LATEST_VERSION;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.initialRetryDelayMs = options.initialRetryDelayMs ?? DEFAULT_INITIAL_RETRY_DELAY_MS;
    this.maxRetryDelayMs = options.maxRetryDelayMs ?? DEFAULT_MAX_RETRY_DELAY_MS;
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  /** Perform an authenticated request and return the parsed JSON body. */
  async request<TResponse, TBody = unknown>(args: RequestArgs<TBody>): Promise<TResponse> {
    const url = new URL(this.baseUrl + args.path);
    if (args.query) {
      for (const [k, v] of Object.entries(args.query)) {
        if (v === undefined) continue;
        url.searchParams.set(k, String(v));
      }
    }
    const headers: Record<string, string> = {
      authorization: this.auth.startsWith('Bearer ') ? this.auth : `Bearer ${this.auth}`,
      'notion-version': args.notionVersion ?? this.notionVersion,
      accept: 'application/json',
    };
    let bodyText: string | undefined;
    if (args.body !== undefined) {
      headers['content-type'] = 'application/json';
      bodyText = JSON.stringify(args.body);
    }

    let attempt = 0;
    while (true) {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), this.timeoutMs);
      const fetchInit: RequestInit & { duplex?: 'half' } = {
        method: args.method,
        headers,
        signal: ctrl.signal,
      };
      if (bodyText !== undefined) fetchInit.body = bodyText;
      let res: Response;
      try {
        res = await this.fetchImpl(url.toString(), fetchInit);
      } catch (err) {
        clearTimeout(timeout);
        if (attempt < this.maxRetries) {
          await this.backoff(attempt);
          attempt += 1;
          continue;
        }
        throw err;
      }
      clearTimeout(timeout);

      if (res.status === 204) return undefined as TResponse;
      const text = await res.text();
      let parsed: unknown;
      try {
        parsed = text.length > 0 ? JSON.parse(text) : {};
      } catch {
        parsed = { object: 'error', status: res.status, code: 'invalid_request', message: text };
      }

      if (res.ok) return parsed as TResponse;

      // Retry on 429 / 5xx.
      const shouldRetry =
        attempt < this.maxRetries &&
        (res.status === 429 || (res.status >= 502 && res.status <= 504));
      if (shouldRetry) {
        const retryAfter = Number(res.headers.get('retry-after') ?? 0);
        await this.backoff(attempt, retryAfter);
        attempt += 1;
        continue;
      }

      this.throwForResponse(res.status, parsed as Record<string, unknown>);
    }
  }

  private async backoff(attempt: number, retryAfterSec = 0): Promise<void> {
    const explicit = retryAfterSec * 1000;
    const exponential = Math.min(this.maxRetryDelayMs, this.initialRetryDelayMs * 2 ** attempt);
    const jitter = Math.floor(Math.random() * 100);
    await new Promise((resolve) => setTimeout(resolve, Math.max(explicit, exponential) + jitter));
  }

  private throwForResponse(status: number, body: Record<string, unknown>): never {
    const requestId = (body['request_id'] as string) ?? 'unknown';
    const code = (body['code'] as string) ?? 'unknown';
    const message = (body['message'] as string) ?? `HTTP ${status}`;
    if (status === 401) throw new BlocAuthError(message, requestId);
    if (status === 404) throw new BlocNotFoundError(message, requestId);
    if (status === 429) {
      const retryAfter = Number(body['retry_after'] ?? 0);
      throw new BlocRateLimitError(message, requestId, retryAfter);
    }
    throw new BlocAPIError({
      status,
      // Cast to the discriminator union; unknown codes pass through as invalid_request.
      code: (code as BlocAPIError['code']) ?? 'invalid_request',
      message,
      requestId,
    });
  }
}
