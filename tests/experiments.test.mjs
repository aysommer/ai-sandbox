import assert from 'node:assert/strict'
import { test } from 'node:test'
import { runExperiment } from '../src/experiments.ts'
import { World, tick } from '../src/simulation.ts'

test('food supply variants start with the same map, food and founder genomes', () => {
  const normal = new World(() => {}, 267, 'normal')
  const scarce = new World(() => {}, 267, 'scarce')
  assert.deepEqual(normal.food, scarce.food)
  assert.deepEqual(normal.obstacles, scarce.obstacles)
  assert.deepEqual(normal.agents.map(agent => agent.genome), scarce.agents.map(agent => agent.genome))
  const baseline = runExperiment(267, 'normal')
  assert.deepEqual(runExperiment(267, 'normal'), baseline)
  assert.notDeepEqual(runExperiment(267, 'scarce'), baseline)
})

test('offspring inherit a modified genome and ancestry survives removal of dead agents', () => {
  const world = new World(() => {}, 267)
  const originals = new Map(world.agents.map(agent => [agent.id, agent.genome]))
  let observedBirth = false
  for (let step = 0; step < 1800; step++) {
    world.step(tick)
    for (const agent of world.agents) {
      if (originals.has(agent.id)) continue
      originals.set(agent.id, agent.genome)
      const record = world.lineage.get(agent.id)
      const parents = record.parents.map(id => world.lineage.get(id))
      assert.ok(parents.length > 0)
      assert.equal(agent.generation, Math.max(...parents.map(parent => parent.generation)) + 1)
      assert.notDeepEqual(agent.genome, originals.get(parents[0].id))
      assert.ok(agent.activate([.8, .2, .3, 0, 0]).every(Number.isFinite))
      observedBirth = true
    }
  }
  assert.ok(observedBirth)
  assert.ok(world.lineage.size > world.agents.length)
  assert.ok([...world.lineage.values()].some(record => record.absorbed > 0))
})
