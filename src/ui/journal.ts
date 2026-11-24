import type { EventType } from '../simulation.ts'

/** Renders and filters the bounded world event log. */
export class EventJournal {
  private readonly events = document.querySelector<HTMLOListElement>('#events')!
  private readonly emptyEvents = document.querySelector<HTMLParagraphElement>('#empty-events')!
  private readonly eventType = document.querySelector<HTMLSelectElement>('#event-type')!
  private readonly eventAgent = document.querySelector<HTMLInputElement>('#event-agent')!

  /** Binds the console filter and clear controls. */
  constructor() {
    this.eventType.addEventListener('change', () => this.applyEventFilters())
    this.eventAgent.addEventListener('input', () => this.applyEventFilters())
    document.querySelector('#clear')!.addEventListener('click', () => this.clear())
  }

  /** Removes entries while keeping the active filters. */
  clear() {
    this.events.replaceChildren()
    this.updateEmptyEvents()
  }

  /** Adds a timestamped event, retaining the most recent 160 entries. */
  log(message: string, type: EventType = 'world', participants: readonly number[] = []) {
    const item = document.createElement('li')
    const time = document.createElement('time')
    const now = new Date()
    time.dateTime = now.toISOString()
    time.textContent = now.toLocaleTimeString('ru-RU')
    const text = document.createElement('span')
    text.textContent = message
    item.append(time, text)
    item.dataset.type = type
    item.dataset.participants = participants.join(' ')
    item.hidden = !this.matchesEvent(item)
    this.events.prepend(item)
    if (this.events.childElementCount > 160) this.events.lastElementChild?.remove()
    this.updateEmptyEvents()
  }

  /** Checks both the event category and the exact participant ID. */
  private matchesEvent(item: HTMLElement) {
    const agent = this.eventAgent.value.trim().replace(/^#/, '')
    return (!this.eventType.value || item.dataset.type === this.eventType.value) &&
      (!agent || item.dataset.participants?.split(' ').includes(agent))
  }

  /** Distinguishes an empty journal from a filter with no matches. */
  private updateEmptyEvents() {
    const visible = !!this.events.querySelector('li:not([hidden])')
    if (!visible) this.emptyEvents.textContent = this.events.childElementCount ? 'Нет событий по этому фильтру' : 'Журнал пуст'
    this.emptyEvents.hidden = visible
  }

  /** Reapplies both filters to the current entries. */
  private applyEventFilters() {
    for (const item of this.events.querySelectorAll('li')) item.hidden = !this.matchesEvent(item)
    this.updateEmptyEvents()
  }
}
