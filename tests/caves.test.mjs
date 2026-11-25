import assert from 'node:assert/strict'
import { test } from 'node:test'
import { World, tick } from '../src/simulation.ts'

/** Creates a small deterministic scenario without the starter population and scenery. */
function emptyWorld(events = []) {
  const world = new World((message, type, participants) => events.push({ message, type, participants }))
  world.agents = []
  world.caves = []
  world.food = []
  world.obstacles = []
  return world
}

test('a threatened forager follows a detour instead of passing through the wall', () => {
  const events = []
  const world = emptyWorld(events)
  assert.ok(world.addCave({ x: 270, y: 250 }))
  world.obstacles.push({ x: 195, y: 220, width: 42, height: 60 })
  const forager = world.spawn({ x: 165, y: 250 }, 'forager')
  world.spawn({ x: 67, y: 250 }, 'hunter')
  let detoured = false
  for (let step = 0; step < 95 && !forager.shelter; step++) {
    world.step(tick)
    if (forager.x >= 190 && forager.x <= 240) {
      assert.ok(forager.y < 220 || forager.y > 280)
      detoured = true
    }
  }
  assert.ok(detoured)
  assert.equal(forager.shelter?.caveId, 1)
  assert.ok(events.some(event => event.type === 'shelter' && event.participants.includes(forager.id)))
})

test('occupancy is capped and predators cannot target hidden foragers', () => {
  const world = emptyWorld()
  assert.ok(world.addCave({ x: 280, y: 240 }))
  const cave = world.caves[0]
  const occupants = [100, 130, 160].map(x => {
    const agent = world.spawn({ x, y: 150 }, 'forager')
    Object.assign(agent, { x: cave.x, y: cave.y, shelter: { caveId: cave.id, since: 0 } })
    return agent
  })
  const hunter = world.spawn({ x: 304, y: 240 }, 'hunter')
  world.step(tick)
  assert.equal(hunter.decision.available[0], false)
  assert.ok(occupants.every(agent => agent.energy > 0 && agent.shelter))
  hunter.x = 350
  const arriving = world.spawn({ x: 270, y: 210 }, 'forager')
  world.step(tick)
  assert.equal(arriving.shelterRoute, undefined)
  assert.equal(world.agents.filter(agent => agent.shelter).length, cave.capacity)
  hunter.energy = 0
  world.seconds = 2
  world.step(tick)
  assert.ok(occupants.every(agent => !agent.shelter && agent.shelterDecision.action === 'Выйти из укрытия'))
})

test('cave placement protects the entrance, and old saves and occupants restore correctly', () => {
  const world = emptyWorld()
  assert.ok(world.addCave({ x: 280, y: 240 }))
  assert.equal(world.addObstacle({ x: 320, y: 240 }), true)
  assert.equal(world.addObstacle({ x: 280, y: 240 }), false)
  assert.equal(world.addCave({ x: 320, y: 240 }), false)
  const agent = world.spawn({ x: 280, y: 240 }, 'forager')
  agent.energy = 18
  agent.shelter = { caveId: 1, since: 0 }
  const snapshot = world.snapshot()
  const restored = World.restore(() => {}, snapshot)
  assert.deepEqual(restored.snapshot(), snapshot)
  restored.step(tick)
  assert.equal(restored.agents[0].shelter, undefined)
  assert.equal(restored.agents[0].shelterDecision.action, 'Выйти из укрытия')
  const old = emptyWorld().snapshot()
  delete old.caves
  assert.deepEqual(World.restore(() => {}, old).view().caves, [])
})
