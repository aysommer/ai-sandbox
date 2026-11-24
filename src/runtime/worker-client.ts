import type { Command, WorkerUpdate } from './messages.ts'

/** Connects the page to its dedicated worker and allocates a reload-stable session key. */
export class WorkerClient {
  private worker?: Worker

  /** Registers worker updates and reports a failed worker to the page. */
  constructor(update: (message: WorkerUpdate) => void, failed: () => void) {
    try {
      this.worker = new Worker(new URL('./simulation-worker.ts', import.meta.url), { type: 'module' })
      this.worker.addEventListener('message', (event: MessageEvent<WorkerUpdate>) => update(event.data))
      this.worker.addEventListener('error', failed)
    } catch {
      queueMicrotask(failed)
    }
  }

  /** Starts the worker using the checkpoint key retained across this tab’s reloads. */
  start() {
    if (!this.worker) return
    try {
      const key = sessionStorage.getItem('ai-sandbox-session') ?? crypto.randomUUID()
      sessionStorage.setItem('ai-sandbox-session', key)
      this.claim(key)
    } catch {
      this.initialize('')
    }
  }

  /** Posts a typed command without sharing mutable world state. */
  send(command: Command) {
    this.worker?.postMessage(command)
  }

  /** Waits briefly for a reloaded document to release its key before handling a duplicated tab. */
  private claim(key: string) {
    if (!navigator.locks) {
      this.initialize(key)
      return
    }
    const timeout = new AbortController()
    const timer = window.setTimeout(() => timeout.abort(), 600)
    void navigator.locks.request('ai-sandbox:' + key, { signal: timeout.signal }, () => {
      window.clearTimeout(timer)
      this.initialize(key)
      // The browser releases the lock when this document is destroyed.
      return new Promise<void>(() => {})
    }).catch(() => {
      window.clearTimeout(timer)
      if (!timeout.signal.aborted) {
        this.initialize(key)
        return
      }
      try {
        // A duplicated tab can inherit sessionStorage, so it gets its own checkpoint.
        const replacement = crypto.randomUUID()
        sessionStorage.setItem('ai-sandbox-session', replacement)
        this.claim(replacement)
      } catch {
        this.initialize('')
      }
    })
  }

  /** Initializes the worker with the current visibility to avoid redundant rendering. */
  private initialize(key: string) {
    this.send({ type: 'init', key, visible: !document.hidden })
  }
}
