/**
 * One "attempt" of a state-changing request that the backend can deduplicate with an
 * `Idempotency-Key` header (a UUID). The SAME key is returned while the request body is unchanged,
 * so a retry after a lost response replays the original result instead of creating a duplicate; a
 * NEW key is generated as soon as the body differs (the server answers 409 IDEMPOTENCY_KEY_REUSED
 * when one key is sent with two different bodies). Call `reset()` after a confirmed result or after
 * that 409.
 */
export class IdempotencyAttempt {
  private current: { fingerprint: string; key: string } | null = null;

  keyFor(requestBody: unknown): string {
    const fingerprint = JSON.stringify(requestBody);
    if (!this.current || this.current.fingerprint !== fingerprint) {
      this.current = { fingerprint, key: crypto.randomUUID() };
    }
    return this.current.key;
  }

  reset(): void {
    this.current = null;
  }
}
