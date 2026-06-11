import crypto from 'crypto';
import { pipeline } from '@xenova/transformers';
import { cache } from './cache.js';

const SIMILARITY_THRESHOLD = parseFloat(process.env.SEMANTIC_CACHE_THRESHOLD || '0.88');
const TTL_SECONDS = parseInt(process.env.CACHE_TTL_SECONDS || '86400', 10);

let embedder = null;

async function getEmbedder() {
  if (!embedder) {
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return embedder;
}

function md5(text) {
  return crypto.createHash('md5').update(text).digest('hex');
}

function cosineSimilarity(vecA, vecB) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot   += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function getExact(prompt) {
  try {
    return await cache.get(`vc:exact:${md5(prompt)}`);
  } catch (err) {
    console.error('Cache getExact error:', err);
    return null;
  }
}

export async function setExact(prompt, response) {
  try {
    await cache.set(`vc:exact:${md5(prompt)}`, response, { ex: TTL_SECONDS });
  } catch (err) {
    console.error('Cache setExact error:', err);
  }
}

export async function getSemantic(prompt) {
  try {
    const embedPipe = await getEmbedder();
    const output = await embedPipe(prompt, { pooling: 'mean', normalize: true });
    const promptEmbedding = Array.from(output.data);

    const keys = await cache.smembers('vc:embed_index');
    if (!keys || keys.length === 0) return null;

    const pipe = cache.pipeline();
    keys.forEach(k => pipe.get(k));
    const entries = await pipe.exec();

    let bestMatch = null;
    let highestSim = -1;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!entry) continue;
      const stored = typeof entry === 'string' ? JSON.parse(entry) : entry;
      if (!stored?.embedding) continue;

      const sim = cosineSimilarity(promptEmbedding, stored.embedding);
      if (sim > highestSim) {
        highestSim = sim;
        bestMatch = { response: stored.response, similarity: sim };
      }
    }

    return (highestSim >= SIMILARITY_THRESHOLD && bestMatch) ? bestMatch.response : null;
  } catch (err) {
    console.error('Cache getSemantic error:', err);
    return null;
  }
}

export async function setSemantic(prompt, response) {
  try {
    const embedPipe = await getEmbedder();
    const output = await embedPipe(prompt, { pooling: 'mean', normalize: true });
    const promptEmbedding = Array.from(output.data);

    const hash = md5(prompt);
    const key  = `vc:embed:${hash}`;

    const pipe = cache.pipeline();
    pipe.set(key, JSON.stringify({ prompt, response, embedding: promptEmbedding }), { ex: TTL_SECONDS });
    await pipe.exec();
    await cache.sadd('vc:embed_index', key);
  } catch (err) {
    console.error('Cache setSemantic error:', err);
  }
}

export async function warmup() {
  try {
    console.log('Warming up SemanticCache embedding pipeline...');
    await getEmbedder();
    console.log('SemanticCache pipeline warmed up successfully.');
  } catch (err) {
    console.error('Failed to warm up SemanticCache pipeline:', err);
  }
}
