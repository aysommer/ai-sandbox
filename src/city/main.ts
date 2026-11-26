import '../style.css'
import './style.css'
import { CityMap } from './map.ts'
import { EconomyPanel } from './economy-panel.ts'
import { CityPanels } from './panels.ts'
import { CityTime, minutesPerDay } from './districts.ts'
import type { CityCommand, CityFrame } from './protocol.ts'
import { TabSession } from '../runtime/tab-session.ts'

/** Connects the city worker to the map, simulation controls and resident panels. */
class CityApp {
  private readonly clock = document.querySelector('#city-clock')!
  private readonly run = document.querySelector<HTMLButtonElement>('#city-run')!
  private readonly step = document.querySelector<HTMLButtonElement>('#city-step')!
  private readonly speed = document.querySelector<HTMLSelectElement>('#city-speed')!
  private readonly status = document.querySelector('#city-status')!
  private readonly economy = new EconomyPanel()
  private readonly panels = new CityPanels(id => this.select(id))
  private readonly map = new CityMap(id => this.select(id))
  private worker?: Worker
  private frame?: CityFrame
  private selected = 1

  /** Starts a dedicated worker and connects controls after initialization. */
  constructor() {
    try {
      this.worker = new Worker(new URL('./city-worker.ts', import.meta.url), { type: 'module' })
      this.worker.addEventListener('message', (event: MessageEvent<CityFrame>) => this.receive(event.data))
      this.worker.addEventListener('error', () => this.fail())
    } catch {
      this.fail()
      return
    }
    TabSession.open('ai-sandbox-city-session', key => this.send({ type: 'open', key, visible: !document.hidden }))
    this.run.addEventListener('click', () => this.send({ type: 'run', running: !this.frame?.running }))
    this.step.addEventListener('click', () => this.send({ type: 'step' }))
    this.speed.addEventListener('change', () => this.send({ type: 'speed', value: Number(this.speed.value) }))
    document.addEventListener('visibilitychange', () => this.send({ type: 'visible', visible: !document.hidden }))
    window.addEventListener('pagehide', () => this.send({ type: 'visible', visible: false }))
    window.addEventListener('pageshow', () => this.send({ type: 'visible', visible: !document.hidden }))
  }

  /** Delivers a command to the current worker. */
  private send(command: CityCommand) {
    this.worker?.postMessage(command)
  }

  /** Shows a startup or worker error and disables simulation commands. */
  private fail() {
    this.status.textContent = 'Не удалось запустить симуляцию города'
    this.run.disabled = this.step.disabled = this.speed.disabled = true
  }

  /** Updates controls and draws the latest world state. */
  private receive(frame: CityFrame) {
    this.frame = frame
    this.run.disabled = this.speed.disabled = false
    this.step.disabled = frame.running
    this.run.textContent = frame.running ? 'Пауза' : 'Запустить'
    this.speed.value = String(frame.speed)
    const statuses = {
      ready: 'Город готов к запуску',
      saved: 'Состояние сохранено в этой вкладке',
      restored: 'Состояние восстановлено',
      unavailable: 'Локальное сохранение недоступно',
    }
    if (this.status.textContent !== statuses[frame.save]) this.status.textContent = statuses[frame.save]
    const minute = frame.state.minute
    this.clock.textContent = 'День ' + (Math.floor(minute / minutesPerDay) + 1) + ' · ' + CityTime.format(minute)
    this.render()
  }

  /** Selects an entity from either the map or the list. */
  private select(id: number) {
    this.selected = id
    this.render()
  }

  /** Refreshes the current resident and map together. */
  private render() {
    if (!this.frame || document.hidden) return
    this.map.render(this.frame.state, this.selected)
    this.panels.render(this.frame.state, this.selected)
    this.economy.render(this.frame.state.economy)
  }
}

new CityApp()
