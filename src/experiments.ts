import { World, tick, type FoodSupply } from './simulation.ts'

export const experimentSeconds = 60

export function runExperiment(seed: number, supply: FoodSupply) {
  const world = new World(() => {}, seed, supply)
  for (let index = 0; index < experimentSeconds / tick; index++) world.step(tick)
  const living = new Set(world.agents.map(agent => agent.id))
  const generations = new Map<number, { born: number; alive: number; absorbed: number }>()
  for (const record of world.lineage.values()) {
    const row = generations.get(record.generation) ?? { born: 0, alive: 0, absorbed: 0 }
    row.born++
    if (living.has(record.id)) row.alive++
    row.absorbed += record.absorbed
    generations.set(record.generation, row)
  }
  return generations
}
