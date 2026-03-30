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
    const result = await adapter.generateQuery('Show top customers', 'postgresql');

    expect(result.intent).toBe('top_customers');
    expect(result.title).toBe('Top Customers by Revenue');
    expect(result.sql).toContain('SELECT');
    expect(result.visualization.chartType).toBe('bar');
    expect(result.columns).toHaveLength(2);

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.model).toBe('claude-sonnet-4-5-20250929');
    expect(callArgs.system).toContain('SQL expert');
    expect(callArgs.thinking.type).toBe('enabled');
    expect(callArgs.temperature).toBe(1);
    expect(callArgs.system).toContain('Example');
    expect(callArgs.output_config.format.type).toBe('json_schema');
  });

  it('passes extended thinking config to Anthropic SDK', async () => {
    const adapter = new ClaudeAdapter();
    await adapter.generateQuery('test prompt', 'postgresql');

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.thinking).toEqual({ type: 'enabled', budget_tokens: 10000 });
    expect(callArgs.temperature).toBe(1);
  });

  it('includes few-shot examples in the system prompt', async () => {
    const adapter = new ClaudeAdapter();
    await adapter.generateQuery('any question', 'postgresql');

    const callArgs = mockCreate.mock.calls[0][0];
    const systemPrompt = callArgs.system as string;

    const exampleMatches = systemPrompt.match(/Example \d+:/g) ?? [];
    expect(exampleMatches.length).toBeGreaterThanOrEqual(2);

    const selectMatches = systemPrompt.match(/SELECT/g) ?? [];
    expect(selectMatches.length).toBeGreaterThanOrEqual(2);
  });

  it('builds a PostgreSQL system prompt when dbType is postgresql', async () => {
    const adapter = new ClaudeAdapter();
    await adapter.generateQuery('any question', 'postgresql');

    const callArgs = mockCreate.mock.lastCall![0];
    expect(callArgs.system).toContain('PostgreSQL');
    expect(callArgs.system).not.toContain('T-SQL');
  });

  it('builds a T-SQL system prompt when dbType is sqlserver', async () => {
    const adapter = new ClaudeAdapter();
    await adapter.generateQuery('any question', 'sqlserver');

    const callArgs = mockCreate.mock.lastCall![0];
    expect(callArgs.system).toContain('T-SQL');
    expect(callArgs.system).not.toContain('PostgreSQL dialect');
  });

  it('ignores thinking blocks and parses only the text block', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        { type: 'thinking', thinking: 'Let me reason about the schema...' },
        {
          type: 'text',
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
    });

    const adapter = new ClaudeAdapter();
    const result = await adapter.generateQuery('test', 'postgresql');

    expect(result.intent).toBe('top_customers');
    expect(result).not.toHaveProperty('thinking');
  });

  it('throws when Anthropic API returns an error', async () => {
    mockCreate.mockRejectedValueOnce(new Error('API rate limit exceeded'));

    const adapter = new ClaudeAdapter();

    await expect(adapter.generateQuery('test', 'postgresql')).rejects.toThrow('API rate limit exceeded');
  });
});
