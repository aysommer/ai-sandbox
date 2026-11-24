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

/** Assigns consistent historical markings within one population. */
export class InnovationRegistry {
  readonly baseNodes: readonly NodeGene[]
  private nextNode: number
  private nextInnovation = 1
  private readonly connections = new Map<string, number>()
  private readonly splits = new Map<number, number>()

  /** Reserves IDs for the shared input, bias and output nodes. */
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

  /** Returns the innovation ID for an edge, allocating it on first use. */
  connection(from: number, to: number) {
    const key = from + ':' + to
    const existing = this.connections.get(key)
    if (existing !== undefined) return existing
    const innovation = this.nextInnovation++
    this.connections.set(key, innovation)
    return innovation
  }

  /** Reuses the same node and edge IDs for a repeated split. */
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

/** Creates initial genomes and samples their connection weights. */
export class GenomeFactory {
  /** Creates a fully connected genome with the registry’s shared base nodes. */
  static createGenome(registry: InnovationRegistry, random: Random = Math.random): Genome {
    const nodes = registry.baseNodes
    const inputs = nodes.filter(node => node.kind === 'input' || node.kind === 'bias')
    const outputs = nodes.filter(node => node.kind === 'output')
    const connections = inputs.flatMap(source => outputs.map(target => ({
      innovation: registry.connection(source.id, target.id),
      from: source.id,
      to: target.id,
      weight: GenomeFactory.randomWeight(random),
      enabled: true,
    })))
    return { nodes, connections }
  }

  /** Generates a connection weight between −1 and 1. */
  /** Generates a connection weight between −1 and 1. */
  static randomWeight(random: Random) {
    return random() * 2 - 1
  }
}
