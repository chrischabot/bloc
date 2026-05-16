import type { BlocClient } from './client.ts';

export interface PageObject {
  object: 'page';
  id: string;
  parent: Record<string, unknown>;
  created_time: string;
  last_edited_time: string;
  created_by: { object: 'user'; id: string };
  last_edited_by: { object: 'user'; id: string };
  archived: boolean;
  in_trash: boolean;
  icon: unknown;
  cover: unknown;
  properties: Record<string, unknown>;
  url: string;
  public_url: string | null;
}

export interface PropertyItem {
  object: 'property_item';
  id: string;
  type: string;
  [key: string]: unknown;
}

export class PagesPropertiesNamespace {
  constructor(private readonly client: BlocClient) {}

  retrieve(args: { page_id: string; property_id: string }): Promise<PropertyItem> {
    return this.client.request<PropertyItem>({
      method: 'GET',
      path: `/v1/pages/${args.page_id}/properties/${args.property_id}`,
    });
  }
}

export class PagesNamespace {
  readonly properties: PagesPropertiesNamespace;
  constructor(private readonly client: BlocClient) {
    this.properties = new PagesPropertiesNamespace(client);
  }

  create(args: {
    parent: Record<string, unknown>;
    properties?: Record<string, unknown>;
    icon?: Record<string, unknown> | null;
    cover?: Record<string, unknown> | null;
    children?: Array<{ type: string; [key: string]: unknown }>;
  }): Promise<PageObject> {
    return this.client.request<PageObject>({
      method: 'POST',
      path: '/v1/pages',
      body: args,
    });
  }

  retrieve(args: { page_id: string }): Promise<PageObject> {
    return this.client.request<PageObject>({
      method: 'GET',
      path: `/v1/pages/${args.page_id}`,
    });
  }

  update(args: { page_id: string } & Record<string, unknown>): Promise<PageObject> {
    const { page_id, ...rest } = args;
    return this.client.request<PageObject>({
      method: 'PATCH',
      path: `/v1/pages/${page_id}`,
      body: rest,
    });
  }

  /**
   * Soft-archive the page (default) or permanently hard-delete an archived
   * page when `permanent` is true. Mirrors `DELETE /v1/pages/:id` semantics.
   */
  delete(args: { page_id: string; permanent?: boolean }): Promise<PageObject | undefined> {
    const query = args.permanent === true ? { permanent: 'true' } : {};
    return this.client.request<PageObject | undefined>({
      method: 'DELETE',
      path: `/v1/pages/${args.page_id}`,
      query,
    });
  }
}
