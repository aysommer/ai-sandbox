import { type FoodSupply, type Point, type WorldView } from '../simulation.ts'
import { EventJournal } from './journal.ts'
import { WorldMap } from './world-map.ts'
import { SelectionPanel } from './selection-panel.ts'
import { ExperimentPanel } from './experiment-panel.ts'
import { WorkerClient } from '../runtime/worker-client.ts'
import type { WorkerUpdate } from '../runtime/messages.ts'

const instructions = {
  select: 'Выберите сущность на карте',
  forager: 'Нажмите на карту, чтобы разместить собирателя',
  hunter: 'Нажмите на карту, чтобы разместить хищника',
  food: 'Нажмите на карту, чтобы разместить пищу',
  obstacle: 'Нажмите на карту, чтобы разместить препятствие',
}
type Tool = keyof typeof instructions

/** Sends page commands to the worker and renders its latest world view. */
export class Sandbox {
  private readonly run = document.querySelector<HTMLButtonElement>('#run')!
  private readonly restartButton = document.querySelector<HTMLButtonElement>('#restart')!
  private readonly status = document.querySelector('#status')!
  private readonly storage = document.querySelector('#storage-status')!
  private readonly stats = document.querySelector('#stats')!
  private readonly help = document.querySelector('#map-help')!
  private readonly tools = document.querySelectorAll<HTMLButtonElement>('[data-tool]')
  private readonly seed = document.querySelector<HTMLInputElement>('#seed')!
  private readonly supply = document.querySelector<HTMLSelectElement>('#supply')!
  private readonly worker = new WorkerClient(message => this.receive(message), () => this.fail())
  private readonly journal = new EventJournal(() => this.worker.send({ type: 'clear' }))
  private readonly map = new WorldMap(() => this.draw(), point => this.place(point))
  private readonly selection = new SelectionPanel(id => this.select(id))
  private readonly comparison = new ExperimentPanel(() => this.readSeed(), seed => this.worker.send({ type: 'compare', seed }))
  private world?: WorldView
  private tool: Tool = 'select'
  private selected: number | undefined
  private running = false

  /** Binds controls, then requests checkpoint restoration before accepting edits. */
  constructor() {
    this.seed.required = true
    for (const button of this.tools) button.addEventListener('click', () => this.selectTool(button))
    this.run.addEventListener('click', () => {
      this.run.disabled = true
      this.worker.send({ type: 'running', value: !this.running })
    })
    document.querySelector('#reset')!.addEventListener('click', () => {
      this.map.reset()
      this.draw()
    })
    this.restartButton.addEventListener('click', () => this.restart())
    document.addEventListener('visibilitychange', () => this.updateVisibility(!document.hidden))
    window.addEventListener('pagehide', () => this.updateVisibility(false))
    window.addEventListener('pageshow', () => this.updateVisibility(!document.hidden))
    this.worker.start()
  }

  /** Reports page visibility without tying the worker clock to redraws. */
  private updateVisibility(visible: boolean) {
    this.worker.send({ type: 'visibility', visible })
  }

  /** Renders saved-state notifications and acknowledges completed frames. */
  private receive(update: WorkerUpdate) {
    if (update.type === 'storage') {
      this.renderStorage(update)
      return
    }
    if (update.type === 'comparison') {
      this.comparison.render(update)
      return
    }
    if (!this.world) {
      this.comparison.enable()
      this.seed.value = String(update.world.seed)
      this.supply.value = update.world.supply
    }
    this.world = update.world
    if (update.selected !== undefined) this.selected = update.selected ?? undefined
    if (update.journal) this.journal.replace(update.journal)
    this.running = update.running
    this.run.disabled = this.restartButton.disabled = false
    this.run.textContent = this.running ? 'Пауза' : 'Запустить'
    this.status.textContent = this.running ? 'Симуляция идёт' : 'Пауза'
    if (!document.hidden) this.render()
    this.worker.send({ type: 'ack' })
  }

  /** Shows the last successful checkpoint or a storage error. */
  private renderStorage(update: Extract<WorkerUpdate, { type: 'storage' }>) {
    if (update.timestamp === undefined) {
      this.storage.textContent = 'Локальное сохранение недоступно'
      return
    }
    const time = new Date(update.timestamp).toLocaleTimeString('ru-RU')
    if (update.state === 'restored') this.storage.textContent = 'Восстановлено сохранение от ' + time
    else this.storage.textContent = 'Сохранено в ' + time
  }

  /** Disables edits if the simulation worker cannot run. */
  private fail() {
    this.status.textContent = 'Ошибка симуляции'
    this.storage.textContent = 'Не удалось запустить фоновый процесс'
    this.run.disabled = this.restartButton.disabled = true
    this.world = undefined
  }

  /** Reads a valid seed or lets the browser report the field error. */
  private readSeed() {
    if (this.seed.reportValidity()) return this.seed.valueAsNumber
  }

  /** Requests a new paused world and clears the selection. */
  private restart() {
    const seed = this.readSeed()
    if (seed === undefined) return
    this.selected = undefined
    this.map.reset()
    this.worker.send({ type: 'restart', seed, supply: this.supply.value as FoodSupply })
  }

  /** Synchronizes tool selection and the map instructions. */
  private selectTool(button: HTMLButtonElement) {
    this.tool = button.dataset.tool as Tool
    for (const item of this.tools) item.setAttribute('aria-pressed', String(item === button))
    this.help.textContent = instructions[this.tool]
  }

  /** Selects an entity and refreshes the page and map. */
  private select(id: number | undefined) {
    this.selected = id
    this.render()
  }

  /** Applies map selection locally and forwards world edits to the worker. */
  private place(point: Point) {
    if (!this.world) return
    if (this.tool === 'select') {
      this.select(this.world.agents.findLast(agent =>
        Math.hypot(point.x - agent.x, point.y - agent.y) <= agent.radius + 5)?.id)
    } else {
      this.worker.send({ type: 'place', tool: this.tool, point })
    }
  }

  /** Refreshes stats, selection and canvas from the latest view. */
  private render() {
    if (!this.world) return
    const agent = this.world.agents.find(agent => agent.id === this.selected)
    this.selected = agent?.id
    this.selection.update(this.world, agent)
    const summary = `Сущности: ${this.world.agents.length} · Пища: ${this.world.food.length} · Время мира: ${Math.floor(this.world.seconds)} с`
    if (this.stats.textContent !== summary) this.stats.textContent = summary
    this.draw()
  }

  /** Repaints only the canvas when the viewport changes. */
  private draw() {
    if (this.world && !document.hidden) this.map.draw(this.world, this.selected)
  }
}
