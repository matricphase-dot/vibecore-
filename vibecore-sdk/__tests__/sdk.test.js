const VibeCore = require('../index');
const nock = require('nock');

describe('VibeCore SDK', () => {
  const apiKey = 'vc-test-key';
  const apiBase = 'http://localhost:8000';
  let vibecore;

  beforeEach(() => {
    vibecore = new VibeCore({ apiKey });
  });

  test('instantiation with apiKey', () => {
    expect(vibecore.apiKey).toBe(apiKey);
  });

  test('instantiation without apiKey throws error', () => {
    expect(() => new VibeCore({})).toThrow('apiKey is required');
  });

  test('chat.completions.create success', async () => {
    const mockResponse = {
      id: 'chatcmpl-123',
      choices: [{ message: { content: 'Hello!' } }],
      usage: { total_tokens: 10 }
    };

    nock(apiBase)
      .post('/v1/chat/completions')
      .reply(200, mockResponse, {
        'X-VibeCore-Cache': 'MISS',
        'X-VibeCore-Tokens-Saved': '5',
        'X-VibeCore-Provider': 'openai'
      });

    const result = await vibecore.chat.completions.create({
      model: 'auto',
      messages: [{ role: 'user', content: 'Hi' }]
    });

    expect(result.choices[0].message.content).toBe('Hello!');
    expect(result._vibecore.cache).toBe('MISS');
    expect(result._vibecore.tokensSaved).toBe(5);
  });

  test('usage.get success', async () => {
    const mockUsage = { total_requests: 100, cache_hits: 20 };

    nock(apiBase)
      .get('/api/usage')
      .reply(200, mockUsage);

    const result = await vibecore.usage.get();
    expect(result.total_requests).toBe(100);
  });

  test('keys.generate success', async () => {
    const mockKey = { key: 'vc-new', plan: 'free' };

    nock(apiBase)
      .post('/api/keys/generate', { name: 'New Key' })
      .reply(200, mockKey);

    const result = await vibecore.keys.generate('New Key');
    expect(result.key).toBe('vc-new');
  });

  test('network error throws descriptive error', async () => {
    nock(apiBase)
      .post('/v1/chat/completions')
      .replyWithError('Network error');

    await expect(vibecore.chat.completions.create({
      model: 'auto',
      messages: []
    })).rejects.toThrow('VibeCore SDK Error');
  });
});
