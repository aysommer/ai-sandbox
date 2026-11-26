import type { Command, WorkerUpdate } from './messages.ts'
import { TabSession } from './tab-session.ts'

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
    TabSession.open('ai-sandbox-session', key => this.initialize(key ?? ''))
  }

  /** Posts a typed command without sharing mutable world state. */
  send(command: Command) {
    this.worker?.postMessage(command)
  }

  /** Initializes the worker with the current visibility to avoid redundant rendering. */
  private initialize(key: string) {
    this.send({ type: 'init', key, visible: !document.hidden })
  }
}
