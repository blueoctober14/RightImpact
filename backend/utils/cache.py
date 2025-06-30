import os
import logging
import time
import redis.asyncio as redis
from functools import wraps

logger = logging.getLogger(__name__)

# Redis configuration
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
REDIS_POOL_SIZE = int(os.getenv("REDIS_POOL_SIZE", "10"))
REDIS_TIMEOUT = int(os.getenv("REDIS_TIMEOUT", "2"))  # 2 second timeout

# Singleton pattern for Redis connection pool
class RedisCache:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(RedisCache, cls).__new__(cls)
            cls._instance._initialize()
        return cls._instance
    
    def _initialize(self):
        """Initialize the Redis connection pool with proper settings."""
        try:
            logger.info(f"Initializing Redis connection pool with size {REDIS_POOL_SIZE}")
            self.pool = redis.ConnectionPool.from_url(
                REDIS_URL,
                decode_responses=True,
                max_connections=REDIS_POOL_SIZE,
                socket_timeout=REDIS_TIMEOUT,
                socket_connect_timeout=REDIS_TIMEOUT,
                health_check_interval=30
            )
            self.client = redis.Redis.from_pool(self.pool)
            logger.info("Redis connection pool initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Redis: {e}")
            # Fallback to a dummy implementation that won't break the application
            self.client = None
    
    async def get(self, key, default=None):
        """Get a value from Redis with error handling."""
        if self.client is None:
            return default
            
        try:
            start_time = time.time()
            value = await self.client.get(key)
            elapsed = (time.time() - start_time) * 1000
            
            if elapsed > 100:  # Log slow operations (>100ms)
                logger.warning(f"Slow Redis GET: {key} took {elapsed:.2f}ms")
                
            return value
        except redis.RedisError as e:
            logger.error(f"Redis GET error for key {key}: {e}")
            return default
    
    async def set(self, key, value, ex=None):
        """Set a value in Redis with error handling."""
        if self.client is None:
            return False
            
        try:
            start_time = time.time()
            result = await self.client.set(key, value, ex=ex)
            elapsed = (time.time() - start_time) * 1000
            
            if elapsed > 100:  # Log slow operations (>100ms)
                logger.warning(f"Slow Redis SET: {key} took {elapsed:.2f}ms")
                
            return result
        except redis.RedisError as e:
            logger.error(f"Redis SET error for key {key}: {e}")
            return False
    
    async def delete(self, key):
        """Delete a key from Redis with error handling."""
        if self.client is None:
            return 0
            
        try:
            return await self.client.delete(key)
        except redis.RedisError as e:
            logger.error(f"Redis DELETE error for key {key}: {e}")
            return 0
    
    async def scan_iter(self, match=None):
        """Scan for keys matching a pattern with error handling."""
        if self.client is None:
            # Can't yield anything if client is None
            return
            
        try:
            async for key in self.client.scan_iter(match=match):
                yield key
        except redis.RedisError as e:
            logger.error(f"Redis SCAN error for pattern {match}: {e}")
            # Just return without yielding anything else

# Create the singleton instance
redis_cache = RedisCache()

async def delete_pattern(pattern: str):
    """
    Delete all keys matching the given pattern from Redis (async).
    With error handling and performance logging.
    """
    if redis_cache.client is None:
        logger.warning(f"Redis not available, skipping delete_pattern for {pattern}")
        return 0
        
    try:
        start_time = time.time()
        count = 0
        
        async for key in redis_cache.scan_iter(match=pattern):
            await redis_cache.delete(key)
            count += 1
            
        elapsed = (time.time() - start_time) * 1000
        if elapsed > 100 or count > 10:  # Log if slow or many keys deleted
            logger.info(f"Redis delete_pattern: {pattern} deleted {count} keys in {elapsed:.2f}ms")
            
        return count
    except Exception as e:
        logger.error(f"Error in delete_pattern for {pattern}: {e}")
        return 0

import json

def cache_decorator(prefix, ttl=300):
    """
    Decorator to cache function results in Redis.
    
    Args:
        prefix: Prefix for the cache key
        ttl: Time to live in seconds (default: 5 minutes)
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start_time = time.time()
            
            # Generate a cache key based on function arguments
            key_parts = [prefix, func.__name__]
            
            # Add positional args to key
            for arg in args:
                if hasattr(arg, 'id'):  # For database objects
                    key_parts.append(f"{arg.__class__.__name__}_{arg.id}")
                else:
                    key_parts.append(str(arg))
            
            # Add keyword args to key
            for k, v in sorted(kwargs.items()):
                if k == 'db':  # Skip database session
                    continue
                if hasattr(v, 'id'):  # For database objects
                    key_parts.append(f"{k}_{v.__class__.__name__}_{v.id}")
                else:
                    key_parts.append(f"{k}_{v}")
            
            cache_key = ":".join(key_parts)
            
            # Try to get from cache first
            cached = await redis_cache.get(cache_key)
            if cached:
                try:
                    # Parse the JSON string back to the original data structure
                    parsed_result = json.loads(cached)
                    elapsed = (time.time() - start_time) * 1000
                    logger.info(f"Cache hit for {func.__name__} in {elapsed:.2f}ms")
                    return parsed_result
                except json.JSONDecodeError:
                    # If not JSON, return as is
                    return cached
            
            # Cache miss - call the function
            function_start = time.time()
            result = await func(*args, **kwargs)
            function_time = (time.time() - function_start) * 1000
            
            # Cache the result if not None
            if result is not None:
                try:
                    # Convert result to JSON string for storage
                    json_result = json.dumps(result)
                    await redis_cache.set(cache_key, json_result, ex=ttl)
                except (TypeError, Exception):
                    # If can't serialize to JSON, try storing as string
                    logger.warning(f"Could not JSON serialize result for {func.__name__}, storing as string")
                    await redis_cache.set(cache_key, str(result), ex=ttl)
            
            elapsed = (time.time() - start_time) * 1000
            logger.info(f"Cache miss for {func.__name__}, function took {function_time:.2f}ms, total {elapsed:.2f}ms")
            return result
        return wrapper
    return decorator
