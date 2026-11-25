import { width, height, type AgentView, type Point, type WorldView } from '../simulation.ts'

/** Owns the canvas, coordinate conversion and zoom controls. */
export class WorldMap {
  private readonly canvas = document.querySelector<HTMLCanvasElement>('#world')!
  private readonly context = this.canvas.getContext('2d')!
  private readonly zoomDisplay = document.querySelector<HTMLOutputElement>('#zoom-value')!
  private readonly zoomIn = document.querySelector<HTMLButtonElement>('#zoom-in')!
  private readonly zoomOut = document.querySelector<HTMLButtonElement>('#zoom-out')!
  private zoom = 1

  /** Connects pointer input and repaints when the canvas size or zoom changes. */
  constructor(redraw: () => void, place: (point: Point) => void) {
    this.zoomIn.addEventListener('click', () => { this.setZoom(this.zoom + .25); redraw() })
    this.zoomOut.addEventListener('click', () => { this.setZoom(this.zoom - .25); redraw() })
    this.canvas.addEventListener('click', event => place(this.toWorld(event)))
    new ResizeObserver(redraw).observe(this.canvas)
    this.setZoom(1)
  }

  /** Returns the map to its initial zoom. */
  reset() {
    this.setZoom(1)
  }

  /** Updates the zoom label and its control boundaries. */
  private setZoom(value: number) {
    this.zoom = value
    this.zoomDisplay.textContent = Math.round(value * 100) + '%'
    this.zoomOut.disabled = value <= .5
    this.zoomIn.disabled = value >= 2
  }

  /** Maps client coordinates back to positions in the simulation. */
  private toWorld(event: MouseEvent): Point {
    const bounds = this.canvas.getBoundingClientRect()
    const camera = this.view(bounds.width, bounds.height)
    return {
      x: (event.clientX - bounds.left - camera.x) / camera.scale,
      y: (event.clientY - bounds.top - camera.y) / camera.scale,
    }
  }

  /** Fits the world to the canvas with the current zoom. */
  private view(pixelWidth: number, pixelHeight: number) {
    const scale = Math.min(pixelWidth / width, pixelHeight / height) * this.zoom
    return { scale, x: (pixelWidth - width * scale) / 2, y: (pixelHeight - height * scale) / 2 }
  }

  /** Paints a filled circle in world coordinates. */
  private circle(point: Point, radius: number, color: string) {
    this.context.beginPath()
    this.context.arc(point.x, point.y, radius, 0, 2 * Math.PI)
    this.context.fillStyle = color
    this.context.fill()
  }

  /** Paints a world frame and outlines the selected entity. */
  draw(world: WorldView, selected?: number) {
    const { width: pixelWidth, height: pixelHeight } = this.canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const backingWidth = Math.round(pixelWidth * dpr)
    const backingHeight = Math.round(pixelHeight * dpr)
    if (this.canvas.width !== backingWidth || this.canvas.height !== backingHeight) {
      this.canvas.width = backingWidth
      this.canvas.height = backingHeight
    }
    this.context.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.context.fillStyle = '#172433'
    this.context.fillRect(0, 0, pixelWidth, pixelHeight)
    const camera = this.view(pixelWidth, pixelHeight)
    this.context.translate(camera.x, camera.y)
    this.context.scale(camera.scale, camera.scale)
    this.context.fillStyle = '#243549'
    this.context.fillRect(0, 0, width, height)
    this.context.strokeStyle = '#34475b'
    this.context.lineWidth = 1
    this.context.beginPath()
    for (let x = 0; x <= width; x += 25) {
      this.context.moveTo(x, 0)
      this.context.lineTo(x, height)
    }
    for (let y = 0; y <= height; y += 25) {
      this.context.moveTo(0, y)
      this.context.lineTo(width, y)
    }
    this.context.stroke()
    for (const obstacle of world.obstacles) {
      this.context.fillStyle = '#7f90a5'
      this.context.beginPath()
      this.context.roundRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height, 4)
      this.context.fill()
    }
    for (const food of world.food) this.circle(food, 3.5, '#83dfb2')
    for (const cave of world.caves) {
      this.circle(cave, 23, '#bca9ed')
      this.circle({ x: cave.x, y: cave.y - 2 }, 17, '#332e48')
      const occupants = world.agents.filter(agent => agent.shelter?.caveId === cave.id)
      this.label(`Пещера №${cave.id} · ${occupants.length}/${cave.capacity}`, cave.x, cave.y + 37)
      occupants.forEach((agent, index) => {
        const center = { x: cave.x + (index - (occupants.length - 1) / 2) * 10, y: cave.y - 2 }
        this.circle(center, agent.id === selected ? 5 : 3, agent.id === selected ? '#fff' : '#a8c7fa')
      })
    }
    for (const agent of world.agents) {
      if (!agent.shelter) this.drawAgent(agent, selected)
    }
  }

  /** Finds an exposed entity or an occupant at the rendered cave position. */
  agentAt(world: WorldView, point: Point) {
    const exposed = world.agents.findLast(agent => !agent.shelter &&
      Math.hypot(point.x - agent.x, point.y - agent.y) <= agent.radius + 5)
    if (exposed) return exposed.id
    const cave = world.caves.find(cave => Math.hypot(point.x - cave.x, point.y - cave.y) <= 23)
    if (!cave) return
    const occupants = world.agents.filter(agent => agent.shelter?.caveId === cave.id)
    const index = Math.round((point.x - cave.x) / 10 + (occupants.length - 1) / 2)
    return occupants[Math.min(occupants.length - 1, Math.max(0, index))]?.id
  }

  /** Draws an exposed entity, its heading and selection ring. */
  private drawAgent(agent: AgentView, selected?: number) {
    if (agent.id === selected) this.circle(agent, agent.radius + 5, '#ffffff')
    this.circle(agent, agent.radius, agent.kind === 'hunter' ? '#ffae82' : '#a8c7fa')
    this.circle({
      x: agent.x + Math.cos(agent.heading) * agent.radius * .6,
      y: agent.y + Math.sin(agent.heading) * agent.radius * .6,
    }, 2.4, '#243549')
    this.label('#' + agent.id, agent.x, agent.y + agent.radius + 15)
  }

  /** Draws a centered label in world coordinates. */
  private label(value: string, x: number, y: number) {
    this.context.fillStyle = '#f1f5ff'
    this.context.textAlign = 'center'
    this.context.font = '13px system-ui'
    this.context.fillText(value, x, y)
  }
}
