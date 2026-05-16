import { AINamespace } from './ai.ts';
import { AnalyticsNamespace } from './analytics.ts';
import { AutomationsNamespace, ButtonsNamespace } from './automations.ts';
import { BlocksNamespace } from './blocks.ts';
import { ChartsNamespace } from './charts.ts';
import { type ClientOptions, BlocClient } from './client.ts';
import { CommentsNamespace } from './comments.ts';
import { DataSourcesNamespace } from './data-sources.ts';
import { DatabasesNamespace } from './databases.ts';
import { InboxNamespace } from './inbox.ts';
import { PagesNamespace } from './pages.ts';
import { PermissionsNamespace } from './permissions.ts';
import { RemindersNamespace } from './reminders.ts';
import { SearchNamespace, type SearchResponse } from './search.ts';
import { UsersNamespace } from './users.ts';
import { V3Namespace } from './v3.ts';
import { VersionsNamespace } from './versions.ts';
import { WebhooksNamespace } from './webhooks.ts';

export * from './constants.ts';
export * from './client.ts';
export * from './blocks.ts';
export * from './pages.ts';
export * from './databases.ts';
export * from './users.ts';
export * from './comments.ts';
export * from './search.ts';
export * from './automations.ts';
export * from './webhooks.ts';
export * from './data-sources.ts';
export * from './charts.ts';
export * from './inbox.ts';
export * from './ai.ts';
export * from './v3.ts';
export * from './reminders.ts';
export * from './analytics.ts';
export * from './versions.ts';
export * from './permissions.ts';

export class Bloc {
  readonly client: BlocClient;
  readonly blocks: BlocksNamespace;
  readonly pages: PagesNamespace;
  readonly databases: DatabasesNamespace;
  readonly dataSources: DataSourcesNamespace;
  readonly users: UsersNamespace;
  readonly comments: CommentsNamespace;
  readonly buttons: ButtonsNamespace;
  readonly automations: AutomationsNamespace;
  readonly charts: ChartsNamespace;
  readonly webhooks: WebhooksNamespace;
  readonly inbox: InboxNamespace;
  readonly ai: AINamespace;
  readonly v3: V3Namespace;
  readonly reminders: RemindersNamespace;
  readonly analytics: AnalyticsNamespace;
  readonly versions: VersionsNamespace;
  readonly permissions: PermissionsNamespace;
  readonly #search: SearchNamespace;

  constructor(options: ClientOptions) {
    this.client = new BlocClient(options);
    this.blocks = new BlocksNamespace(this.client);
    this.pages = new PagesNamespace(this.client);
    this.databases = new DatabasesNamespace(this.client);
    this.dataSources = new DataSourcesNamespace(this.client);
    this.users = new UsersNamespace(this.client);
    this.comments = new CommentsNamespace(this.client);
    this.buttons = new ButtonsNamespace(this.client);
    this.automations = new AutomationsNamespace(this.client);
    this.charts = new ChartsNamespace(this.client);
    this.webhooks = new WebhooksNamespace(this.client);
    this.inbox = new InboxNamespace(this.client);
    this.ai = new AINamespace(this.client);
    this.v3 = new V3Namespace(this.client);
    this.reminders = new RemindersNamespace(this.client);
    this.analytics = new AnalyticsNamespace(this.client);
    this.versions = new VersionsNamespace(this.client);
    this.permissions = new PermissionsNamespace(this.client);
    this.#search = new SearchNamespace(this.client);
  }

  search(args?: Parameters<SearchNamespace['call']>[0]): Promise<SearchResponse> {
    return this.#search.call(args ?? {});
  }
}
