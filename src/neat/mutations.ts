import type { ConnectionGene, Genome } from './genes.ts'

type ConnectionChange = {
  kind: 'weight' | 'enabled'
  before: ConnectionGene
  after: ConnectionGene
}

/** Identifies the mutations applied to an inherited genome. */
export class MutationDiff {
  /** Lists new genes and changes to inherited weights and enabled states. */
  static describeMutations(inherited: Genome, child: Genome) {
    const previousNodes = new Set(inherited.nodes.map(node => node.id))
    const previousConnections = new Map(inherited.connections.map(gene => [gene.innovation, gene]))
    const addedNodes = child.nodes.filter(node => !previousNodes.has(node.id))
    const addedConnections = child.connections.filter(gene => !previousConnections.has(gene.innovation))
    const changes: ConnectionChange[] = []
    for (const after of child.connections) {
      const before = previousConnections.get(after.innovation)
      if (!before) continue
      if (before.weight !== after.weight) changes.push({ kind: 'weight', before, after })
      if (before.enabled !== after.enabled) changes.push({ kind: 'enabled', before, after })
    }
    return { addedNodes, addedConnections, changes }
  }
}
