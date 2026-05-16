import type { BlocClient } from './client.ts';

export type AISurface = 'writer' | 'ai_block' | 'agent' | 'autofill' | 'qa';
export type AIModel = 'default' | 'fast' | 'advanced';

export interface AICompletionResponse {
  object: 'ai_completion';
  surface: AISurface;
  model: AIModel;
  text: string;
  tokens_in: number;
  tokens_out: number;
  citations: Array<{ pageId: string; snippet: string; score: number }>;
}

export interface AIAnswerResponse {
  object: 'ai_answer';
  answer: string;
  sources: Array<{ page_id: string; snippet: string; score: number }>;
}

export interface AIAgentResponse {
  object: 'agent_run';
  task_id: string;
  status: 'success' | 'partial' | 'failed';
  goal: string;
  steps: Array<{
    index: number;
    type: 'tool_call' | 'llm';
    tool?: string;
    input?: Record<string, unknown>;
    output?: unknown;
    message?: string;
    status: 'success' | 'failed';
    duration_ms: number;
  }>;
  message: string;
}

export class AINamespace {
  constructor(private readonly client: BlocClient) {}

  completions(args: {
    surface?: AISurface;
    model?: AIModel;
    messages: Array<{
      role: 'system' | 'user' | 'assistant' | 'tool';
      content: string;
      name?: string;
    }>;
    context_pages?: string[];
    /** When set + surface='ai_block', persist the completion into that block. */
    block_id?: string;
  }): Promise<AICompletionResponse> {
    return this.client.request<AICompletionResponse>({
      method: 'POST',
      path: '/v1/ai/completions',
      body: args,
    });
  }

  qa(args: {
    query: string;
    filter?: { object?: 'page' | 'database' };
  }): Promise<AIAnswerResponse> {
    return this.client.request<AIAnswerResponse>({
      method: 'POST',
      path: '/v1/ai/qa',
      body: args,
    });
  }

  autofillRun(args: {
    page_id: string;
    property_id: string;
    instructions?: string;
  }): Promise<{ object: 'property_item'; id: string; type: string; [key: string]: unknown }> {
    return this.client.request({
      method: 'POST',
      path: '/v1/ai/autofill/run',
      body: args,
    });
  }

  agent(args: {
    goal: string;
    max_iterations?: number;
    context_pages?: string[];
  }): Promise<AIAgentResponse> {
    return this.client.request<AIAgentResponse>({
      method: 'POST',
      path: '/v1/ai/agent',
      body: args,
    });
  }
}
