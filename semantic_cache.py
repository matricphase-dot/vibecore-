import json
import uuid
import numpy as np
from redis import Redis
from sentence_transformers import SentenceTransformer
import os
import base64
import time

class SemanticCache:
    def __init__(self):
        self.model = SentenceTransformer('all-MiniLM-L6-v2')
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        # Keep decode_responses=True as we store base64 strings
        self.redis = Redis.from_url(redis_url, decode_responses=True)
        self.threshold = 0.88

    def get(self, prompt: str) -> str | None:
        """
        Generate embedding for incoming prompt.
        Compute cosine similarity with top 2000 most recent cached embeddings.
        """
        prompt_embedding = self.model.encode(prompt).astype(np.float32)
        
        # Get top 2000 keys from ZSET (most recent first)
        keys = self.redis.zrevrange("semantic:index", 0, 1999)
        
        if not keys:
            return None

        best_match = None
        highest_similarity = -1.0
        
        # Pipeline for efficiency
        pipe = self.redis.pipeline()
        for key in keys:
            pipe.get(key)
        results = pipe.execute()
        
        for cached_data_str in results:
            if not cached_data_str:
                continue
                
            cached_data = json.loads(cached_data_str)
            # Deserialize base64 embedding
            cached_embedding = np.frombuffer(
                base64.b64decode(cached_data["embedding"]), 
                dtype=np.float32
            )
            
            # Cosine similarity
            norm_prod = np.linalg.norm(prompt_embedding) * np.linalg.norm(cached_embedding)
            if norm_prod == 0: continue
            
            similarity = np.dot(prompt_embedding, cached_embedding) / norm_prod
            
            if similarity > highest_similarity:
                highest_similarity = similarity
                best_match = cached_data["response"]
        
        if highest_similarity >= self.threshold:
            return best_match
            
        return None

    def set(self, prompt: str, response: str):
        """
        Store in Redis with compact base64 embedding and ZSET index.
        """
        embedding = self.model.encode(prompt).astype(np.float32)
        # Compact base64 storage
        embedding_b64 = base64.b64encode(embedding.tobytes()).decode()
        
        cache_id = str(uuid.uuid4())
        timestamp = time.time()
        
        data = {
            "prompt": prompt,
            "response": response,
            "embedding": embedding_b64,
            "timestamp": timestamp
        }
        
        key = f"semantic:{cache_id}"
        
        # Store data and add to index
        pipe = self.redis.pipeline()
        pipe.set(key, json.dumps(data), ex=86400) # TTL 24 hours
        pipe.zadd("semantic:index", {key: timestamp})
        # Optional: Trim ZSET to 10000 entries to prevent infinite growth
        pipe.zremrangebyrank("semantic:index", 0, -10001)
        pipe.execute()

    def warmup(self):
        """Warm up the model into memory."""
        self.model.encode("warmup")
