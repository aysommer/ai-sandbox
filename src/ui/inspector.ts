import { actions, inputs } from '../behavior.ts'
import type { Agent } from '../simulation.ts'
import type { Genome, NodeGene } from '../neat/genes.ts'

/** Renders the selected entity’s network, decision and mutations. */
export class AgentInspector {
  private readonly decision = document.querySelector<HTMLDetailsElement>('#decision')!
  private readonly decisionData = document.querySelector('#decision-data') as HTMLElement
  private readonly decisionResult = document.querySelector('#decision-result')!
  private readonly genomePanel = document.querySelector<HTMLDetailsElement>('#genome')!
  private readonly nodesList = document.querySelector('#genome-nodes')!
  private readonly edgesList = document.querySelector('#genome-edges')!
  private readonly mutationList = document.querySelector('#mutations')!

  private readonly number = new Intl.NumberFormat('ru', { maximumFractionDigits: 4 })
  /** Formats a numeric signal, score, or weight for the inspector. */
  private format(value: number) {
    return this.number.format(value)
  }

  /** Updates a text node only when its value changes. */
  private text(element: Element, value: string) {
    if (element.textContent !== value) element.textContent = value
  }

  /** Creates a definition list and returns its value cells. */
  private makeValues(container: string, labels: readonly string[]) {
    const list = document.querySelector(container)!
    return labels.map(label => {
      const term = document.createElement('dt')
      const value = document.createElement('dd')
      term.textContent = label
      list.append(term, value)
      return value
    })
  }

  private readonly inputValues = this.makeValues('#decision-inputs', inputs)
  private readonly actionValues = this.makeValues('#decision-scores', actions)

  /** Replaces the contents of a genome list. */
  private renderList(list: Element, values: readonly string[]) {
    list.replaceChildren(...values.map(value => {
      const item = document.createElement('li')
      item.textContent = value
      return item
    }))
  }

  /** Formats a node role using the network signal names. */
  private nodeName(node: NodeGene) {
    if (node.kind === 'input') return 'вход · ' + inputs[node.id]
    if (node.kind === 'bias') return 'смещение'
    if (node.kind === 'output') return 'выход · ' + actions[node.id - inputs.length - 1]
    return 'скрытый узел'
  }

  private shownGenome: Genome | undefined

  /** Displays the active entity’s decision, genome and mutations. */
  update(agent: Agent | undefined) {
    this.decision.hidden = this.genomePanel.hidden = !agent
    if (!agent) {
      this.shownGenome = undefined
      return
    }

    if (this.shownGenome !== agent.genome) {
      this.shownGenome = agent.genome
      this.renderList(this.nodesList, agent.genome.nodes.map(node => `#${node.id} · ${this.nodeName(node)}`))
      this.renderList(this.edgesList, agent.genome.connections.map(gene =>
        `#${gene.innovation} · ${gene.from} → ${gene.to} · вес ${this.format(gene.weight)}${gene.enabled ? '' : ' · выключена'}`,
      ))
      const mutations = agent.mutations
      const changes = mutations ? [
        ...mutations.addedNodes.map(node => `Добавлен узел #${node.id}`),
        ...mutations.addedConnections.map(gene => `Связь #${gene.innovation} · ${gene.from} → ${gene.to}`),
        ...mutations.changes.map(({ kind, before, after }) => kind === 'weight'
          ? `Связь #${after.innovation} · вес ${this.format(before.weight)} → ${this.format(after.weight)}`
          : `Связь #${after.innovation} · ${after.enabled ? 'включена' : 'выключена'}`),
      ] : []
      this.renderList(this.mutationList, changes.length ? changes : [mutations ? 'Мутаций в этом геноме нет' : 'Геном основателя'])
    }

    const snapshot = agent.decision
    this.decisionData.hidden = !snapshot
    if (!snapshot) {
      this.text(this.decisionResult, 'Сущность ещё не приняла решение.')
      return
    }

    const energy = snapshot.energyDelta
    const effect = energy === 0 ? '' : ` · энергия ${energy > 0 ? '+' : ''}${this.format(energy)}`
    this.text(this.decisionResult, `${this.format(snapshot.seconds)} с · ${actions[snapshot.action]}. ${snapshot.outcome}${effect}.`)
    this.inputValues.forEach((value, index) => this.text(value, this.format(snapshot.inputs[index])))
    this.actionValues.forEach((value, index) => {
      const status = !snapshot.available[index] ? ' · недоступно' : index === snapshot.action ? ' · выбрано' : ''
      this.text(value, this.format(snapshot.scores[index]) + status)
    })
  }
}
