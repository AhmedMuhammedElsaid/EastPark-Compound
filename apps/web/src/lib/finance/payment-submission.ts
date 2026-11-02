import type { PaymentCreateInput } from './schemas';

/**
 * One `Idempotency-Key` per payment submission (plan 3.3). A retry of the same submission re-sends
 * the SAME key and the SAME body, so a lost response can never record the payment twice: the
 * backend replays the original receipt. A key is dropped only once the outcome is known (success
 * or a definite refusal); a new or changed submission (an edit, or `force` after a
 * `duplicateReference` warning) gets a new key, because the backend refuses a reused key with a
 * different body (`idempotencyConflict`).
 */
export type PaymentAttempt = { key: string; body: PaymentCreateInput };

/** Errors after which the request may or may not have been applied: retry with the same key. */
export function isRetryableFailure(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status;
  if (typeof status !== 'number') return true;
  // A 2xx we could not read (contract drift) was applied: keep the key so a retry replays it.
  return status === 0 || (status >= 200 && status < 300) || status === 408 || status === 429 || status >= 500;
}

export function newIdempotencyKey(): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID();
  const bytes = new Uint8Array(16);
  cryptoApi.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export class PaymentSubmission<Result> {
  private pending: PaymentAttempt | null = null;

  constructor(
    private readonly send: (body: PaymentCreateInput, key: string) => Promise<Result>,
    private readonly generateKey: () => string = newIdempotencyKey,
  ) {}

  /** The in-flight or unconfirmed attempt; while set, the form is locked to this body. */
  get unconfirmed(): PaymentAttempt | null {
    return this.pending;
  }

  /**
   * Sends `body`, or re-sends the unconfirmed attempt unchanged (same key, same body) when one
   * exists. Throws the send error; a retryable one keeps the attempt for `submit()` again.
   */
  async submit(body: PaymentCreateInput): Promise<Result> {
    const attempt = this.pending ?? { key: this.generateKey(), body };
    this.pending = attempt;
    try {
      const result = await this.send(attempt.body, attempt.key);
      this.pending = null;
      return result;
    } catch (error) {
      if (!isRetryableFailure(error)) this.pending = null;
      throw error;
    }
  }

  /** Abandons an unconfirmed attempt (the user checked the payments list and wants to edit). */
  discard(): void {
    this.pending = null;
  }
}
