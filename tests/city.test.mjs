import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildings, minutesPerDay, profiles, streets, StreetNetwork } from '../src/city/districts.ts'
import { CitySimulation } from '../src/city/simulation.ts'

test('all eight residents walk to work, complete their shifts and return home', () => {
  const city = new CitySimulation()
  city.advance(21 * 60 - 420)
  const state = city.snapshot()
  assert.equal(state.residents.length, 8)
  for (const resident of state.residents) {
    const profile = profiles[resident.id - 1]
    assert.equal(resident.activity, 'home')
    assert.deepEqual(resident.position, buildings[profile.home].door)
    assert.equal(resident.worked, profile.job.end - profile.job.start)
    const events = state.events.filter(event => event.resident === resident.id)
    assert.deepEqual(events.map(event => event.activity), ['commute', 'work', 'return', 'home'])
    assert.equal(events[1].minute, profile.job.start)
    assert.equal(events[2].minute, profile.job.end)
  }
})

test('commutes use connected streets and reach the expected entrance', () => {
  for (const profile of profiles) {
    const home = buildings[profile.home]
    const workplace = buildings[profile.job.building]
    const route = StreetNetwork.route(home, workplace)
    let start = home.door
    for (const end of route) {
      if (start.y === end.y) assert.ok(streets.horizontal.includes(start.y))
      else assert.equal(start.x, end.x)
      if (start.y !== end.y && start !== home.door && end !== workplace.door) {
        assert.ok(streets.vertical.includes(start.x))
      }
      start = end
    }
    assert.deepEqual(route.at(-1), workplace.door)
  }
})

test('restoring a mid-commute checkpoint preserves the schedule across the next day', () => {
  const original = new CitySimulation()
  original.advance(25)
  const checkpoint = original.snapshot()
  assert.ok(checkpoint.residents.some(resident => resident.activity === 'commute'))
  const restored = new CitySimulation(checkpoint)
  original.advance(minutesPerDay)
  restored.advance(minutesPerDay)
  assert.deepEqual(original.snapshot(), restored.snapshot())
  assert.equal(checkpoint.minute, 445)
  assert.ok(restored.snapshot().residents.every(resident => resident.worked === 0))
})
