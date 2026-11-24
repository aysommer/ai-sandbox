import { actions, inputs } from './behavior.ts'
import type { Agent } from './simulation.ts'
import type { Genome, NodeGene } from './neat/genes.ts'

const decision = document.querySelector<HTMLDetailsElement>('#decision')!
const decisionData = document.querySelector('#decision-data') as HTMLElement
const decisionResult = document.querySelector('#decision-result')!
const genomePanel = document.querySelector<HTMLDetailsElement>('#genome')!
const nodesList = document.querySelector('#genome-nodes')!
const edgesList = document.querySelector('#genome-edges')!
const mutationList = document.querySelector('#mutations')!

const number = new Intl.NumberFormat('ru', { maximumFractionDigits: 4 })
const format = (value: number) => number.format(value)

function text(element: Element, value: string) {
  if (element.textContent !== value) element.textContent = value
}

function makeValues(container: string, labels: readonly string[]) {
  const list = document.querySelector(container)!
  return labels.map(label => {
    const term = document.createElement('dt')
    const value = document.createElement('dd')
    term.textContent = label
    list.append(term, value)
    return value
  })
}

const inputValues = makeValues('#decision-inputs', inputs)
const actionValues = makeValues('#decision-scores', actions)

function renderList(list: Element, values: readonly string[]) {
  list.replaceChildren(...values.map(value => {
    const item = document.createElement('li')
    item.textContent = value
    return item
  }))
}

function nodeName(node: NodeGene) {
  if (node.kind === 'input') return 'вход · ' + inputs[node.id]
  if (node.kind === 'bias') return 'смещение'
  if (node.kind === 'output') return 'выход · ' + actions[node.id - inputs.length - 1]
  return 'скрытый узел'
}

let shownGenome: Genome | undefined

export function updateInspector(agent: Agent | undefined) {
  decision.hidden = genomePanel.hidden = !agent
  if (!agent) {
    shownGenome = undefined
    return
  }

  if (shownGenome !== agent.genome) {
    shownGenome = agent.genome
    renderList(nodesList, agent.genome.nodes.map(node => `#${node.id} · ${nodeName(node)}`))
    renderList(edgesList, agent.genome.connections.map(gene =>
      `#${gene.innovation} · ${gene.from} → ${gene.to} · вес ${format(gene.weight)}${gene.enabled ? '' : ' · выключена'}`,
    ))
    const mutations = agent.mutations
    const changes = mutations ? [
      ...mutations.addedNodes.map(node => `Добавлен узел #${node.id}`),
      ...mutations.addedConnections.map(gene => `Связь #${gene.innovation} · ${gene.from} → ${gene.to}`),
      ...mutations.changes.map(({ kind, before, after }) => kind === 'weight'
        ? `Связь #${after.innovation} · вес ${format(before.weight)} → ${format(after.weight)}`
        : `Связь #${after.innovation} · ${after.enabled ? 'включена' : 'выключена'}`),
    ] : []
    renderList(mutationList, changes.length ? changes : [mutations ? 'Мутаций в этом геноме нет' : 'Геном основателя'])
  }

  const snapshot = agent.decision
  decisionData.hidden = !snapshot
  if (!snapshot) {
    text(decisionResult, 'Сущность ещё не приняла решение.')
    return
  }

  const energy = snapshot.energyDelta
  const effect = energy === 0 ? '' : ` · энергия ${energy > 0 ? '+' : ''}${format(energy)}`
  text(decisionResult, `${format(snapshot.seconds)} с · ${actions[snapshot.action]}. ${snapshot.outcome}${effect}.`)
  inputValues.forEach((value, index) => text(value, format(snapshot.inputs[index])))
  actionValues.forEach((value, index) => {
    const status = !snapshot.available[index] ? ' · недоступно' : index === snapshot.action ? ' · выбрано' : ''
    text(value, format(snapshot.scores[index]) + status)
  })
}
