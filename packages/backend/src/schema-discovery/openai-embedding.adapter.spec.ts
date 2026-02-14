import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAIEmbeddingAdapter } from './openai-embedding.adapter';

describe('OpenAIEmbeddingAdapter', () => {
  let adapter: OpenAIEmbeddingAdapter;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    adapter = new OpenAIEmbeddingAdapter();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it('calls OpenAI embeddings API with text-embedding-3-small model', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { embedding: [0.1, 0.2, 0.3] },
          { embedding: [0.4, 0.5, 0.6] },
        ],
      }),
    });

    const result = await adapter.generateEmbeddings(['users.email varchar', 'users.id uuid']);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/embeddings',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-key',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: ['users.email varchar', 'users.id uuid'],
        }),
      }),
    );
    expect(result).toEqual([[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]);
  });

  it('throws descriptive error when OpenAI API returns non-200', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      text: async () => 'Rate limit exceeded',
    });

    await expect(adapter.generateEmbeddings(['test'])).rejects.toThrow('OpenAI API error: 429 Too Many Requests');
  });

  it('throws error when OPENAI_API_KEY is not set', () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    expect(() => new OpenAIEmbeddingAdapter()).toThrow('OPENAI_API_KEY');
  });
});
