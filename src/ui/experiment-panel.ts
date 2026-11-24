import { experimentSeconds, WorldExperiment } from '../experiments.ts'

/** Runs both food-supply scenarios and renders their generation metrics. */
export class ExperimentPanel {
  private readonly button = document.querySelector<HTMLButtonElement>('#compare')!
  private readonly section = document.querySelector<HTMLElement>('#experiment')!
  private readonly description = document.querySelector('#experiment-description')!
  private readonly rows = document.querySelector('#experiment-rows')!

  /** Connects the compare button to the current seed field. */
  constructor(readSeed: () => number | undefined) {
    this.button.addEventListener('click', () => {
      const seed = readSeed()
      if (seed !== undefined) this.compare(seed)
    })
  }

  /** Shows progress before running the two repeatable simulations. */
  private compare(seed: number) {
    this.button.disabled = true
    this.section.hidden = false
    this.rows.replaceChildren()
    this.description.textContent = 'Выполняются два прогона…'
    window.setTimeout(() => this.render(seed), 0)
  }

  /** Fills the comparison table and restores the compare button. */
  private render(seed: number) {
    try {
      for (const supply of ['normal', 'scarce'] as const) {
        for (const [generation, metrics] of WorldExperiment.runExperiment(seed, supply)) {
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
