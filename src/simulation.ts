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
}
type Obstacle = Point & { width: number; height: number }

export const names = { forager: 'Собиратель', hunter: 'Хищник' }

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(value, min))

export class World {
  agents: Agent[] = []
  food: Point[] = []
  obstacles: Obstacle[] = []
  seconds = 0
  private nextId = 1
  private seed = 267
  private foodTimer = 0

  private readonly report: (message: string) => void

  constructor(report: (message: string) => void) {
    this.report = report
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

  private random() {
    this.seed = (Math.imul(1664525, this.seed) + 1013904223) >>> 0
    return this.seed / 2 ** 32
  }

  private free(point: Point, radius: number) {
    return point.x >= radius && point.x <= width - radius &&
      point.y >= radius && point.y <= height - radius &&
      this.obstacles.every(box => Math.hypot(
        point.x - clamp(point.x, box.x, box.x + box.width),
        point.y - clamp(point.y, box.y, box.y + box.height),
      ) > radius)
  }

  spawn(point: Point, kind: Kind, generation = 1) {
    const radius = kind === 'hunter' ? 13 : 9
    if (this.agents.length >= 120 || !this.free(point, radius) ||
      this.agents.some(agent => distance(agent, point) < agent.radius + radius)) return
    const agent: Agent = {
      ...point, id: this.nextId++, kind, radius, energy: generation === 1 ? 68 : 46,
      heading: this.random() * 2 * Math.PI, generation, cooldown: 3,
    }
    this.agents.push(agent)
    return agent
  }

  addFood(point: Point) {
    if (this.food.length >= 160 || !this.free(point, 4) ||
      this.food.some(food => distance(food, point) < 9)) return false
    this.food.push(point)
    return true
  }

  addObstacle(point: Point) {
    const box = { x: point.x - 24, y: point.y - 12, width: 48, height: 24 }
    if (this.obstacles.length >= 50 || box.x < 0 || box.y < 0 ||
      box.x + box.width > width || box.y + box.height > height) return false
    if (this.obstacles.some(other => box.x < other.x + other.width &&
      box.x + box.width > other.x && box.y < other.y + other.height &&
      box.y + box.height > other.y)) return false
    const overlaps = (item: Point, radius: number) => Math.hypot(
      item.x - clamp(item.x, box.x, box.x + box.width),
      item.y - clamp(item.y, box.y, box.y + box.height),
    ) <= radius
    if (this.agents.some(agent => overlaps(agent, agent.radius)) ||
      this.food.some(food => overlaps(food, 4))) return false
    this.obstacles.push(box)
    return true
  }

  private growFood() {
    this.addFood({ x: 20 + this.random() * (width - 40), y: 20 + this.random() * (height - 40) })
  }

  private nearest<T extends Point>(origin: Point, items: T[], range: number, accepts: (item: T) => boolean) {
    let target: T | undefined
    for (const item of items) {
      if (!accepts(item)) continue
      const gap = distance(origin, item)
      if (gap >= range) continue
      target = item
      range = gap
    }
    return target
  }

  private move(agent: Agent, heading: number, speed: number, dt: number) {
    for (const offset of [0, .45, -.45, .95, -.95, 1.55, -1.55, Math.PI]) {
      const direction = heading + offset
      const point = { x: agent.x + Math.cos(direction) * speed * dt, y: agent.y + Math.sin(direction) * speed * dt }
      if (!this.free(point, agent.radius)) continue
      Object.assign(agent, point, { heading: direction })
      return
    }
  }

  step(dt: number) {
    this.seconds += dt
    this.foodTimer += dt
    if (this.foodTimer >= .36) {
      this.foodTimer -= .36
      if (this.food.length < 80) this.growFood()
    }

    for (const agent of [...this.agents]) {
      if (agent.energy <= 0) continue
      const hunts = agent.kind === 'hunter'
      agent.energy -= dt * (hunts ? 2.25 : 1.45)
      agent.cooldown -= dt
      if (agent.energy <= 0) {
        this.report(`#${agent.id} погиб от истощения`)
        continue
      }
      const threat = hunts ? undefined : this.nearest(agent, this.agents, 77,
        item => item.kind === 'hunter' && item.energy > 0)
      const prey = hunts ? this.nearest(agent, this.agents, 235,
        item => item.kind === 'forager' && item.energy > 0) : undefined
      const meal = hunts ? undefined : this.nearest(agent, this.food, 140, () => true)
      const target = prey ?? meal
      const heading = threat ? Math.atan2(agent.y - threat.y, agent.x - threat.x)
        : target ? Math.atan2(target.y - agent.y, target.x - agent.x)
        : agent.heading + (this.random() - .5) * .5
      this.move(agent, heading, hunts ? 72 : threat ? 67 : 50, dt)

      if (prey && distance(agent, prey) <= agent.radius + prey.radius) {
        prey.energy = 0
        const radius = Math.min(20, agent.radius + .8)
        if (this.free(agent, radius)) agent.radius = radius
        agent.energy = Math.min(100, agent.energy + 47)
        this.report(`#${agent.id} поглотил #${prey.id}`)
      }
      if (meal && distance(agent, meal) <= agent.radius + 4) {
        this.food.splice(this.food.indexOf(meal), 1)
        agent.energy = Math.min(100, agent.energy + 23)
      }

      if (agent.energy >= 91 && agent.cooldown <= 0) {
        const offset = agent.radius + (hunts ? 13 : 9) + 4
        for (let direction = 0; direction < 2 * Math.PI; direction += Math.PI / 4) {
          const child = this.spawn({
            x: agent.x + Math.cos(direction) * offset,
            y: agent.y + Math.sin(direction) * offset,
          }, agent.kind, agent.generation + 1)
          if (!child) continue
          agent.energy -= 46
          agent.cooldown = 6
          this.report(`#${agent.id} оставил потомка #${child.id} · поколение ${child.generation}`)
          break
        }
      }
    }
    this.agents = this.agents.filter(agent => agent.energy > 0)
  }
}
