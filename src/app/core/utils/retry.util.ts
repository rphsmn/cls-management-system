/**
 * Retry utility with exponential backoff for Firestore operations
 * Helps prevent API failures and handles transient errors gracefully
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableErrors: [
    'resource-exhausted',
    'unavailable',
    'deadline-exceeded',
    'aborted',
    'quota',
    'too-many-requests',
    'network-error',
    'timeout'
  ]
};

/**
 * Check if an error is retryable based on error message or code
 */
export function isRetryableError(error: unknown, retryableErrors: string[]): boolean {
  const errorMessage = (error as Error)?.message?.toLowerCase() || '';
  const errorCode = (error as any)?.code?.toLowerCase() || '';
  
  return retryableErrors.some(retryableError => 
    errorMessage.includes(retryableError.toLowerCase()) ||
    errorCode.includes(retryableError.toLowerCase())
  );
}

/**
 * Get user-friendly error message based on error code
 */
export function getUserFriendlyErrorMessage(error: unknown): string {
  const errorCode = (error as any)?.code?.toLowerCase() || '';
  const errorMessage = (error as Error)?.message?.toLowerCase() || '';
  
  // Firestore-specific error codes
  if (errorCode === 'resource-exhausted' || errorMessage.includes('quota')) {
    return 'Service temporarily unavailable due to high demand. Please try again in a few minutes.';
  }
  
  if (errorCode === 'unavailable' || errorMessage.includes('unavailable')) {
    return 'Service is temporarily unavailable. Please try again later.';
  }
  
  if (errorCode === 'deadline-exceeded' || errorMessage.includes('timeout')) {
    return 'Request timed out. Please check your connection and try again.';
  }
  
  if (errorCode === 'permission-denied' || errorMessage.includes('permission')) {
    return 'You do not have permission to perform this action.';
  }
  
  if (errorCode === 'not-found' || errorMessage.includes('not found')) {
    return 'The requested resource was not found.';
  }
  
  if (errorCode === 'already-exists' || errorMessage.includes('already exists')) {
    return 'This resource already exists.';
  }
  
  if (errorCode === 'aborted' || errorMessage.includes('aborted')) {
    return 'Operation was aborted. Please try again.';
  }
  
  if (errorCode === 'cancelled' || errorMessage.includes('cancelled')) {
    return 'Operation was cancelled.';
  }
  
  if (errorCode === 'data-loss' || errorMessage.includes('data loss')) {
    return 'Data loss detected. Please contact support.';
  }
  
  if (errorCode === 'internal' || errorMessage.includes('internal')) {
    return 'An internal error occurred. Please try again later.';
  }
  
  if (errorCode === 'invalid-argument' || errorMessage.includes('invalid')) {
    return 'Invalid request. Please check your input and try again.';
  }
  
  if (errorCode === 'out-of-range' || errorMessage.includes('out of range')) {
    return 'Value out of allowed range.';
  }
  
  if (errorCode === 'unauthenticated' || errorMessage.includes('unauthenticated')) {
    return 'Please log in to continue.';
  }
  
  // Network errors
  if (errorMessage.includes('network') || errorMessage.includes('offline')) {
    return 'Network error. Please check your internet connection.';
  }
  
  // Default message
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt: number, options: Required<RetryOptions>): number {
  const exponentialDelay = options.initialDelayMs * Math.pow(options.backoffMultiplier, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay; // Add 0-30% jitter
  return Math.min(exponentialDelay + jitter, options.maxDelayMs);
}

/**
 * Execute a function with retry logic and exponential backoff
 * @param fn - Async function to execute
 * @param options - Retry configuration options
 * @returns Promise with the result of the function
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config: Required<RetryOptions> = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry if this is the last attempt or error is not retryable
      if (attempt === config.maxRetries || !isRetryableError(error, config.retryableErrors)) {
        throw error;
      }
      
      // Calculate delay and wait
      const delay = calculateDelay(attempt, config);
      console.warn(`Retry attempt ${attempt + 1}/${config.maxRetries} after ${delay}ms`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Create a debounced version of an async function
 * Prevents multiple rapid calls from overwhelming the API
 */
export function debounceAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  delayMs: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let latestResolve: ((value: ReturnType<T>) => void) | null = null;
  let latestReject: ((reason?: any) => void) | null = null;
  
  return (...args: Parameters<T>): Promise<ReturnType<T>> => {
    return new Promise((resolve, reject) => {
      // Clear previous timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      // Store latest resolve/reject
      latestResolve = resolve;
      latestReject = reject;
      
      // Set new timeout
      timeoutId = setTimeout(async () => {
        try {
          const result = await fn(...args);
          if (latestResolve) {
            latestResolve(result);
          }
        } catch (error) {
          if (latestReject) {
            latestReject(error);
          }
        }
      }, delayMs);
    });
  };
}

/**
 * Request deduplication cache
 * Prevents duplicate concurrent requests for the same resource
 */
const pendingRequests = new Map<string, Promise<any>>();

/**
 * Deduplicate concurrent requests for the same key
 * @param key - Unique identifier for the request
 * @param fn - Async function to execute
 * @returns Promise that resolves to the result (shared across concurrent calls)
 */
export async function deduplicatedRequest<T>(
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  // If there's already a pending request for this key, return it
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key) as Promise<T>;
  }
  
  // Create new request and add to cache
  const promise = fn().finally(() => {
    // Remove from cache when done (success or failure)
    pendingRequests.delete(key);
  });
  
  pendingRequests.set(key, promise);
  return promise;
}
