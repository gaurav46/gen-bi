import { describe, expect, it, vi } from 'vitest';
import { ClaudeDescriptionAdapter } from './claude-description.adapter';

const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = { create: mockCreate };
    },
  };
});

describe('ClaudeDescriptionAdapter', () => {
  it('returns descriptions from Claude response', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';

    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify([
            { tableName: 'orders', columnName: 'amt_1', description: 'Order subtotal amount' },
          ]),
        },
      ],
    });

    const adapter = new ClaudeDescriptionAdapter();
    const result = await adapter.suggestDescriptions([
      { tableName: 'orders', columnName: 'amt_1', dataType: 'numeric', neighborColumns: ['id', 'user_id'] },
    ]);

    expect(result).toEqual([
      { tableName: 'orders', columnName: 'amt_1', description: 'Order subtotal amount' },
    ]);
  });
});
