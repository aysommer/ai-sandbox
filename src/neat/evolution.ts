import { randomWeight, type ConnectionGene, type Genome, type InnovationRegistry, type Random } from './genes.ts'
import { recordEdge, wouldCreateCycle } from './network.ts'

function pick<T>(items: readonly T[], random: Random) {
  return items[Math.floor(random() * items.length)]
}

export function mutateWeights(genome: Genome, random: Random = Math.random): Genome {
  return {
    nodes: genome.nodes,
    connections: genome.connections.map(gene => {
      if (random() >= .8) return gene
      const weight = random() < .1 ? randomWeight(random) : gene.weight + randomWeight(random) * .4
      return { ...gene, weight: Math.max(-8, Math.min(8, weight)) }
    }),
  }
}

export function addNode(genome: Genome, registry: InnovationRegistry, random: Random = Math.random): Genome {
  const candidates = genome.connections.filter(gene => gene.enabled)
  if (!candidates.length) return genome
  const original = pick(candidates, random)
  const { id, incoming, outgoing } = registry.split(original)
  if (genome.nodes.some(node => node.id === id)) return genome

  return {
    nodes: [...genome.nodes, { id, kind: 'hidden' }],
    connections: [
      ...genome.connections.map(gene => gene === original ? { ...gene, enabled: false } : gene),
      { innovation: incoming, from: original.from, to: id, weight: 1, enabled: true },
      { innovation: outgoing, from: id, to: original.to, weight: original.weight, enabled: true },
    ],
  }
}

export function addConnection(genome: Genome, registry: InnovationRegistry, random: Random = Math.random): Genome {
  const edges = new Map<number, number[]>()
  const bySource = new Map<number, Map<number, ConnectionGene>>()
  for (const gene of genome.connections) {
    if (gene.enabled) recordEdge(edges, gene.from, gene.to)
    let targets = bySource.get(gene.from)
    if (!targets) {
      targets = new Map()
      bySource.set(gene.from, targets)
    }
    targets.set(gene.to, gene)
  }

  const candidates: { from: number; to: number; existing?: ConnectionGene }[] = []
  for (const source of genome.nodes) {
    if (source.kind === 'output') continue
    for (const target of genome.nodes) {
      if (target.kind !== 'hidden' && target.kind !== 'output') continue
      const existing = bySource.get(source.id)?.get(target.id)
      if (existing?.enabled || wouldCreateCycle(edges, source.id, target.id)) continue
      candidates.push({ from: source.id, to: target.id, existing })
    }
  }
  if (!candidates.length) return genome
  const { from, to, existing } = pick(candidates, random)
  const connections = existing
    ? genome.connections.map(gene => gene === existing ? { ...gene, enabled: true } : gene)
    : [...genome.connections, { from, to, enabled: true, weight: randomWeight(random), innovation: registry.connection(from, to) }]
  return { nodes: genome.nodes, connections }
}

export function mutate(genome: Genome, registry: InnovationRegistry, random: Random = Math.random): Genome {
  let child = mutateWeights(genome, random)
  if (random() < .05) child = addNode(child, registry, random)
  if (random() < .08) child = addConnection(child, registry, random)
  return child
}

export type ScoredGenome = Readonly<{ genome: Genome; fitness: number }>

export function crossover(first: ScoredGenome, second: ScoredGenome, random: Random = Math.random): Genome {
  const [stronger, other] = first.fitness >= second.fitness ? [first, second] : [second, first]
  const equal = stronger.fitness === other.fitness
  const otherGenes = new Map(other.genome.connections.map(gene => [gene.innovation, gene]))
  const genes: ConnectionGene[] = []
  for (const gene of stronger.genome.connections) {
    const match = otherGenes.get(gene.innovation)
    if (match) {
      otherGenes.delete(gene.innovation)
      const inherited = random() < .5 ? gene : match
      const enabled = (gene.enabled && match.enabled) || random() >= .75
      genes.push({ ...inherited, enabled })
    } else if (!equal || random() < .5) {
      genes.push(gene)
    }
  }
  if (equal) {
    for (const gene of otherGenes.values()) {
      if (random() < .5) genes.push(gene)
    }
  }

  const edges = new Map<number, number[]>()
  const usedNodes = new Set<number>()
  const connections = genes.sort((a, b) => a.innovation - b.innovation).map(gene => {
    usedNodes.add(gene.from)
    usedNodes.add(gene.to)
    if (!gene.enabled) return gene
    // The union of two acyclic graphs can contain a cycle.
    if (wouldCreateCycle(edges, gene.from, gene.to)) return { ...gene, enabled: false }
    recordEdge(edges, gene.from, gene.to)
    return gene
  })
  const allNodes = new Map([...stronger.genome.nodes, ...other.genome.nodes].map(node => [node.id, node]))
  const nodes = [...allNodes.values()].filter(node => node.kind !== 'hidden' || usedNodes.has(node.id))
  return { nodes, connections }
}
