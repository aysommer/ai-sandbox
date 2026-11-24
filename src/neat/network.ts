import type { ConnectionGene, Genome } from './genes.ts'

/** Validates and evaluates feed-forward NEAT networks. */
export class NeuralNetwork {
  /** Checks whether an additional edge would close a directed cycle. */
  static wouldCreateCycle(edges: ReadonlyMap<number, readonly number[]>, from: number, to: number) {
    const visited = new Set<number>()
    const pending = [to]
    while (pending.length) {
      const node = pending.pop()!
      if (node === from) return true
      if (visited.has(node)) continue
      visited.add(node)
      for (const target of edges.get(node) ?? []) pending.push(target)
    }
    return false
  }

  /** Appends an edge to the outgoing adjacency map. */
  static recordEdge(edges: Map<number, number[]>, from: number, to: number) {
    const targets = edges.get(from)
    if (targets) targets.push(to)
    else edges.set(from, [to])
  }

  /** Builds and caches a topological evaluator for a genome. */
  static compileNetwork(genome: Genome) {
    const nodes = [...genome.nodes].sort((a, b) => a.id - b.id)
    const indices = new Map(nodes.map((node, index) => [node.id, index]))
    if (indices.size !== nodes.length) throw new Error('Duplicate NEAT node ID')
    const inputs = nodes.filter(node => node.kind === 'input').map(node => indices.get(node.id)!)
    const biases = nodes.filter(node => node.kind === 'bias').map(node => indices.get(node.id)!)
    const outputs = nodes.filter(node => node.kind === 'output').map(node => indices.get(node.id)!)
    const outgoing = nodes.map(() => [] as number[])
    const incoming = nodes.map(() => [] as { source: number; weight: number }[])

    /** Checks a gene and registers it with the compiler if enabled. */
    function addConnection(gene: ConnectionGene) {
      const source = indices.get(gene.from)
      const target = indices.get(gene.to)
      if (source === undefined || target === undefined ||
        nodes[target].kind === 'input' || nodes[target].kind === 'bias' ||
        nodes[source].kind === 'output' || !Number.isFinite(gene.weight)) {
        throw new Error('Invalid NEAT connection')
      }
      if (gene.enabled) {
        outgoing[source].push(target)
        incoming[target].push({ source, weight: gene.weight })
      }
    }
    genome.connections.forEach(addConnection)

    const remaining = incoming.map(edges => edges.length)
    const order = remaining.flatMap((count, index) => count === 0 ? [index] : [])
    for (let index = 0; index < order.length; index++) {
      for (const target of outgoing[order[index]]) {
        if (--remaining[target] === 0) order.push(target)
      }
    }
    if (order.length !== nodes.length) throw new Error('NEAT network contains a cycle')
    const computed = order.filter(index => nodes[index].kind === 'hidden' || nodes[index].kind === 'output')
    const values = new Float64Array(nodes.length)

    /** Evaluates one observation against the cached topology. */
    return function activate(observation: readonly number[]) {
      if (observation.length !== inputs.length || Array.from(observation).some(value => !Number.isFinite(value))) {
        throw new RangeError('Expected one finite value per NEAT input')
      }
      for (let index = 0; index < inputs.length; index++) values[inputs[index]] = observation[index]
      for (const index of biases) values[index] = 1
      for (const index of computed) {
        let sum = 0
        for (const { source, weight } of incoming[index]) sum += values[source] * weight
        values[index] = 1 / (1 + Math.exp(-4.9 * sum))
      }
      return outputs.map(index => values[index])
    }
  }
}
