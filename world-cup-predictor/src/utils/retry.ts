import { logger } from './logger';

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  factor: number;
  retryOn?: (err: unknown) => boolean;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  factor: 2,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: Partial<RetryOptions>,
  context?: string
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (opts.retryOn && !opts.retryOn(err)) {
        throw err;
      }

      if (attempt === opts.maxAttempts) {
        break;
      }

      // Exponential backoff with ±10% jitter to avoid thundering herd
      const baseDelay = opts.baseDelayMs * Math.pow(opts.factor, attempt - 1);
      const jitter = baseDelay * 0.1 * (Math.random() * 2 - 1);
      const delayMs = Math.min(baseDelay + jitter, opts.maxDelayMs);

      logger.warn(`Retry attempt ${attempt}/${opts.maxAttempts - 1}`, {
        context,
        error: err instanceof Error ? err.message : String(err),
        nextDelayMs: Math.round(delayMs),
      });

      await sleep(delayMs);
    }
  }

  logger.error(`All ${opts.maxAttempts} attempts failed`, { context });
  throw lastError;
}
