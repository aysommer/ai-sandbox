import { actions, AgentBehavior, inputCount } from './behavior.ts'
import { NeatEvolution } from './neat/evolution.ts'
import { InnovationRegistry, type Genome } from './neat/genes.ts'
import { NeuralNetwork } from './neat/network.ts'
import { MutationDiff } from './neat/mutations.ts'
import { Speciation } from './neat/species.ts'

export const width = 800
export const height = 500

export type Point = { x: number; y: number }
export type Kind = 'forager' | 'hunter'
export type Agent = Point & {
  id: number
  kind: Kind
  energy: number
  radius: number
  heading: number
  generation: number
  cooldown: number
  genome: Genome
  activate: ReturnType<typeof NeuralNetwork.compileNetwork>
  decision?: Decision
  mutations?: ReturnType<typeof MutationDiff.describeMutations>
}
export type Decision = {
  seconds: number
  inputs: number[]
  scores: number[]
  available: boolean[]
  action: number
  outcome: string
  energyDelta: number
}
export type EventType = 'world' | 'birth' | 'food' | 'absorption' | 'death'
type Report = (message: string, type: EventType, participants: readonly number[]) => void
type Lineage = {
  id: number
  kind: Kind
  generation: number
  parents: number[]
  births: number
  absorbed: number
}
export type FoodSupply = 'normal' | 'scarce'
export const tick = 1 / 30
type Obstacle = Point & { width: number; height: number }

export const names = { forager: 'Собиратель', hunter: 'Хищник' }

/** Performs geometric checks shared by placement and movement. */
class Geometry {
  /** Measures straight-line distance in world units. */
  static distance(a: Point, b: Point) {
    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  /** Returns the distance to the nearest point on a rectangular obstacle. */
  static obstacleDistance(point: Point, box: Obstacle) {
    const x = Math.min(box.x + box.width, Math.max(point.x, box.x))
    const y = Math.min(box.y + box.height, Math.max(point.y, box.y))
    return Math.hypot(point.x - x, point.y - y)
  }
}

/** Owns the deterministic ecology, population and lineage for one run. */
export class World {
  agents: Agent[] = []
  food: Point[] = []
  obstacles: Obstacle[] = []
  seconds = 0
  private nextId = 1
  readonly lineage = new Map<number, Lineage>()
  private readonly innovations = new InnovationRegistry(inputCount, actions.length)
  private environmentSeed: number
  private behaviorSeed: number
  private geneticsSeed: number
  private foodTimer = 0

  private readonly report: Report
  readonly supply: FoodSupply

  /** Builds the initial map and founder population from the seed. */
  constructor(report: Report, seed = 267, supply: FoodSupply = 'normal') {
    this.report = report
    this.supply = supply
    this.environmentSeed = seed >>> 0
    this.behaviorSeed = (seed ^ 0x15b47) >>> 0
    this.geneticsSeed = (seed ^ 0x13e78) >>> 0
    this.obstacles = [
      { x: 185, y: 245, width: 90, height: 25 },
      { x: 440, y: 275, width: 34, height: 105 },
      { x: 570, y: 100, width: 70, height: 24 },
    ]
    this.spawn({ x: 135, y: 170 }, 'forager')
    this.spawn({ x: 325, y: 365 }, 'forager')
    this.spawn({ x: 400, y: 175 }, 'forager')
    this.spawn({ x: 682, y: 332 }, 'forager')
    this.spawn({ x: 580, y: 380 }, 'forager')
    this.spawn({ x: 670, y: 180 }, 'hunter')
    for (let index = 0; index < 44; index++) this.growFood()
  }

  /** Advances an independent random stream for the environment, behavior or genetics. */
  private random(stream: 'environmentSeed' | 'behaviorSeed' | 'geneticsSeed') {
    this[stream] = (Math.imul(1664525, this[stream]) + 1013904223) >>> 0
    return this[stream] / 2 ** 32
  }

  /** Checks whether a circle fits within the map and avoids obstacles. */
  private free(point: Point, radius: number) {
    return point.x >= radius && point.x <= width - radius &&
      point.y >= radius && point.y <= height - radius &&
      this.obstacles.every(box => Geometry.obstacleDistance(point, box) > radius)
  }

  /** Places an entity and builds its founder or inherited network. */
  spawn(point: Point, kind: Kind, parent?: Agent) {
    const radius = kind === 'hunter' ? 13 : 9
    if (this.agents.length >= 120 || !this.free(point, radius) ||
      this.agents.some(agent => Geometry.distance(agent, point) < agent.radius + radius)) return
    /** Samples the world’s genetic random stream. */
    const random = () => this.random('geneticsSeed')
    const mate = parent && random() < .3 ? this.nearest(parent, this.agents, 90, candidate =>
      candidate !== parent && candidate.kind === parent.kind && candidate.energy >= 55 &&
      Speciation.compatibilityDistance(parent.genome, candidate.genome) < 3,
    ) : undefined
    const inherited = parent && mate ? NeatEvolution.crossover(
      { genome: parent.genome, fitness: this.fitness(parent) },
      { genome: mate.genome, fitness: this.fitness(mate) },
      random,
    ) : parent?.genome
    const genome = inherited ? NeatEvolution.mutate(inherited, this.innovations, random) : AgentBehavior.founder(this.innovations, random)
    const generation = parent ? Math.max(parent.generation, mate?.generation ?? 0) + 1 : 1
    const agent: Agent = {
      ...point, id: this.nextId++, kind, radius, energy: parent ? 46 : 68,
      heading: this.random('behaviorSeed') * 2 * Math.PI, generation, cooldown: 3,
      genome, activate: NeuralNetwork.compileNetwork(genome),
      mutations: inherited ? MutationDiff.describeMutations(inherited, genome) : undefined,
    }
    const parents = parent ? (mate ? [parent.id, mate.id] : [parent.id]) : []
    for (const id of parents) this.lineage.get(id)!.births++
    this.lineage.set(agent.id, { id: agent.id, kind, generation, parents, births: 0, absorbed: 0 })
    this.agents.push(agent)
    return agent
  }

  /** Places food in a free position with room in the food budget. */
  addFood(point: Point) {
    if (this.food.length >= 160 || !this.free(point, 4) ||
      this.food.some(food => Geometry.distance(food, point) < 9)) return false
    this.food.push(point)
    return true
  }

  /** Places a rectangle without covering agents, food or other obstacles. */
  addObstacle(point: Point) {
    const box = { x: point.x - 24, y: point.y - 12, width: 48, height: 24 }
    if (this.obstacles.length >= 50 || box.x < 0 || box.y < 0 ||
      box.x + box.width > width || box.y + box.height > height) return false
    if (this.obstacles.some(other => box.x < other.x + other.width &&
      box.x + box.width > other.x && box.y < other.y + other.height &&
      box.y + box.height > other.y)) return false
    if (this.agents.some(agent => Geometry.obstacleDistance(agent, box) <= agent.radius) ||
      this.food.some(food => Geometry.obstacleDistance(food, box) <= 4)) return false
    this.obstacles.push(box)
    return true
  }

  /** Samples a food position using only the environment random stream. */
  private growFood() {
    this.addFood({ x: 20 + this.random('environmentSeed') * (width - 40), y: 20 + this.random('environmentSeed') * (height - 40) })
  }

  /** Finds the closest eligible item within the sensor range. */
  private nearest<T extends Point>(origin: Point, items: T[], range: number, accepts: (item: T) => boolean) {
    let target: T | undefined
    for (const item of items) {
      if (!accepts(item)) continue
      const gap = Geometry.distance(origin, item)
      if (gap >= range) continue
      target = item
      range = gap
    }
    return target
  }

  /** Attempts the chosen heading, then nearby directions around obstacles. */
  private move(agent: Agent, heading: number, speed: number, dt: number) {
    for (const offset of [0, .45, -.45, .95, -.95, 1.55, -1.55, Math.PI]) {
      const direction = heading + offset
      const point = { x: agent.x + Math.cos(direction) * speed * dt, y: agent.y + Math.sin(direction) * speed * dt }
      if (!this.free(point, agent.radius)) continue
      Object.assign(agent, point, { heading: direction })
      return
    }
  }

  /** Advances food and every entity that was alive at the start of the tick. */
  step(dt: number) {
    this.seconds += dt
    this.advanceFood(dt)
    for (const agent of [...this.agents]) this.advanceAgent(agent, dt)
    this.agents = this.agents.filter(agent => agent.energy > 0)
  }

  /** Regrows food at the configured interval while capacity remains. */
  private advanceFood(dt: number) {
    this.foodTimer += dt
    const growthInterval = this.supply === 'scarce' ? 1.8 : .36
    if (this.foodTimer >= growthInterval) {
      this.foodTimer -= growthInterval
      if (this.food.length < 80) this.growFood()
    }
  }

  /** Normalizes distance to a visible target by the sensor range. */
  private proximity(origin: Point, target: Point | undefined, range: number) {
    return target ? 1 - Geometry.distance(origin, target) / range : 0
  }

  /** Processes metabolism, network choice and action outcomes for one entity. */
  private advanceAgent(agent: Agent, dt: number) {
    if (agent.energy <= 0) return
    const hunts = agent.kind === 'hunter'
    agent.energy -= dt * (hunts ? 2.25 : 1.45)
    agent.cooldown -= dt
    if (agent.energy <= 0) {
      this.report(`#${agent.id} погиб от истощения`, 'death', [agent.id])
      return
    }
    const threat = hunts ? undefined : this.nearest(agent, this.agents, 77,
      item => item.kind === 'hunter' && item.energy > 0)
    const prey = hunts ? this.nearest(agent, this.agents, 235,
      item => item.kind === 'forager' && item.energy > 0) : undefined
    const meal = hunts ? undefined : this.nearest(agent, this.food, 140, () => true)
    const target = prey ?? meal
    const fertile = agent.energy >= 91 && agent.cooldown <= 0
    const inputs = [
      agent.energy / 100, this.proximity(agent, target, hunts ? 235 : 140),
      this.proximity(agent, threat, 77), Number(hunts), Number(fertile),
    ]
    const scores = agent.activate(inputs)
    const available = [!!target, !!threat, true, fertile]
    const action = available.reduce((best, allowed, index) =>
      allowed && scores[index] > scores[best] ? index : best, 2)
    const energyBeforeAction = agent.energy
    const startX = agent.x
    const startY = agent.y
    const heading = action === 1 && threat ? Math.atan2(agent.y - threat.y, agent.x - threat.x)
      : action === 0 && target ? Math.atan2(target.y - agent.y, target.x - agent.x)
      : agent.heading + (this.random('behaviorSeed') - .5) * .5
    if (action !== 3) this.move(agent, heading, hunts ? 72 : action === 1 ? 67 : 50, dt)

    const moved = agent.x !== startX || agent.y !== startY
    let outcome = action === 3 ? 'Рядом нет места для потомка или достигнут лимит популяции'
      : !moved ? 'Движение заблокировано'
      : action === 0 ? 'Движение к цели · цель ещё не достигнута'
      : action === 1 ? 'Сущность отступила' : 'Сущность обследовала местность'

    if (action === 0 && prey && Geometry.distance(agent, prey) <= agent.radius + prey.radius) {
      prey.energy = 0
      this.lineage.get(agent.id)!.absorbed++
      const radius = Math.min(20, agent.radius + .8)
      if (this.free(agent, radius)) agent.radius = radius
      agent.energy = Math.min(100, agent.energy + 47)
      outcome = `Поглощена сущность #${prey.id}`
      this.report(`#${agent.id} поглотил #${prey.id}`, 'absorption', [agent.id, prey.id])
    }
    if (action === 0 && meal && Geometry.distance(agent, meal) <= agent.radius + 4) {
      this.food.splice(this.food.indexOf(meal), 1)
      agent.energy = Math.min(100, agent.energy + 23)
      outcome = 'Пища съедена'
      this.report(`#${agent.id} нашёл пищу`, 'food', [agent.id])
    }

    if (action === 3) outcome = this.reproduce(agent) ?? outcome
    agent.decision = { seconds: this.seconds, inputs, scores, available, action, outcome, energyDelta: agent.energy - energyBeforeAction }
  }

  /** Finds space for offspring, charges the parent and records the birth. */
  private reproduce(agent: Agent) {
    const offset = agent.radius + (agent.kind === 'hunter' ? 13 : 9) + 4
    for (let direction = 0; direction < 2 * Math.PI; direction += Math.PI / 4) {
      const child = this.spawn({
        x: agent.x + Math.cos(direction) * offset,
        y: agent.y + Math.sin(direction) * offset,
      }, agent.kind, agent)
      if (!child) continue
      agent.energy -= 46
      agent.cooldown = 6
      this.report(`#${agent.id} оставил потомка #${child.id} · поколение ${child.generation}`,
        'birth', [...this.lineage.get(child.id)!.parents, child.id])
      return `Появился потомок #${child.id}`
    }
  }

  /** Scores energy, reproduction and successful absorptions for crossover. */
  private fitness(agent: Agent) {
    const history = this.lineage.get(agent.id)!
    return agent.energy / 100 + history.births + history.absorbed
  }
}
