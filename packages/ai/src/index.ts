/**
 * Provider-agnostic LLM interface used by every Notion AI surface.
 * Implementations:
 *   - StubLLM (in this file) — deterministic, used by tests.
 *   - OpenAILLM / AnthropicLLM (future, env-gated).
 */
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
}

export interface LLMCompletionRequest {
  model: 'default' | 'fast' | 'advanced' | string;
  messages: LLMMessage[];
  /** Optional per-call max tokens. */
  maxOutputTokens?: number;
  /** Optional grounding context (e.g. retrieved page snippets). */
  context?: Array<{ pageId: string; snippet: string }>;
}

export interface LLMCompletionResult {
  text: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  /** Optional grounding citations the model produced. */
  citations?: Array<{ pageId: string; snippet: string; score: number }>;
}

export interface LLMEmbeddingResult {
  vector: number[];
  tokensIn: number;
}

export interface LLM {
  /** Synchronous chat completion (no streaming). */
  chat(request: LLMCompletionRequest): Promise<LLMCompletionResult>;
  /** Streaming completion: yields tokens. Default impl falls back to chat(). */
  chatStream?(request: LLMCompletionRequest): AsyncIterable<string>;
  /** Optional embedding for retrieval. */
  embed?(text: string): Promise<LLMEmbeddingResult>;
}

/**
 * Stub LLM: deterministic, no network. The output is shaped to mention every
 * `context` snippet so tests can assert grounding behaviour.
 */
export class StubLLM implements LLM {
  async chat(request: LLMCompletionRequest): Promise<LLMCompletionResult> {
    const start = performance.now();
    const userMsg = request.messages.findLast?.((m) => m.role === 'user');
    const last = userMsg?.content ?? '';
    const ctxNote =
      request.context && request.context.length > 0
        ? ` (cites: ${request.context.map((c) => c.pageId.slice(0, 8)).join(', ')})`
        : '';
    const text = `stub-response[${last.slice(0, 80)}]${ctxNote}`;
    const tokensIn = sumTokens(request.messages);
    const tokensOut = Math.ceil(text.length / 4);
    return {
      text,
      tokensIn,
      tokensOut,
      latencyMs: Math.round(performance.now() - start),
      citations: request.context?.map((c) => ({ ...c, score: 0.9 })) ?? undefined,
    };
  }

  async *chatStream(request: LLMCompletionRequest): AsyncIterable<string> {
    const result = await this.chat(request);
    // Yield in 8-char chunks.
    for (let i = 0; i < result.text.length; i += 8) {
      yield result.text.slice(i, i + 8);
    }
  }

  async embed(text: string): Promise<LLMEmbeddingResult> {
    // 8-dim deterministic embedding (sum of char codes, mod 1).
    const vector = new Array(8).fill(0).map((_, idx) => {
      let v = 0;
      for (let i = idx; i < text.length; i += 8) {
        v += text.charCodeAt(i);
      }
      return Math.sin(v) / 2 + 0.5;
    });
    return { vector, tokensIn: Math.ceil(text.length / 4) };
  }
}

function sumTokens(messages: LLMMessage[]): number {
  return messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
}

/** Factory: returns the right provider based on env. Tests default to stub. */
export function createLLM(): LLM {
  const provider = process.env['AI_PROVIDER'] ?? 'stub';
  if (provider === 'stub') return new StubLLM();
  // Real providers ship in v1.1. For now anything else falls back to the stub
  // to keep development and test environments deterministic.
  return new StubLLM();
}
