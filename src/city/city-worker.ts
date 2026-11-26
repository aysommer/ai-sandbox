import { CheckpointStore } from '../runtime/checkpoints.ts'
import { CitySimulation } from './simulation.ts'
import type { CityCheckpoint, CityCommand, CityFrame } from './protocol.ts'

/** Owns the city clock and saves city sessions separately from the ecosystem. */
class CityWorker {
  private city?: CitySimulation
  private store?: CheckpointStore<CityCheckpoint>
  private running = false
  private visible = true
  private speed = 1
  private previous = 0
  private pendingMinutes = 0
  private lastSave = 0
  private saving = false
  private saveQueued = false
  private saveState: CityFrame['save'] = 'ready'

  /** Subscribes to the UI and starts the worker clock. */
  constructor() {
    self.addEventListener('message', (event: MessageEvent<CityCommand>) => this.receive(event.data))
    setInterval(() => this.tick(), 150)
  }

  /** Applies UI commands without resetting state when the page is hidden. */
  private receive(command: CityCommand) {
    if (command.type === 'open') {
      this.visible = command.visible
      void this.open(command.key)
      return
    }
    if (command.type === 'visible') this.visible = command.visible
    if (!this.city) return
    switch (command.type) {
      case 'run':
        this.running = command.running
        this.previous = performance.now()
        break
      case 'step':
        if (!this.running) this.city.advance(15)
        break
      case 'speed':
        this.speed = command.value
        break
      case 'visible':
        if (command.visible) this.send()
        else void this.save()
        return
    }
    this.send()
    void this.save()
  }

  /** Reads the last checkpoint for this tab and publishes the first frame. */
  private async open(key?: string) {
    try {
      if (key) {
        this.store = new CheckpointStore<CityCheckpoint>('city:' + key)
        const checkpoint = await this.store.load()
        if (checkpoint?.version === 1) {
          this.city = new CitySimulation(checkpoint.state)
          this.running = checkpoint.running
          this.speed = checkpoint.speed
          this.saveState = 'restored'
        }
      } else this.saveState = 'unavailable'
    } catch {
      this.store = undefined
      this.saveState = 'unavailable'
    }
    this.city ??= new CitySimulation()
    this.previous = performance.now()
    this.send(true)
  }

  /** Keeps city time independent of rendering and caps work per timer callback. */
  private tick() {
    if (!this.city || !this.running) return
    const now = performance.now()
    this.pendingMinutes = Math.min(240, this.pendingMinutes + (now - this.previous) * this.speed / 150)
    this.previous = now
    const minutes = Math.min(30, Math.floor(this.pendingMinutes))
    if (minutes > 0) {
      this.city.advance(minutes)
      this.pendingMinutes -= minutes
      this.send()
    }
    if (now - this.lastSave > 2000) void this.save()
  }

  /** Serializes checkpoints and coalesces requests while a transaction is in flight. */
  private async save() {
    if (!this.city || !this.store) return
    if (this.saving) {
      this.saveQueued = true
      return
    }
    this.saving = true
    this.lastSave = performance.now()
    try {
      const previous = this.saveState
      await this.store.save({ version: 1, state: this.city.snapshot(), running: this.running, speed: this.speed })
      this.saveState = 'saved'
      if (previous !== this.saveState) this.send()
    } catch {
      this.saveState = 'unavailable'
      this.send()
    } finally {
      this.saving = false
      if (this.saveQueued) {
        this.saveQueued = false
        void this.save()
      }
    }
  }

  /** Posts the latest city frame while visible or on initialization. */
  private send(force = false) {
    if (!this.city || (!force && !this.visible)) return
    const frame: CityFrame = { state: this.city.snapshot(), running: this.running, speed: this.speed, save: this.saveState }
    self.postMessage(frame)
  }
}

new CityWorker()
