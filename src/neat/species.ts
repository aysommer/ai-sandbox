import type { Genome } from './genes.ts'

export function compatibilityDistance(first: Genome, second: Genome) {
  const a = new Map(first.connections.map(gene => [gene.innovation, gene]))
  const b = new Map(second.connections.map(gene => [gene.innovation, gene]))
  const lastA = Math.max(0, ...a.keys())
  const lastB = Math.max(0, ...b.keys())
  let excess = 0
  let disjoint = 0
  let matching = 0
  let weightDifference = 0
  for (const [id, gene] of a) {
    const match = b.get(id)
    if (match) {
      matching++
      weightDifference += Math.abs(gene.weight - match.weight)
    } else if (id > lastB) excess++
    else disjoint++
  }
  for (const id of b.keys()) {
    if (a.has(id)) continue
    if (id > lastA) excess++
    else disjoint++
  }
  const longest = Math.max(a.size, b.size)
  const normalizer = longest < 20 ? 1 : longest
  return (excess + disjoint) / normalizer + .4 * (matching ? weightDifference / matching : 0)
}

export type Species<T> = { representative: T; members: T[] }

export function groupSpecies<T extends { genome: Genome }>(population: readonly T[], threshold = 3): Species<T>[] {
  if (!Number.isFinite(threshold) || threshold <= 0) throw new RangeError('Expected positive compatibility threshold')
  const groups: Species<T>[] = []
  for (const candidate of population) {
    let nearest: Species<T> | undefined
    let bestDistance = threshold
    for (const group of groups) {
      const distance = compatibilityDistance(candidate.genome, group.representative.genome)
      if (distance >= bestDistance) continue
      bestDistance = distance
      nearest = group
    }
    if (nearest) nearest.members.push(candidate)
    else groups.push({ representative: candidate, members: [candidate] })
  }
  return groups
}
