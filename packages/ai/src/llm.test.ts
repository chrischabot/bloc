import { describe, expect, it } from 'vitest';
import { StubLLM } from './index.ts';

describe('StubLLM', () => {
  it('returns deterministic text echoing the user message', async () => {
    const llm = new StubLLM();
    const result = await llm.chat({
      model: 'default',
      messages: [{ role: 'user', content: 'hello' }],
    });
    expect(result.text).toContain('hello');
    expect(result.tokensIn).toBeGreaterThan(0);
    expect(result.tokensOut).toBeGreaterThan(0);
  });

  it('reflects context snippets as citations', async () => {
    const llm = new StubLLM();
    const result = await llm.chat({
      model: 'default',
      messages: [{ role: 'user', content: 'tell me about X' }],
      context: [{ pageId: '11111111-1111-1111-1111-111111111111', snippet: 'X is great' }],
    });
    expect(result.citations).toHaveLength(1);
    expect(result.citations![0]!.pageId).toBe('11111111-1111-1111-1111-111111111111');
  });

  it('streams tokens', async () => {
    const llm = new StubLLM();
    const out: string[] = [];
    for await (const chunk of llm.chatStream({
      model: 'default',
      messages: [{ role: 'user', content: 'streamtest' }],
    })) {
      out.push(chunk);
    }
    expect(out.join('')).toContain('streamtest');
  });

  it('embeds text', async () => {
    const llm = new StubLLM();
    const { vector, tokensIn } = await llm.embed('hello world');
    expect(vector).toHaveLength(8);
    expect(tokensIn).toBeGreaterThan(0);
  });
});
