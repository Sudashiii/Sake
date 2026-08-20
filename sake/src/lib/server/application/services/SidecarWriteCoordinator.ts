export class SidecarWriteCoordinator {
  private readonly tails = new Map<number, Promise<void>>();

  async run<T>(bookId: number, operation: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(bookId) ?? Promise.resolve();
    let release: (() => void) | undefined;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.tails.set(bookId, current);

    await previous.catch(() => undefined);
    try {
      return await operation();
    } finally {
      release?.();
      if (this.tails.get(bookId) === current) {
        this.tails.delete(bookId);
      }
    }
  }
}
