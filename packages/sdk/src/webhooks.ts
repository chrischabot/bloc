import type { BlocClient } from './client.ts';

export interface WebhookObject {
  object: 'webhook';
  id: string;
  endpoint_url: string;
  subscribed_events: string[];
  status: string;
  enabled: boolean;
  failure_streak: number;
  filter: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  signing_secret?: string;
  verification?: { ok: boolean; status: number };
}

export interface WebhookDeliveryObject {
  object: 'webhook_delivery';
  id: string;
  webhook_id: string;
  event_id: string;
  event_type: string;
  status: 'pending' | 'success' | 'failed' | 'verification';
  http_status: number | null;
  attempt: number;
  latency_ms: number | null;
  error: string | null;
  created_at: string;
}

export class WebhookDeliveriesNamespace {
  constructor(private readonly client: BlocClient) {}

  list(args: { webhook_id: string }): Promise<{
    object: 'list';
    type: 'webhook_delivery';
    results: WebhookDeliveryObject[];
    next_cursor: string | null;
    has_more: boolean;
  }> {
    return this.client.request({
      method: 'GET',
      path: `/v1/webhooks/${args.webhook_id}/deliveries`,
    });
  }
}

export class WebhooksNamespace {
  readonly deliveries: WebhookDeliveriesNamespace;
  constructor(private readonly client: BlocClient) {
    this.deliveries = new WebhookDeliveriesNamespace(client);
  }

  create(args: {
    endpoint_url: string;
    subscribed_events: string[];
    filter?: Record<string, unknown>;
  }): Promise<WebhookObject> {
    return this.client.request({
      method: 'POST',
      path: '/v1/webhooks',
      body: args,
    });
  }

  list(): Promise<{
    object: 'list';
    type: 'webhook';
    results: WebhookObject[];
    next_cursor: string | null;
    has_more: boolean;
  }> {
    return this.client.request({ method: 'GET', path: '/v1/webhooks' });
  }

  retrieve(args: { webhook_id: string }): Promise<WebhookObject> {
    return this.client.request({ method: 'GET', path: `/v1/webhooks/${args.webhook_id}` });
  }

  update(
    args: { webhook_id: string } & Partial<{
      endpoint_url: string;
      subscribed_events: string[];
      filter: Record<string, unknown>;
    }>,
  ): Promise<WebhookObject> {
    const { webhook_id, ...rest } = args;
    return this.client.request({
      method: 'PATCH',
      path: `/v1/webhooks/${webhook_id}`,
      body: rest,
    });
  }

  delete(args: { webhook_id: string }): Promise<void> {
    return this.client.request({
      method: 'DELETE',
      path: `/v1/webhooks/${args.webhook_id}`,
    });
  }

  ping(args: { webhook_id: string }): Promise<{
    delivered: number;
    succeeded: number;
    failed: number;
  }> {
    return this.client.request({
      method: 'POST',
      path: `/v1/webhooks/${args.webhook_id}/ping`,
    });
  }
}
