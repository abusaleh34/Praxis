import { afterEach, describe, it, expect, vi } from 'vitest';
import { modelHint } from '../src/lib/model.mjs';
import questions from '../content/questions.json';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe('model gateway contract (mocked, not a live quality evaluation)', () => {
  it('requires explicit provider configuration', async () => {
    vi.stubEnv('PRAXIS_AI_API_KEY', '');
    vi.stubEnv('PRAXIS_AI_MODEL', '');
    await expect(modelHint(questions[0], 1, 1)).rejects.toThrow('MODEL_NOT_CONFIGURED');
  });
  it('requests constrained output without learner identity', async () => {
    vi.stubEnv('PRAXIS_AI_API_KEY', 'test-only-placeholder');
    vi.stubEnv('PRAXIS_AI_MODEL', 'test-model');
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    hint: 'ما مجموع الزوايا الداخلية في المثلث؟',
                    highlight: 'all',
                  }),
                },
              },
            ],
            usage: { prompt_tokens: 100, completion_tokens: 15 },
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetch);
    const result = await modelHint(questions[0], 1, 1);
    expect(result.highlight).toBe('all');
    expect(result.inputTokens).toBe(100);
    expect(fetch.mock.calls[0][0]).toBe('https://api.openai.com/v1/chat/completions');
    const request = JSON.parse(fetch.mock.calls[0][1].body);
    expect(request.max_completion_tokens).toBe(350);
    expect(request.messages[1].content).not.toContain('participant');
    expect(request.response_format.json_schema.strict).toBe(true);
  });
  it('rejects arbitrary highlight commands returned by a provider', async () => {
    vi.stubEnv('PRAXIS_AI_API_KEY', 'test-only-placeholder');
    vi.stubEnv('PRAXIS_AI_MODEL', 'test-model');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      hint: 'هذا نص تجريبي طويل',
                      highlight: '<script>unsafe</script>',
                    }),
                  },
                },
              ],
            }),
            { status: 200 },
          ),
        ),
    );
    await expect(modelHint(questions[0], 1, 1)).rejects.toThrow();
  });
});
