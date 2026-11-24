import type { JournalEntry } from '../runtime/messages.ts'

/** Renders and filters the bounded world event log. */
export class EventJournal {
  private readonly events = document.querySelector<HTMLOListElement>('#events')!
  private readonly emptyEvents = document.querySelector<HTMLParagraphElement>('#empty-events')!
  private readonly eventType = document.querySelector<HTMLSelectElement>('#event-type')!
  private readonly eventAgent = document.querySelector<HTMLInputElement>('#event-agent')!

  /** Binds the console filter and clear controls. */
  constructor(clear: () => void) {
    this.eventType.addEventListener('change', () => this.applyEventFilters())
    this.eventAgent.addEventListener('input', () => this.applyEventFilters())
    document.querySelector('#clear')!.addEventListener('click', clear)
  }

  /** Replaces the bounded journal after restore or a batch of worker events. */
  replace(entries: readonly JournalEntry[]) {
    this.events.replaceChildren(...entries.slice().reverse().map(entry => this.render(entry)))
    this.updateEmptyEvents()
  }

  /** Creates one filterable row with the original event timestamp. */
  private render({ message, type, participants, timestamp }: JournalEntry) {
    const item = document.createElement('li')
    const time = document.createElement('time')
    const now = new Date(timestamp)
    time.dateTime = now.toISOString()
    time.textContent = now.toLocaleTimeString('ru-RU')
    const text = document.createElement('span')
    text.textContent = message
    item.append(time, text)
    item.dataset.type = type
    item.dataset.participants = participants.join(' ')
    item.hidden = !this.matchesEvent(item)
    return item
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
