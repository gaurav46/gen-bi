import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { ClaudeAdapter } from './claude.adapter';

const cannedSdkResponse = {
  content: [
    {
      type: 'text' as const,
      text: JSON.stringify({
        intent: 'top_customers',
        title: 'Top Customers by Revenue',
        sql: 'SELECT name, SUM(total) FROM customers GROUP BY name ORDER BY SUM(total) DESC LIMIT 10',
        visualization: { chartType: 'bar' },
        columns: [
          { name: 'name', type: 'varchar', role: 'dimension' },
          { name: 'total', type: 'numeric', role: 'measure' },
        ],
      }),
    },
  ],
};

const mockCreate = vi.fn().mockResolvedValue(cannedSdkResponse);

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = { create: mockCreate };
    },
  };
});

describe('ClaudeAdapter', () => {
  const originalEnv = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockCreate.mockResolvedValue(cannedSdkResponse);
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.ANTHROPIC_API_KEY = originalEnv;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
  });

  it('throws when ANTHROPIC_API_KEY is not set', () => {
    delete process.env.ANTHROPIC_API_KEY;

    expect(() => new ClaudeAdapter()).toThrow('ANTHROPIC_API_KEY is not configured');
  });

  it('calls Anthropic SDK with structured output schema and parses response', async () => {
    const adapter = new ClaudeAdapter();
    const result = await adapter.generateQuery('Show top customers');

    expect(result.intent).toBe('top_customers');
    expect(result.title).toBe('Top Customers by Revenue');
    expect(result.sql).toContain('SELECT');
    expect(result.visualization.chartType).toBe('bar');
    expect(result.columns).toHaveLength(2);

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.output_config.format.type).toBe('json_schema');
    expect(callArgs.output_config.format.schema.required).toContain('intent');
  });

  it('throws when Anthropic API returns an error', async () => {
    mockCreate.mockRejectedValueOnce(new Error('API rate limit exceeded'));

    const adapter = new ClaudeAdapter();

    await expect(adapter.generateQuery('test')).rejects.toThrow('API rate limit exceeded');
  });
});
