export class StaleResponseError extends Error {
  constructor() {
    super('The server kept answering with data older than what is already on screen.')
    this.name = 'StaleResponseError'
  }
}

/**
 * Remembers the newest data revision the client has seen, from list reads
 * and registrations. A response older than that arrived out of order: it
 * is discarded and the read repeats, so a late answer never replaces newer
 * data. Cancelling requests reduces such races; this guard closes them,
 * including when a read is shared instead of restarted.
 */
export class RevisionGuard {
  private latest = 0

  note(revision: number): void {
    this.latest = Math.max(this.latest, revision)
  }

  /** Runs `read` until its answer is at least as recent as what was seen, a bounded number of times. */
  async fresh<T extends { readonly revision: number }>(read: () => Promise<T>, attempts = 3): Promise<T> {
    for (let attempt = 1; ; attempt += 1) {
      const result = await read()
      if (result.revision >= this.latest) {
        this.note(result.revision)
        return result
      }
      if (attempt >= attempts) {
        throw new StaleResponseError()
      }
    }
  }

  /** After a demo reset the server's revisions start over. */
  reset(): void {
    this.latest = 0
  }
}

export const revisionGuard = new RevisionGuard()
