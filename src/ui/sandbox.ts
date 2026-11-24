import { World, names, tick, type FoodSupply, type Point } from '../simulation.ts'
import { EventJournal } from './journal.ts'
import { WorldMap } from './world-map.ts'
import { SelectionPanel } from './selection-panel.ts'
import { ExperimentPanel } from './experiment-panel.ts'

const instructions = {
  select: 'Выберите сущность на карте',
  forager: 'Нажмите на карту, чтобы разместить собирателя',
  hunter: 'Нажмите на карту, чтобы разместить хищника',
  food: 'Нажмите на карту, чтобы разместить пищу',
  obstacle: 'Нажмите на карту, чтобы разместить препятствие',
}
type Tool = keyof typeof instructions

/** Connects world commands and the simulation clock to the page panels. */
export class Sandbox {
  private readonly run = document.querySelector<HTMLButtonElement>('#run')!
  private readonly status = document.querySelector('#status')!
  private readonly stats = document.querySelector('#stats')!
  private readonly help = document.querySelector('#map-help')!
  private readonly tools = document.querySelectorAll<HTMLButtonElement>('[data-tool]')
  private readonly seed = document.querySelector<HTMLInputElement>('#seed')!
  private readonly supply = document.querySelector<HTMLSelectElement>('#supply')!
  private readonly journal = new EventJournal()
  private world = new World(this.journal.log.bind(this.journal))
  private readonly map = new WorldMap(() => this.draw(), point => this.place(point))
  private readonly selection = new SelectionPanel(id => this.select(id))
  private tool: Tool = 'select'
  private selected: number | undefined
  private running = false
  private lastFrame = 0
  private elapsed = 0
  private frame = 0

  /** Binds controls and draws the initial paused world. */
  constructor() {
    this.seed.required = true
    new ExperimentPanel(() => this.readSeed())
    for (const button of this.tools) button.addEventListener('click', () => this.selectTool(button))
    this.run.addEventListener('click', () => this.setRunning(!this.running))
    document.querySelector('#reset')!.addEventListener('click', () => {
      this.map.reset()
      this.draw()
    })
    document.querySelector('#restart')!.addEventListener('click', () => this.restart())
    this.render()
    this.journal.log('Мир готов к запуску')
  }

  /** Reads a valid seed or lets the browser report the field error. */
  private readSeed() {
    if (this.seed.reportValidity()) return this.seed.valueAsNumber
  }

  /** Resets the world, selection and journal using the configured seed and food supply. */
  private restart() {
    const seed = this.readSeed()
    if (seed === undefined) return
    this.setRunning(false)
    this.world = new World(this.journal.log.bind(this.journal), seed, this.supply.value as FoodSupply)
    this.selected = undefined
    this.map.reset()
    this.render()
    this.journal.clear()
    this.journal.log(`Восстановлен старт мира · seed ${seed}`)
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

  /** Applies the selected tool at the clicked world position. */
  private place(point: Point) {
    const tool = this.tool
    const unavailable = 'Размещение здесь недоступно или достигнут лимит'
    if (tool === 'select') {
      this.selected = this.world.agents.findLast(agent =>
        Math.hypot(point.x - agent.x, point.y - agent.y) <= agent.radius + 5)?.id
    } else if (tool === 'food' || tool === 'obstacle') {
      const placed = tool === 'food' ? this.world.addFood(point) : this.world.addObstacle(point)
      const message = tool === 'food' ? 'Добавлена пища' : 'Добавлено препятствие'
      this.journal.log(placed ? message : unavailable)
    } else {
      const agent = this.world.spawn(point, tool)
      if (agent) this.selected = agent.id
      this.journal.log(agent ? `Добавлен ${names[tool].toLowerCase()} #${agent.id}` : unavailable, 'world', agent ? [agent.id] : [])
    }
    this.render()
  }

  /** Advances fixed simulation ticks before drawing the next frame. */
  private readonly animate = (now: number) => {
    this.elapsed += this.lastFrame ? Math.min((now - this.lastFrame) / 1000, .2) : 0
    this.lastFrame = now
    while (this.elapsed >= tick) {
      this.world.step(tick)
      this.elapsed -= tick
    }
    this.render()
    this.frame = requestAnimationFrame(this.animate)
  }

  /** Starts or pauses the clock and updates the run controls. */
  private setRunning(value: boolean) {
    this.running = value
    cancelAnimationFrame(this.frame)
    this.lastFrame = 0
    this.elapsed = 0
    this.run.textContent = value ? 'Пауза' : 'Запустить'
    this.status.textContent = value ? 'Симуляция идёт' : 'Пауза'
    if (value) this.frame = requestAnimationFrame(this.animate)
  }

  /** Refreshes the stats, selection panel and map from the latest world state. */
  private render() {
    const agent = this.world.agents.find(agent => agent.id === this.selected)
    this.selected = agent?.id
    this.selection.update(this.world, agent)
    const summary = `Сущности: ${this.world.agents.length} · Пища: ${this.world.food.length} · Время мира: ${Math.floor(this.world.seconds)} с`
    if (this.stats.textContent !== summary) this.stats.textContent = summary
    this.draw()
  }

  /** Repaints the canvas without refreshing the panels. */
  private draw() {
    this.map.draw(this.world, this.selected)
  }
}
