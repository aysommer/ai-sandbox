import { GenomeFactory, type InnovationRegistry, type Random } from './neat/genes.ts'

export const actions = ['искать цель', 'уйти от угрозы', 'исследовать', 'размножиться'] as const
export const inputs = ['Энергия', 'Близость цели', 'Близость угрозы', 'Хищник', 'Готовность к размножению'] as const
export const inputCount = inputs.length

// Seed the population with viable behavior and small individual differences.
const initialWeights = [
  [0, 0, 0, 1.2], // Energy.
  [1.1, 0, -.15, 0], // Proximity to a food source or prey.
  [0, 1.35, 0, 0], // Proximity to a threat.
  [0, 0, 0, 0], // Hunter role.
  [0, 0, 0, 1.1], // Reproduction availability.
]
const biasWeights = [.25, .05, .15, -.4]

/** Defines the initial network behavior for world inhabitants. */
export class AgentBehavior {
  /** Creates a viable founder genome with small seeded weight variations. */
  static founder(registry: InnovationRegistry, random: Random) {
    const genome = GenomeFactory.createGenome(registry, random)
    return {
      nodes: genome.nodes,
      connections: genome.connections.map(gene => {
        const action = gene.to - inputCount - 1
        const weight = gene.from === inputCount ? biasWeights[action] : initialWeights[gene.from][action]
        return { ...gene, weight: weight + gene.weight * .12 }
      }),
    }
  }
}
