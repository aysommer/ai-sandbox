import type { Agent, Point } from '../simulation.ts'

export type Cave = Point & { id: number; capacity: number }
export type ShelterRoute = { caveId: number; obstacles: number; points: Point[] }

const cell = 14

/** Finds obstacle-free approaches to caves using a four-direction map grid. */
export class CaveNavigator {
  /** Checks a straight approach first, then finds and shortens a grid route. */
  static route(start: Point, end: Point, width: number, height: number, free: (point: Point) => boolean): Point[] | undefined {
    if (CaveNavigator.clear(start, end, free)) return [end]

    const columns = Math.floor(width / cell)
    const rows = Math.floor(height / cell)
    const originX = Math.floor(start.x / cell)
    const originY = Math.floor(start.y / cell)
    const previous = new Int32Array(columns * rows).fill(-2)
    const queue: number[] = []
    for (let y = Math.max(0, originY - 1); y <= Math.min(rows - 1, originY + 1); y++) {
      for (let x = Math.max(0, originX - 1); x <= Math.min(columns - 1, originX + 1); x++) {
        const index = y * columns + x
        if (!CaveNavigator.clear(start, CaveNavigator.center(index, columns), free)) continue
        previous[index] = -1
        queue.push(index)
      }
    }

    for (let read = 0; read < queue.length; read++) {
      const index = queue[read]
      const point = CaveNavigator.center(index, columns)
      if (Math.hypot(point.x - end.x, point.y - end.y) <= cell * 2 && CaveNavigator.clear(point, end, free)) {
        const path = [end]
        for (let at = index; at >= 0; at = previous[at]) path.push(CaveNavigator.center(at, columns))
        return CaveNavigator.shorten(start, path.reverse(), free)
      }
      const x = index % columns
      const y = Math.floor(index / columns)
      const neighbors = [
        x > 0 ? index - 1 : -1, x + 1 < columns ? index + 1 : -1,
        y > 0 ? index - columns : -1, y + 1 < rows ? index + columns : -1,
      ]
      for (const neighbor of neighbors) {
        if (neighbor < 0 || previous[neighbor] !== -2) continue
        const next = CaveNavigator.center(neighbor, columns)
        if (!CaveNavigator.clear(point, next, free)) continue
        previous[neighbor] = index
        queue.push(neighbor)
      }
    }
  }

  /** Converts a grid index to the center of its cell. */
  private static center(index: number, columns: number): Point {
    return { x: (index % columns + .5) * cell, y: (Math.floor(index / columns) + .5) * cell }
  }

  /** Samples a short segment at intervals small enough to detect solid walls. */
  private static clear(start: Point, end: Point, free: (point: Point) => boolean) {
    const steps = Math.max(1, Math.ceil(Math.hypot(end.x - start.x, end.y - start.y) / 2))
    for (let step = 1; step <= steps; step++) {
      const part = step / steps
      if (!free({ x: start.x + (end.x - start.x) * part, y: start.y + (end.y - start.y) * part })) return false
    }
    return true
  }

  /** Removes intermediate waypoints where a straight shortcut is clear. */
  private static shorten(start: Point, path: Point[], free: (point: Point) => boolean) {
    const result: Point[] = []
    let current = start
    for (let index = 0; index < path.length;) {
      let next = path.length - 1
      while (next > index && !CaveNavigator.clear(current, path[next], free)) next--
      current = path[next]
      result.push(current)
      index = next + 1
    }
    return result
  }
}

/** Applies the initial shelter rules before the agent chooses a normal NEAT action. */
export class CaveRules {
  static readonly triggerRange = 112
  static readonly searchRange = 185
  static readonly entryClearance = 14
  static readonly exitEnergy = 18
  static readonly capacity = 3
  static readonly maximum = 24

  /** Counts only living occupants, so death or departure immediately frees a space. */
  static occupants(cave: Cave, agents: readonly Agent[]) {
    return agents.filter(agent => agent.energy > 0 && agent.shelter?.caveId === cave.id).length
  }

  /** Allows an exit once danger has passed or hunger makes hiding too costly. */
  static shouldLeave(agent: Agent, since: number, now: number, danger: boolean) {
    return agent.energy <= CaveRules.exitEnergy || (!danger && now - since >= 1.5)
  }
}
