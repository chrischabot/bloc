import type { BlocClient } from './client.ts';

export interface ReminderObject {
  object: 'reminder';
  id: string;
  workspace_id: string;
  parent: { type: 'page' | 'block'; id: string };
  user_id: string;
  due_at: string;
  label: string | null;
  fired: boolean;
  fired_at: string | null;
  created_by: string;
  created_at: string;
}

export interface ReminderListResponse {
  object: 'list';
  type: 'reminder';
  results: ReminderObject[];
  next_cursor: string | null;
  has_more: boolean;
}

export class RemindersNamespace {
  constructor(private readonly client: BlocClient) {}

  create(args: {
    parent: { type: 'page' | 'block'; id: string };
    due_at: string;
    label?: string;
    user_id?: string;
  }): Promise<ReminderObject> {
    return this.client.request<ReminderObject>({
      method: 'POST',
      path: '/v1/reminders',
      body: args,
    });
  }

  list(args: { include_fired?: boolean; page_size?: number } = {}): Promise<ReminderListResponse> {
    return this.client.request<ReminderListResponse>({
      method: 'GET',
      path: '/v1/reminders',
      query: {
        ...(args.include_fired !== undefined ? { include_fired: args.include_fired } : {}),
        ...(args.page_size !== undefined ? { page_size: args.page_size } : {}),
      },
    });
  }

  retrieve(args: { reminder_id: string }): Promise<ReminderObject> {
    return this.client.request<ReminderObject>({
      method: 'GET',
      path: `/v1/reminders/${args.reminder_id}`,
    });
  }

  fire(args: { reminder_id: string }): Promise<ReminderObject> {
    return this.client.request<ReminderObject>({
      method: 'POST',
      path: `/v1/reminders/${args.reminder_id}/fire`,
    });
  }

  delete(args: { reminder_id: string }): Promise<void> {
    return this.client.request({
      method: 'DELETE',
      path: `/v1/reminders/${args.reminder_id}`,
    });
  }

  scanDue(): Promise<ReminderListResponse & { now: string }> {
    return this.client.request<ReminderListResponse & { now: string }>({
      method: 'POST',
      path: '/v1/reminders/scan-due',
    });
  }
}
