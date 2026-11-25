import { names, type AgentView, type WorldView } from '../simulation.ts'
import { AgentInspector } from './inspector.ts'

/** Keeps the entity picker, inspector and ancestry in sync with the world. */
export class SelectionPanel {
  private readonly select = document.querySelector<HTMLSelectElement>('#selected-agent')!
  private readonly details = document.querySelector('#agent-details')!
  private readonly ancestry = document.querySelector<HTMLDetailsElement>('#ancestry')!
  private readonly ancestors = document.querySelector('#ancestors')!
  private readonly inspector = new AgentInspector()
  private shownAncestry: number | undefined

  /** Binds manual entity selection from the drop-down. */
  constructor(selectAgent: (id: number | undefined) => void) {
    this.select.addEventListener('change', () => selectAgent(Number(this.select.value) || undefined))
  }

  /** Refreshes the entity options and details for the current selection. */
  update(world: WorldView, agent: AgentView | undefined) {
    const ids = world.agents.map(agent => String(agent.id))
    const previous = Array.from(this.select.options).slice(1).map(option => option.value)
    if (ids.join() !== previous.join()) {
      this.select.length = 1
      for (const agent of world.agents) {
        this.select.add(new Option(`${names[agent.kind]} #${agent.id}`, String(agent.id)))
      }
    }
    this.inspector.update(agent)
    const value = agent ? String(agent.id) : ''
    if (this.select.value !== value) this.select.value = value
    const description = agent ? `${names[agent.kind]} #${agent.id} · энергия ${Math.ceil(agent.energy)}% · поколение ${agent.generation}${agent.shelter ? ' · в пещере №' + agent.shelter.caveId : ''}`
      : 'Выберите сущность для просмотра её состояния.'
    if (this.details.textContent !== description) this.details.textContent = description
    if (this.shownAncestry !== agent?.id) this.renderAncestry(world, agent?.id)
  }

  /** Walks the parent graph once for each selected entity. */
  private renderAncestry(world: WorldView, selected: number | undefined) {
    this.shownAncestry = selected
    this.ancestry.hidden = selected === undefined
    this.ancestors.replaceChildren()
    const pending = selected === undefined ? [] : [selected]
    const seen = new Set<number>()
    for (let index = 0; index < pending.length; index++) {
      const id = pending[index]
      if (seen.has(id)) continue
      seen.add(id)
      const record = world.lineage.get(id)!
      const row = document.createElement('li')
      const parents = record.parents.map(parent => '#' + parent).join(', ')
      row.textContent = `#${id} · поколение ${record.generation} · ${parents ? 'родители ' + parents : 'основатель'}`
      this.ancestors.append(row)
      pending.push(...record.parents)
    }
  }
}
