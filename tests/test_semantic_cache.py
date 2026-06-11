import pytest
import numpy as np
from unittest.mock import MagicMock, patch
from semantic_cache import SemanticCache
import json
import base64

@pytest.fixture
def mock_cache():
    with patch('semantic_cache.SentenceTransformer') as mock_model:
        # Mock encode to return specific vectors
        def side_effect(prompt):
            if "ML" in prompt:
                return np.array([1.0, 0.0, 0.0] + [0.0]*381, dtype=np.float32)
            if "machine learning" in prompt:
                return np.array([0.99, 0.01, 0.0] + [0.0]*381, dtype=np.float32)
            if "quantum" in prompt:
                return np.array([0.0, 1.0, 0.0] + [0.0]*381, dtype=np.float32)
            return np.zeros(384, dtype=np.float32)
        
        mock_model.return_value.encode.side_effect = side_effect
        cache = SemanticCache()
        # Ensure we use fake redis from conftest if possible, but here we can just mock or use fakeredis
        import fakeredis
        cache.redis = fakeredis.FakeRedis(decode_responses=True)
        return cache

def test_cache_miss_on_empty(mock_cache):
    assert mock_cache.get("anything") is None

def test_set_and_exact_get(mock_cache):
    mock_cache.set("What is ML?", "It's a subset of AI")
    assert mock_cache.get("What is ML?") == "It's a subset of AI"

def test_semantic_hit_above_threshold(mock_cache):
    mock_cache.set("What is ML?", "It's a subset of AI")
    # "machine learning" vector is very close to "ML" vector
    assert mock_cache.get("What is machine learning?") == "It's a subset of AI"

def test_semantic_miss_below_threshold(mock_cache):
    mock_cache.set("What is ML?", "It's a subset of AI")
    # "quantum" vector is orthogonal to "ML"
    assert mock_cache.get("What is quantum physics?") is None

def test_ttl_is_set(mock_cache):
    mock_cache.set("test", "res")
    keys = mock_cache.redis.keys("semantic:*")
    # Filter out index key
    data_keys = [k for k in keys if k != "semantic:index"]
    assert len(data_keys) == 1
    ttl = mock_cache.redis.ttl(data_keys[0])
    assert 0 < ttl <= 86400

def test_zset_index_updated(mock_cache):
    mock_cache.set("test", "res")
    assert mock_cache.redis.exists("semantic:index")
    assert mock_cache.redis.zcard("semantic:index") == 1

def test_embedding_stored_as_base64(mock_cache):
    mock_cache.set("test", "res")
    keys = mock_cache.redis.keys("semantic:*")
    data_key = [k for k in keys if k != "semantic:index"][0]
    data = json.loads(mock_cache.redis.get(data_key))
    # Should be valid base64
    embedding_bytes = base64.b64decode(data["embedding"])
    assert len(embedding_bytes) == 384 * 4 # 384 float32s

def test_embedding_roundtrip(mock_cache):
    original_vector = np.array([0.1, 0.2, 0.3] + [0.0]*381, dtype=np.float32)
    mock_cache.model.encode = MagicMock(return_value=original_vector)
    
    mock_cache.set("roundtrip", "ok")
    
    # Retrieve and decode
    keys = mock_cache.redis.keys("semantic:*")
    data_key = [k for k in keys if k != "semantic:index"][0]
    data = json.loads(mock_cache.redis.get(data_key))
    decoded_vector = np.frombuffer(base64.b64decode(data["embedding"]), dtype=np.float32)
    
    assert np.allclose(original_vector, decoded_vector)
