import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createGenome, InnovationRegistry } from '../src/neat/genes.ts'
import { addConnection, addNode, crossover, mutate, mutateWeights } from '../src/neat/evolution.ts'
import { compileNetwork } from '../src/neat/network.ts'
import { compatibilityDistance, groupSpecies } from '../src/neat/species.ts'

const zero = () => 0

test('the compiled network uses the bias and respects disabled connections', () => {
  const registry = new InnovationRegistry(1, 1)
  const genome = createGenome(registry, () => 1 / 2)
  const [input, bias] = genome.connections
  const activate = compileNetwork({
    nodes: genome.nodes,
    connections: [{ ...input, weight: -4, enabled: false }, { ...bias, weight: 1 }],
  })
  assert.equal(activate([1])[0], 1 / (1 + Math.exp(-4.9)))
  assert.throws(() => activate([NaN]), RangeError)
  assert.throws(() => activate([]), RangeError)
})

test('the same structural mutation gets the same historical markings in separate genomes', () => {
  const registry = new InnovationRegistry(1, 1)
  const base = createGenome(registry, zero)
  const a = addNode(base, registry, zero)
  const b = addNode(createGenome(registry, () => .8), registry, zero)
  assert.deepEqual(a.nodes, b.nodes)
  assert.deepEqual(a.connections.map(gene => gene.innovation), b.connections.map(gene => gene.innovation))
  assert.equal(a.connections[0].enabled, false)
  assert.equal(base.connections[0].enabled, true)
  assert.equal(a.connections.at(-1).weight, base.connections[0].weight)
  const connected = addConnection(a, registry, () => .9)
  assert.equal(connected.connections.length, a.connections.length + 1)
  assert.equal(compileNetwork(connected)([.5]).length, 1)
})

test('weight mutation and crossover preserve parent genomes and the fitter parent supplies unmatched genes', () => {
  const registry = new InnovationRegistry(1, 1)
  const base = createGenome(registry, () => .7)
  const stronger = addNode(base, registry, zero)
  const before = structuredClone(stronger)
  const mate = mutateWeights(base, zero)
  assert.notEqual(mate.connections[0].weight, base.connections[0].weight)
  const child = crossover({ genome: stronger, fitness: 10 }, { genome: mate, fitness: 2 }, zero)
  assert.deepEqual(child.connections.map(gene => gene.innovation), stronger.connections.map(gene => gene.innovation))
  assert.equal(child.connections[0].enabled, false)
  assert.deepEqual(stronger, before)
  assert.equal(compileNetwork(child)([.2]).length, 1)
})

test('crossover disables an edge when valid parents would produce a cyclic offspring', () => {
  const registry = new InnovationRegistry(1, 1)
  const base = createGenome(registry, zero)
  const a = addNode(base, registry, zero)
  const both = addNode(a, registry, zero)
  const [from, to] = both.nodes.filter(node => node.kind === 'hidden').map(node => node.id)
  const forward = { from, to, weight: 1, enabled: true, innovation: registry.connection(from, to) }
  const backward = { ...forward, from: to, to: from, innovation: registry.connection(to, from) }
  const first = { ...both, connections: [...both.connections, forward] }
  const second = { ...both, connections: [...both.connections, backward] }
  assert.doesNotThrow(() => compileNetwork(first))
  assert.doesNotThrow(() => compileNetwork(second))
  const child = crossover({ genome: first, fitness: 1 }, { genome: second, fitness: 1 }, zero)
  assert.equal(child.connections.find(gene => gene.innovation === backward.innovation).enabled, false)
  assert.doesNotThrow(() => compileNetwork(child))
})

test('compatibility is symmetric and grouping separates distant genomes', () => {
  const registry = new InnovationRegistry(1, 1)
  const base = createGenome(registry, () => .5)
  const similar = createGenome(registry, () => .6)
  const distant = addNode(base, registry, zero)
  assert.equal(compatibilityDistance(base, base), 0)
  assert.equal(compatibilityDistance(base, distant), compatibilityDistance(distant, base))
  const population = [base, similar, distant].map(genome => ({ genome }))
  assert.deepEqual(groupSpecies(population, 1).map(group => group.members.length), [2, 1])
})

test('seeded mutations yield valid feed-forward networks over many generations', () => {
  let seed = 147
  const random = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0
    return seed / 2 ** 32
  }
  const registry = new InnovationRegistry(3, 2)
  let genome = createGenome(registry, random)
  const initialSize = genome.nodes.length
  for (let index = 0; index < 300; index++) {
    genome = mutate(genome, registry, random)
    const scores = compileNetwork(genome)([.9, .2, -.5])
    assert.equal(scores.length, 2)
    assert.ok(scores.every(score => score >= 0 && score <= 1))
  }
  assert.ok(genome.nodes.length > initialSize)
})
