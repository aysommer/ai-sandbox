import { experimentSeconds } from '../experiments.ts'
import type { WorkerUpdate } from '../runtime/messages.ts'

/** Runs both food-supply scenarios and renders their generation metrics. */
export class ExperimentPanel {
  private readonly button = document.querySelector<HTMLButtonElement>('#compare')!
  private readonly section = document.querySelector<HTMLElement>('#experiment')!
  private readonly description = document.querySelector('#experiment-description')!
  private readonly rows = document.querySelector('#experiment-rows')!

  /** Connects the compare button to the current seed field. */
  constructor(readSeed: () => number | undefined, run: (seed: number) => void) {
    this.button.addEventListener('click', () => {
      const seed = readSeed()
      if (seed !== undefined) {
        this.showProgress()
        run(seed)
      }
    })
  }

  /** Enables comparison only after the worker is ready. */
  enable() {
    this.button.disabled = false
  }

  /** Shows progress before running the two repeatable simulations. */
  private showProgress() {
    this.button.disabled = true
    this.section.hidden = false
    this.rows.replaceChildren()
    this.description.textContent = 'Выполняются два прогона…'
  }

  /** Fills the comparison table and restores the compare button. */
  render({ seed, results }: Extract<WorkerUpdate, { type: 'comparison' }>) {
    try {
      if (!results) {
        this.description.textContent = 'Не удалось сравнить условия'
        return
      }
      for (const { supply, generations } of results) {
        for (const [generation, metrics] of generations) {
          const row = document.createElement('tr')
          for (const value of [generation, supply === 'normal' ? 'Обычное' : 'Редкое', metrics.born, metrics.alive, metrics.absorbed]) {
            const cell = document.createElement('td')
            cell.textContent = String(value)
            row.append(cell)
          }
          this.rows.append(row)
        }
      }
      this.description.textContent = `Seed ${seed} · каждый прогон длится ${experimentSeconds} с мира. Меняется частота пополнения пищи.`
    } finally {
      this.button.disabled = false
    }
  }
}
