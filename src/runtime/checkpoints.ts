import type { Checkpoint } from './messages.ts'

/** Stores one atomic, versioned checkpoint per tab session. */
export class CheckpointStore {
  private readonly database: Promise<IDBDatabase>

  /** Opens the database and creates the checkpoint store when needed. */
  constructor(private readonly key: string) {
    this.database = new Promise((resolve, reject) => {
      const request = indexedDB.open('ai-sandbox', 1)
      request.onupgradeneeded = () => request.result.createObjectStore('checkpoints')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
      request.onblocked = () => reject(new Error('Checkpoint database is blocked'))
    })
  }

  /** Loads the snapshot committed for this tab session. */
  async load(): Promise<Checkpoint | undefined> {
    const database = await this.database
    return new Promise((resolve, reject) => {
      const request = database.transaction('checkpoints').objectStore('checkpoints').get(this.key)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  /** Writes a full checkpoint and resolves only after the transaction commits. */
  async save(checkpoint: Checkpoint) {
    const database = await this.database
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('checkpoints', 'readwrite')
      transaction.oncomplete = () => resolve()
      transaction.onabort = () => reject(transaction.error)
      transaction.objectStore('checkpoints').put(checkpoint, this.key)
    })
  }
}
