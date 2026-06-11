# SDK Guide: `vibecore-sdk`

The VibeCore SDK provides a seamless way to integrate intelligent caching and routing into your Node.js applications.

## Installation

```bash
npm install vibecore-sdk
# or
yarn add vibecore-sdk
```

## Initialization

Initialize the client with your VibeCore API key. By default, it connects to the cloud service.

```javascript
import VibeCore from 'vibecore-sdk';

const client = new VibeCore({
  apiKey: 'vc-your-api-key'
});
```

### Self-Hosted
If you are running VibeCore on your own server, specify the `baseUrl`:

```javascript
const client = new VibeCore({
  apiKey: 'vc-your-api-key',
  baseUrl: 'https://your-domain.com'
});
```

---

## Drop-in OpenAI Replacement

VibeCore is designed to be a 1:1 replacement for the OpenAI SDK.

**Before:**
```javascript
import OpenAI from 'openai';
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
```

**After:**
```javascript
import VibeCore from 'vibecore-sdk';
const client = new VibeCore({ apiKey: process.env.VIBECORE_API_KEY });
```

---

## Available Methods

### `client.chat.completions.create(params)`
Creates a completion for a chat conversation.

**Example:**
```javascript
const res = await client.chat.completions.create({
  model: 'auto', // 'auto' uses the smart router
  messages: [{ role: 'user', content: 'What is VibeCore?' }]
});

console.log(res.choices[0].message.content);
```

### `client.usage.get()`
Fetches your current usage statistics.

**Example:**
```javascript
const stats = await client.usage.get();
console.log(`Saved ${stats.tokensSaved} tokens so far!`);
```

### `client.keys.generate(name)`
Generates a new API key.

---

## The `_vibecore` Metadata Object

Every chat response includes a `_vibecore` property containing optimization details:

```javascript
const res = await client.chat.completions.create({...});

console.log(res._vibecore);
/*
{
  cache: 'HIT',
  cacheType: 'semantic',
  tokensSaved: 42,
  costSaved: "$0.0018",
  provider: 'groq',
  latencyMs: 156
}
*/
```

---

## Error Handling

The SDK includes specific error types to help you handle failures gracefully.

```javascript
try {
  const res = await client.chat.completions.create({...});
} catch (err) {
  if (err.name === 'AuthenticationError') {
    console.error('Invalid API Key');
  } else if (err.name === 'RateLimitError') {
    console.error(`Limit reached. Upgrade at: ${err.upgradeUrl}`);
  } else if (err.name === 'ProviderUnavailableError') {
    console.error('All upstream LLMs are currently down.');
  }
}
```
