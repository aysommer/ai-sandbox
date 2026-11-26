import { buildings, CityTime, profiles } from './districts.ts'
import { CoinLedger } from './economy.ts'
import type { Activity, CityState, ResidentState } from './simulation.ts'

const activities: Record<Activity, string> = {
  home: 'Дома', commute: 'Идёт на работу', work: 'На смене', return: 'Возвращается домой',
}
const eventLabels: Record<Activity, string> = {
  home: 'дома', commute: 'вышел на смену', work: 'на рабочем месте', return: 'завершил смену',
}

/** Presents the city population, selected resident and daily event history. */
export class CityPanels {
  private readonly list = document.querySelector('#city-residents')!
  private readonly inspector = document.querySelector('#city-inspector')!
  private readonly events = document.querySelector('#city-events')!
  private readonly empty = document.querySelector<HTMLElement>('#city-empty')!
  private readonly buttons = new Map<number, HTMLButtonElement>()
  private readonly fields = new Map<string, HTMLElement>()
  private previousEvent?: string

  /** Creates stable buttons and fields so updates preserve keyboard focus. */
  constructor(select: (id: number) => void) {
    for (const profile of profiles) {
      const button = document.createElement('button')
      button.className = 'btn btn-ghost city-resident'
      button.type = 'button'
      button.setAttribute('aria-pressed', 'false')
      const marker = document.createElement('span')
      marker.className = 'city-marker'
      marker.style.backgroundColor = profile.color
      marker.textContent = String(profile.id)
      const label = document.createElement('span')
      const name = document.createElement('strong')
      name.textContent = profile.name
      const role = document.createElement('span')
      role.textContent = profile.role
      label.append(name, role)
      button.append(marker, label)
      button.addEventListener('click', () => select(profile.id))
      this.buttons.set(profile.id, button)
      this.list.append(button)
    }
  }

  /** Refreshes selection and newly received shift events. */
  render(state: CityState, selected?: number) {
    for (const [id, button] of this.buttons) button.setAttribute('aria-pressed', String(id === selected))
    const resident = state.residents.find(resident => resident.id === selected)
    if (resident) this.showResident(resident, state.economy.balances[CoinLedger.wallet(resident.id)])
    const last = state.events.at(-1)
    const key = last && [last.minute, last.resident, last.activity].join('/')
    if (this.previousEvent === key) return
    this.previousEvent = key
    this.empty.hidden = state.events.length > 0
    this.events.replaceChildren(...state.events.slice(-35).reverse().map(event => {
      const item = document.createElement('li')
      const time = document.createElement('time')
      const label = document.createElement('span')
      time.textContent = CityTime.format(event.minute)
      const profile = profiles[event.resident - 1]
      label.textContent = profile.name + ' · ' + eventLabels[event.activity]
      item.append(time, label)
      return item
    }))
  }

  /** Displays the resident’s workplace, shift and current activity. */
  private showResident(resident: ResidentState, balance: number) {
    const profile = profiles[resident.id - 1]
    const rows = {
      'Имя': profile.name,
      'Роль': profile.role,
      'Кошелёк': balance + ' мон.',
      'Работа': profile.job.title,
      'Место': buildings[profile.job.building].label,
      'Оплата смены': profile.job.wage + ' мон.',
      'Смена': CityTime.format(profile.job.start) + ' – ' + CityTime.format(profile.job.end),
      'Статус': activities[resident.activity],
      'На смене сегодня': resident.worked + ' мин',
    }
    if (!this.fields.size) {
      const values = document.createElement('dl')
      for (const label of Object.keys(rows)) {
        const term = document.createElement('dt')
        const value = document.createElement('dd')
        term.textContent = label
        this.fields.set(label, value)
        values.append(term, value)
      }
      this.inspector.replaceChildren(values)
    }
    for (const [label, value] of Object.entries(rows)) {
      const field = this.fields.get(label)!
      if (field.textContent !== value) field.textContent = value
    }
  }
}
