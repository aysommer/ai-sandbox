import assert from 'node:assert/strict'
import { test } from 'node:test'
import { WorldExperiment } from '../src/experiments.ts'
import { World, tick } from '../src/simulation.ts'

test('food supply variants start with the same map, food and founder genomes', () => {
  const normal = new World(() => {}, 267, 'normal')
  const scarce = new World(() => {}, 267, 'scarce')
  assert.deepEqual(normal.food, scarce.food)
  assert.deepEqual(normal.obstacles, scarce.obstacles)
  assert.deepEqual(normal.agents.map(agent => agent.genome), scarce.agents.map(agent => agent.genome))
  const baseline = WorldExperiment.runExperiment(267, 'normal')
  assert.deepEqual(WorldExperiment.runExperiment(267, 'normal'), baseline)
  assert.notDeepEqual(WorldExperiment.runExperiment(267, 'scarce'), baseline)
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

test('decisions expose actual network scores and outcomes, and events identify participants', () => {
  const events = []
  const world = new World((message, type, participants) => events.push({ message, type, participants }), 267)
  let absorbed = false
  let observedMutation = false
  for (let step = 0; step < 1800; step++) {
    world.step(tick)
    for (const agent of world.agents) {
      const decision = agent.decision
      if (decision) {
        assert.deepEqual(decision.scores, agent.activate(decision.inputs))
        assert.ok(decision.available[decision.action])
        assert.ok(decision.scores.every((score, index) => !decision.available[index] || score <= decision.scores[decision.action]))
        if (decision.outcome.startsWith('Поглощена')) {
          assert.equal(decision.action, 0)
          assert.ok(decision.energyDelta >= 0)
          assert.ok(events.some(event => event.type === 'absorption' &&
            event.participants.length === 2 && event.participants[0] === agent.id))
          absorbed = true
        }
      }
      if (agent.mutations?.changes.length) observedMutation = true
    }
  }
  assert.ok(absorbed)
  assert.ok(observedMutation)
  assert.ok(events.some(event => event.type === 'birth' && event.participants.length >= 2))
})
