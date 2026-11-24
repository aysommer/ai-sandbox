import { WorldExperiment } from '../experiments.ts'
import { World, names, tick, type Report } from '../simulation.ts'
import { CheckpointStore } from './checkpoints.ts'
import type { Command, JournalEntry, WorkerUpdate } from './messages.ts'

/** Owns the live world, simulation clock and autosave inside the worker. */
class SimulationWorker {
  private store?: CheckpointStore
  private world?: World
  private running = false
  private visible = true
  private lastTick = 0
  private remainder = 0
  private pendingFrame = false
  private selected?: number | null
  private journal: JournalEntry[] = []
  private journalDirty = true
  private lastSave = 0
  private saving = false
  private saveAgain = false

  /** Starts the independent clock and subscribes to page commands. */
  constructor() {
    self.addEventListener('message', (event: MessageEvent<Command>) => this.receive(event.data))
    setInterval(() => this.advance(), 50)
  }

  /** Updates the authoritative world in command order. */
  private receive(command: Command) {
    if (command.type === 'init') {
      void this.initialize(command)
      return
    }
    if (!this.world) {
      if (command.type === 'visibility') this.visible = command.visible
      return
    }
    switch (command.type) {
      case 'ack':
        this.pendingFrame = false
        return
      case 'running':
        this.running = command.value
        this.lastTick = performance.now()
        this.remainder = 0
        break
      case 'visibility':
        this.visible = command.visible
        if (command.visible) this.sendFrame(true)
        else void this.save()
        return
      case 'restart':
        this.running = false
        this.world = new World(this.record, command.seed, command.supply)
        this.selected = null
        this.journal = []
        this.record(`Восстановлен старт мира · seed ${command.seed}`, 'world', [])
        break
      case 'place':
        this.place(command)
        break
      case 'compare':
        this.compare(command.seed)
        return
      case 'clear':
        this.journal = []
        this.journalDirty = true
        break
    }
    this.sendFrame(true)
    void this.save()
  }

  /** Loads a saved world or starts a fresh paused session. */
  private async initialize(command: Extract<Command, { type: 'init' }>) {
    this.visible = command.visible
    try {
      if (command.key) {
        this.store = new CheckpointStore(command.key)
        const checkpoint = await this.store.load()
        if (checkpoint) {
          if (checkpoint.version !== 1) throw new Error('Unsupported checkpoint version')
          this.world = World.restore(this.record, checkpoint.world)
          this.running = checkpoint.running
          this.journal = checkpoint.journal
          this.send({ type: 'storage', state: 'restored', timestamp: checkpoint.savedAt })
        }
      } else {
        this.send({ type: 'storage', state: 'unavailable' })
      }
    } catch {
      this.store = undefined
      this.send({ type: 'storage', state: 'unavailable' })
    }
    if (!this.world) {
      this.world = new World(this.record)
      this.record('Мир готов к запуску', 'world', [])
    }
    this.lastTick = performance.now()
    this.sendFrame(true)
    if (!this.lastSave && this.world.seconds === 0) void this.save()
  }

  /** Applies map edits and selects newly created entities. */
  private place(command: Extract<Command, { type: 'place' }>) {
    const { point, tool } = command
    const world = this.world!
    const unavailable = 'Размещение здесь недоступно или достигнут лимит'
    if (tool === 'food' || tool === 'obstacle') {
      const placed = tool === 'food' ? world.addFood(point) : world.addObstacle(point)
      this.record(placed ? (tool === 'food' ? 'Добавлена пища' : 'Добавлено препятствие') : unavailable, 'world', [])
      return
    }
    const agent = world.spawn(point, tool)
    if (agent) this.selected = agent.id
    this.record(agent ? `Добавлен ${names[tool].toLowerCase()} #${agent.id}` : unavailable, 'world', agent ? [agent.id] : [])
  }

  /** Runs both comparison worlds without using or changing the live world. */
  private compare(seed: number) {
    try {
      const results = (['normal', 'scarce'] as const).map(supply => ({
        supply, generations: WorldExperiment.runExperiment(seed, supply),
      }))
      this.send({ type: 'comparison', seed, results })
    } catch {
      this.send({ type: 'comparison', seed })
    }
  }

  /** Advances from elapsed time, amortizing catch-up after timer throttling. */
  private advance() {
    if (!this.world || !this.running) return
    const now = performance.now()
    this.remainder = Math.min(10, this.remainder + (now - this.lastTick) / 1000)
    this.lastTick = now
    let steps = 0
    while (this.remainder >= tick && steps < 60 && (steps === 0 || performance.now() - now < 20)) {
      this.world.step(tick)
      this.remainder -= tick
      steps++
    }
    this.sendFrame()
    if (now - this.lastSave >= 2000) void this.save()
  }

  /** Retains recent world events regardless of whether the page is visible. */
  private readonly record: Report = (message, type, participants) => {
    this.journal.push({ message, type, participants, timestamp: Date.now() })
    if (this.journal.length > 160) this.journal.shift()
    this.journalDirty = true
  }

  /** Sends at most one unacknowledged frame and skips hidden-page redraws. */
  private sendFrame(force = false) {
    if (!this.world || (!force && (!this.visible || this.pendingFrame))) return
    this.pendingFrame = true
    this.send({
      type: 'frame', world: this.world.view(), running: this.running, selected: this.selected,
      journal: this.journalDirty ? this.journal : undefined,
    })
    this.selected = undefined
    this.journalDirty = false
  }

  /** Serializes autosave writes, keeping the latest request if a write is already in flight. */
  private async save() {
    if (!this.store || !this.world) return
    if (this.saving) {
      this.saveAgain = true
      return
    }
    this.saving = true
    this.lastSave = performance.now()
    const savedAt = Date.now()
    try {
      await this.store.save({ version: 1, world: this.world.snapshot(), running: this.running, journal: this.journal.slice(), savedAt })
      this.send({ type: 'storage', state: 'saved', timestamp: savedAt })
    } catch {
      this.send({ type: 'storage', state: 'unavailable' })
    } finally {
      this.saving = false
      if (this.saveAgain) {
        this.saveAgain = false
        void this.save()
      }
    }
  }

  /** Posts one typed update to the page. */
  private send(update: WorkerUpdate) {
    self.postMessage(update)
  }
}

new SimulationWorker()
