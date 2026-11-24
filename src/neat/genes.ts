export type NodeGene = Readonly<{
  id: number
  kind: 'input' | 'bias' | 'hidden' | 'output'
}>

export type ConnectionGene = Readonly<{
  innovation: number
  from: number
  to: number
  weight: number
  enabled: boolean
}>

export type Genome = Readonly<{
  nodes: readonly NodeGene[]
  connections: readonly ConnectionGene[]
}>

export type Random = () => number

export function randomWeight(random: Random) {
  return random() * 2 - 1
}

// Historical markings are shared by every genome in one population.
export class InnovationRegistry {
  readonly baseNodes: readonly NodeGene[]
  private nextNode: number
  private nextInnovation = 1
  private readonly connections = new Map<string, number>()
  private readonly splits = new Map<number, number>()

  constructor(inputs: number, outputs: number) {
    if (!Number.isSafeInteger(inputs) || inputs < 1 ||
      !Number.isSafeInteger(outputs) || outputs < 1) {
      throw new RangeError('NEAT requires at least one input and one output')
    }
    this.baseNodes = Array.from({ length: inputs + outputs + 1 }, (_, id) => ({
      id,
      kind: id < inputs ? 'input' : id === inputs ? 'bias' : 'output',
    }))
    this.nextNode = this.baseNodes.length
  }

  connection(from: number, to: number) {
    const key = from + ':' + to
    const existing = this.connections.get(key)
    if (existing !== undefined) return existing
    const innovation = this.nextInnovation++
    this.connections.set(key, innovation)
    return innovation
  }

  split(gene: ConnectionGene) {
    let id = this.splits.get(gene.innovation)
    if (id === undefined) {
      id = this.nextNode++
      this.splits.set(gene.innovation, id)
    }
    return {
      id,
      incoming: this.connection(gene.from, id),
      outgoing: this.connection(id, gene.to),
    }
  }
}

export function createGenome(registry: InnovationRegistry, random: Random = Math.random): Genome {
  const nodes = registry.baseNodes
  const inputs = nodes.filter(node => node.kind === 'input' || node.kind === 'bias')
  const outputs = nodes.filter(node => node.kind === 'output')
  const connections = inputs.flatMap(source => outputs.map(target => ({
    innovation: registry.connection(source.id, target.id),
    from: source.id,
    to: target.id,
    weight: randomWeight(random),
    enabled: true,
  })))
  return { nodes, connections }
}
