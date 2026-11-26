import { buildings, mapHeight, mapWidth, profiles, streets, type Building, type Point } from './districts.ts'
import type { CityState, ResidentState } from './simulation.ts'

/** Draws the street plan and keeps canvas pointer targets aligned with resident markers. */
export class CityMap {
  private readonly canvas = document.querySelector<HTMLCanvasElement>('#city-map')!
  private readonly context = this.canvas.getContext('2d')!
  private state?: CityState
  private selected?: number

  /** Creates a responsive canvas and connects its click handler. */
  constructor(select: (id: number) => void) {
    new ResizeObserver(() => this.draw()).observe(this.canvas)
    this.canvas.addEventListener('click', event => {
      const resident = this.hit(event)
      if (resident !== undefined) select(resident)
    })
  }

  /** Updates the frame and selection before painting. */
  render(state: CityState, selected?: number) {
    this.state = state
    this.selected = selected
    this.draw()
  }

  /** Converts a canvas click to a resident marker hit. */
  private hit(event: MouseEvent) {
    const bounds = this.canvas.getBoundingClientRect()
    if (!this.state || !bounds.width || !bounds.height) return
    const scale = Math.min(bounds.width / mapWidth, bounds.height / mapHeight)
    const x = (event.clientX - bounds.left - (bounds.width - mapWidth * scale) / 2) / scale
    const y = (event.clientY - bounds.top - (bounds.height - mapHeight * scale) / 2) / scale
    let nearest: number | undefined
    let gap = 23
    for (const resident of this.state.residents) {
      const marker = this.marker(resident)
      const distance = Math.hypot(marker.x - x, marker.y - y)
      if (distance >= gap) continue
      nearest = resident.id
      gap = distance
    }
    return nearest
  }

  /** Paints a map frame on a device-pixel-scaled canvas. */
  private draw() {
    const { width, height } = this.canvas.getBoundingClientRect()
    if (!width || !height || document.hidden) return
    const dpr = window.devicePixelRatio || 1
    const pixelsWide = Math.round(width * dpr)
    const pixelsHigh = Math.round(height * dpr)
    if (this.canvas.width !== pixelsWide) this.canvas.width = pixelsWide
    if (this.canvas.height !== pixelsHigh) this.canvas.height = pixelsHigh
    const scale = Math.min(width / mapWidth, height / mapHeight)
    const context = this.context
    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.fillStyle = '#e1e8df'
    context.fillRect(0, 0, width, height)
    context.translate((width - mapWidth * scale) / 2, (height - mapHeight * scale) / 2)
    context.scale(scale, scale)
    this.drawStreets()
    for (const building of Object.values(buildings)) this.drawBuilding(building)
    for (const resident of this.state?.residents ?? []) this.drawResident(resident)
  }

  /** Draws pavement, center lines and the neighborhood green spaces. */
  private drawStreets() {
    const context = this.context
    context.fillStyle = '#c9d6c7'
    context.fillRect(0, 0, mapWidth, mapHeight)
    for (const x of [145, 356, 397, 530, 841]) {
      for (const y of [78, 253, 431, 566]) {
        this.circle({ x, y }, 13, '#aac2a9')
        this.circle({ x: x - 4, y: y - 3 }, 8, '#91b398')
      }
    }

    context.fillStyle = '#b8c3c4'
    for (const y of streets.horizontal) context.fillRect(0, y - 17, mapWidth, 34)
    for (const x of streets.vertical) context.fillRect(x - 17, 0, 34, mapHeight)
    context.fillStyle = '#e7ebe8'
    for (const y of streets.horizontal) context.fillRect(0, y - 12, mapWidth, 24)
    for (const x of streets.vertical) context.fillRect(x - 12, 0, 24, mapHeight)
    context.strokeStyle = '#aab9b8'
    context.setLineDash([7, 10])
    context.beginPath()
    for (const y of streets.horizontal) {
      context.moveTo(0, y)
      context.lineTo(mapWidth, y)
    }
    for (const x of streets.vertical) {
      context.moveTo(x, 0)
      context.lineTo(x, mapHeight)
    }
    context.stroke()
    context.setLineDash([])
  }

  /** Draws one building with a labeled roof and a door on its street side. */
  private drawBuilding(building: Building) {
    const { x, y } = building.door
    const context = this.context
    const width = building.id.endsWith('home') || building.id === 'stockroom' ? 162 : 135
    context.fillStyle = '#a5b3a6'
    context.fillRect(x - width / 2 + 3, y - 74, width, 72)
    context.fillStyle = '#f7f4e9'
    context.fillRect(x - width / 2, y - 79, width, 72)
    context.fillStyle = building.accent
    context.fillRect(x - width / 2, y - 79, width, 13)
    context.fillRect(x - 15, y - 16, 30, 18)
    context.fillStyle = '#202e31'
    context.textAlign = 'center'
    context.font = '600 15px system-ui'
    context.fillText(building.label, x, y - 39)
  }

  /** Offsets markers at a shared address so all occupants remain selectable. */
  private marker(resident: ResidentState): Point {
    if (resident.activity === 'commute' || resident.activity === 'return') return resident.position
    const neighbors = this.state!.residents.filter(other =>
      other.position.x === resident.position.x && other.position.y === resident.position.y)
    const index = neighbors.indexOf(resident)
    return { x: resident.position.x + (index - (neighbors.length - 1) / 2) * 22, y: resident.position.y }
  }

  /** Draws an accessible numbered marker and highlights the active resident. */
  private drawResident(resident: ResidentState) {
    const marker = this.marker(resident)
    const profile = profiles[resident.id - 1]
    this.circle(marker, resident.id === this.selected ? 14 : 11, '#fff')
    this.circle(marker, 9, profile.color)
    const context = this.context
    context.fillStyle = '#fff'
    context.textAlign = 'center'
    context.font = '700 11px system-ui'
    context.fillText(String(resident.id), marker.x, marker.y + 4)
  }

  /** Paints a filled circle in world coordinates. */
  private circle(point: Point, radius: number, color: string) {
    this.context.fillStyle = color
    this.context.beginPath()
    this.context.arc(point.x, point.y, radius, 0, 2 * Math.PI)
    this.context.fill()
  }
}
