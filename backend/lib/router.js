import Groq from 'groq-sdk';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { cache } from './cache.js';

// Initialize clients only if keys are present
const gemmaClient = process.env.GEMMA_BASE_URL
  ? new OpenAI({
      baseURL: process.env.GEMMA_BASE_URL.endsWith('/v1')
        ? process.env.GEMMA_BASE_URL
        : `${process.env.GEMMA_BASE_URL.replace(/\/$/, '')}/v1`,
      apiKey: 'colab-key'
    })
  : null;

const groqClient = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

const openaiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const anthropicClient = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const COST_TABLE = {
  gemma:                    0.0,
  'llama-3.3-70b-versatile': 0.00069,
  'llama-3.1-8b-instant':    0.00007,
  'gpt-4o':                  0.005,
  'gpt-4o-mini':             0.0003,
  'claude-haiku-4-5-20251001': 0.001
};

export async function getP95(name) {
  try {
    const list = await cache.lrange(`vc:p95:${name}`, 0, -1);
    if (!list || list.length < 5) return 0;
    const sorted = list.map(Number).sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length * 0.95)];
  } catch (err) {
    console.error(`Error computing p95 for ${name}:`, err);
    return 0;
  }
}

async function recordLatency(name, latencyMs) {
  try {
    const key = `vc:p95:${name}`;
    await cache.lpush(key, latencyMs);
    await cache.ltrim(key, 0, 99);
  } catch (err) {
    console.error(`Error recording latency for ${name}:`, err);
  }
}

async function isTripped(name) {
  try {
    return !!(await cache.get(`vc:trip:${name}`));
  } catch {
    return false;
  }
}

async function recordFailure(name) {
  try {
    const fails = await cache.incr(`vc:fail:${name}`);
    if (fails >= 3) {
      await cache.set(`vc:trip:${name}`, 'true', { ex: 60 });
      await cache.del(`vc:fail:${name}`);
      console.warn(`⚠️ Circuit breaker tripped for ${name} (60s cooldown)`);
    }
  } catch (err) {
    console.error(`Error recording failure for ${name}:`, err);
  }
}

async function recordSuccess(name) {
  try {
    await cache.del(`vc:fail:${name}`);
  } catch (err) {
    console.error(`Error clearing failure count for ${name}:`, err);
  }
}

export async function route(messages, plan, complexity) {
  const candidates = ['gemma', 'groq', 'openai', 'anthropic'];
  let lastError = null;

  for (const provider of candidates) {
    if (provider === 'gemma'     && !gemmaClient)     continue;
    if (provider === 'groq'      && !groqClient)      continue;
    if (provider === 'openai'    && !openaiClient)    continue;
    if (provider === 'anthropic' && !anthropicClient) continue;

    // Free plan: only gemma + groq
    if (plan === 'free' && (provider === 'openai' || provider === 'anthropic')) continue;

    if (await isTripped(provider)) {
      console.warn(`⏩ Skipping tripped provider: ${provider}`);
      continue;
    }

    try {
      const startTime = Date.now();
      let content = '', model = '', promptTokens = 0, completionTokens = 0;

      if (provider === 'gemma') {
        model = process.env.GEMMA_MODEL_NAME || 'gemma-vibecore';
        const res = await gemmaClient.chat.completions.create(
          { model, messages },
          { timeout: 60000 }
        );
        content          = res.choices[0].message.content;
        promptTokens     = res.usage?.prompt_tokens     || Math.ceil(messages[messages.length - 1].content.split(/\s+/).length / 0.75);
        completionTokens = res.usage?.completion_tokens || Math.ceil(content.split(/\s+/).length / 0.75);

      } else if (provider === 'groq') {
        model = complexity === 'complex' ? 'llama-3.3-70b-versatile' : 'llama-3.1-8b-instant';
        const res = await groqClient.chat.completions.create({ model, messages });
        content          = res.choices[0].message.content;
        promptTokens     = res.usage?.prompt_tokens     || 0;
        completionTokens = res.usage?.completion_tokens || 0;

      } else if (provider === 'openai') {
        model = complexity === 'complex' ? 'gpt-4o' : 'gpt-4o-mini';
        const res = await openaiClient.chat.completions.create({ model, messages });
        content          = res.choices[0].message.content;
        promptTokens     = res.usage?.prompt_tokens     || 0;
        completionTokens = res.usage?.completion_tokens || 0;

      } else if (provider === 'anthropic') {
        model = 'claude-haiku-4-5-20251001';
        const formattedMessages = messages.map(m => ({
          role:    m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content
        }));
        const res = await anthropicClient.messages.create({
          model,
          max_tokens: 1024,
          messages: formattedMessages
        });
        content          = res.content[0].text;
        promptTokens     = res.usage?.input_tokens  || 0;
        completionTokens = res.usage?.output_tokens || 0;
      }

      const latencyMs = Date.now() - startTime;
      await recordSuccess(provider);
      await recordLatency(provider, latencyMs);

      return {
        content,
        provider,
        model,
        promptTokens,
        completionTokens,
        latencyMs,
        costPer1kTokens: COST_TABLE[model] || 0
      };

    } catch (error) {
      console.error(`🔴 Provider ${provider} failed:`, error.message);
      lastError = error;
      await recordFailure(provider);
    }
  }

  throw new Error(`All providers failed. Last error: ${lastError?.message || 'No provider configured'}`);
}
