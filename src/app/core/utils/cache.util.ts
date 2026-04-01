/**
 * Cache utility for Firestore queries
 * Provides intelligent caching to reduce API calls and improve performance
 */

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

export interface CacheOptions {
  ttlMs?: number; // Time to live in milliseconds
  maxSize?: number; // Maximum number of entries in cache
}

const DEFAULT_CACHE_OPTIONS: Required<CacheOptions> = {
  ttlMs: 5 * 60 * 1000, // 5 minutes default
  maxSize: 100
};

/**
 * Simple in-memory cache with TTL and size limits
 */
export class QueryCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private options: Required<CacheOptions>;

  constructor(options: CacheOptions = {}) {
    this.options = { ...DEFAULT_CACHE_OPTIONS, ...options };
  }

  /**
   * Get a value from cache
   * Returns undefined if not found or expired
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.data;
  }

  /**
   * Set a value in cache
   */
  set(key: string, data: T): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.options.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + this.options.ttlMs
    });
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Delete a specific key from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries from cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxSize: number; ttlMs: number } {
    return {
      size: this.cache.size,
      maxSize: this.options.maxSize,
      ttlMs: this.options.ttlMs
    };
  }

  /**
   * Invalidate all cache entries matching a pattern
   */
  invalidatePattern(pattern: RegExp): number {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }
}

/**
 * Global query cache instance for Firestore queries
 */
export const firestoreQueryCache = new QueryCache<any>({
  ttlMs: 5 * 60 * 1000, // 5 minutes
  maxSize: 100
});

/**
 * Cache key generator for Firestore queries
 */
export function generateCacheKey(collection: string, queryParts: string[]): string {
  return `${collection}:${queryParts.join(':')}`;
}

/**
 * Wrapper function to execute a query with caching
 * @param cacheKey - Unique key for the cache entry
 * @param queryFn - Async function that executes the query
 * @param options - Cache options
 * @returns Promise with the query result (from cache or fresh)
 */
export async function withCache<T>(
  cacheKey: string,
  queryFn: () => Promise<T>,
  options: { skipCache?: boolean; forceRefresh?: boolean } = {}
): Promise<T> {
  // Skip cache if requested
  if (options.skipCache) {
    return queryFn();
  }

  // Check cache first (unless force refresh)
  if (!options.forceRefresh) {
    const cached = firestoreQueryCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }
  }

  // Execute query
  const result = await queryFn();

  // Store in cache
  firestoreQueryCache.set(cacheKey, result);

  return result;
}

/**
 * Invalidate cache entries for a specific collection
 */
export function invalidateCollectionCache(collection: string): number {
  return firestoreQueryCache.invalidatePattern(new RegExp(`^${collection}:`));
}
