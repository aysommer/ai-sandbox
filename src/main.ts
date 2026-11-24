import './style.css'
import { World, width, height, names, tick, type FoodSupply, type Point } from './simulation'
import { experimentSeconds, runExperiment } from './experiments'

const canvas = document.querySelector<HTMLCanvasElement>('#world')!
const context = canvas.getContext('2d')!
const select = document.querySelector<HTMLSelectElement>('#selected-agent')!
const events = document.querySelector<HTMLOListElement>('#events')!
const emptyEvents = document.querySelector<HTMLParagraphElement>('#empty-events')!
const zoomDisplay = document.querySelector<HTMLOutputElement>('#zoom-value')!
const zoomIn = document.querySelector<HTMLButtonElement>('#zoom-in')!
const zoomOut = document.querySelector<HTMLButtonElement>('#zoom-out')!
const run = document.querySelector<HTMLButtonElement>('#run')!
const status = document.querySelector('#status')!
const stats = document.querySelector('#stats')!
const details = document.querySelector('#agent-details')!
const help = document.querySelector('#map-help')!
const tools = document.querySelectorAll<HTMLButtonElement>('[data-tool]')
const seedInput = document.querySelector<HTMLInputElement>('#seed')!
const supplySelect = document.querySelector<HTMLSelectElement>('#supply')!
const compare = document.querySelector<HTMLButtonElement>('#compare')!
const experiment = document.querySelector<HTMLElement>('#experiment')!
const experimentDescription = document.querySelector('#experiment-description')!
const experimentRows = document.querySelector('#experiment-rows')!
const ancestry = document.querySelector<HTMLDetailsElement>('#ancestry')!
const ancestors = document.querySelector('#ancestors')!
let shownAncestry: number | undefined

const instructions = {
  select: 'Выберите сущность на карте',
  forager: 'Нажмите на карту, чтобы разместить собирателя',
  hunter: 'Нажмите на карту, чтобы разместить хищника',
  food: 'Нажмите на карту, чтобы разместить пищу',
  obstacle: 'Нажмите на карту, чтобы разместить препятствие',
}
type Tool = keyof typeof instructions
let tool: Tool = 'select'
let selected: number | undefined
let zoom = 1
let running = false
let world = new World(log)
let lastFrame = 0
let elapsed = 0
let frame = 0

function log(message: string) {
  const item = document.createElement('li')
  const time = document.createElement('time')
  const now = new Date()
  time.dateTime = now.toISOString()
  time.textContent = now.toLocaleTimeString('ru-RU')
  const text = document.createElement('span')
  text.textContent = message
  item.append(time, text)
  events.prepend(item)
  if (events.childElementCount > 80) events.lastElementChild?.remove()
  emptyEvents.hidden = true
}

function view(pixelWidth: number, pixelHeight: number) {
  const scale = Math.min(pixelWidth / width, pixelHeight / height) * zoom
  return { scale, x: (pixelWidth - width * scale) / 2, y: (pixelHeight - height * scale) / 2 }
}

function circle(point: Point, radius: number, color: string) {
  context.beginPath()
  context.arc(point.x, point.y, radius, 0, 2 * Math.PI)
  context.fillStyle = color
  context.fill()
}

function draw() {
  const { width: pixelWidth, height: pixelHeight } = canvas.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  const backingWidth = Math.round(pixelWidth * dpr)
  const backingHeight = Math.round(pixelHeight * dpr)
  if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
    canvas.width = backingWidth
    canvas.height = backingHeight
  }
  context.setTransform(dpr, 0, 0, dpr, 0, 0)
  context.fillStyle = '#172433'
  context.fillRect(0, 0, pixelWidth, pixelHeight)
  const camera = view(pixelWidth, pixelHeight)
  context.translate(camera.x, camera.y)
  context.scale(camera.scale, camera.scale)
  context.fillStyle = '#243549'
  context.fillRect(0, 0, width, height)
  context.strokeStyle = '#34475b'
  context.lineWidth = 1
  context.beginPath()
  for (let x = 0; x <= width; x += 25) {
    context.moveTo(x, 0)
    context.lineTo(x, height)
  }
  for (let y = 0; y <= height; y += 25) {
    context.moveTo(0, y)
    context.lineTo(width, y)
  }
  context.stroke()
  for (const obstacle of world.obstacles) {
    context.fillStyle = '#7f90a5'
    context.beginPath()
    context.roundRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height, 4)
    context.fill()
  }
  for (const food of world.food) circle(food, 3.5, '#83dfb2')
  for (const agent of world.agents) {
    if (agent.id === selected) circle(agent, agent.radius + 5, '#ffffff')
    circle(agent, agent.radius, agent.kind === 'hunter' ? '#ffae82' : '#a8c7fa')
    circle({
      x: agent.x + Math.cos(agent.heading) * agent.radius * .6,
      y: agent.y + Math.sin(agent.heading) * agent.radius * .6,
    }, 2.4, '#243549')
    context.fillStyle = '#f1f5ff'
    context.textAlign = 'center'
    context.font = '13px system-ui'
    context.fillText('#' + agent.id, agent.x, agent.y + agent.radius + 15)
  }
}

function updateUI() {
  const ids = world.agents.map(agent => String(agent.id))
  const current = Array.from(select.options).slice(1).map(option => option.value)
  if (ids.join() !== current.join()) {
    select.length = 1
    for (const agent of world.agents) {
      select.add(new Option(`${names[agent.kind]} #${agent.id}`, String(agent.id)))
    }
  }
  const agent = world.agents.find(agent => agent.id === selected)
  selected = agent?.id
  const selection = agent ? String(agent.id) : ''
  if (select.value !== selection) select.value = selection
  const description = agent ? `${names[agent.kind]} #${agent.id} · энергия ${Math.ceil(agent.energy)}% · поколение ${agent.generation}`
    : 'Выберите сущность для просмотра её состояния.'
  if (details.textContent !== description) details.textContent = description
  if (shownAncestry !== agent?.id) {
    shownAncestry = agent?.id
    ancestry.hidden = !agent
    ancestors.replaceChildren()
    const pending = agent ? [agent.id] : []
    const seen = new Set<number>()
    while (pending.length) {
      const id = pending.shift()!
      if (seen.has(id)) continue
      seen.add(id)
      const record = world.lineage.get(id)!
      const row = document.createElement('li')
      const parents = record.parents.map(parent => '#' + parent).join(', ')
      row.textContent = `#${id} · поколение ${record.generation} · ${parents ? 'родители ' + parents : 'основатель'}`
      ancestors.append(row)
      pending.push(...record.parents)
    }
  }
  const summary = `Сущности: ${world.agents.length} · Пища: ${world.food.length} · Время мира: ${Math.floor(world.seconds)} с`
  if (stats.textContent !== summary) stats.textContent = summary
}

function animate(now: number) {
  elapsed += lastFrame ? Math.min((now - lastFrame) / 1000, .2) : 0
  lastFrame = now
  while (elapsed >= tick) {
    world.step(tick)
    elapsed -= tick
  }
  updateUI()
  draw()
  frame = requestAnimationFrame(animate)
}

function setRunning(value: boolean) {
  running = value
  cancelAnimationFrame(frame)
  lastFrame = 0
  elapsed = 0
  run.textContent = value ? 'Пауза' : 'Запустить'
  status.textContent = value ? 'Симуляция идёт' : 'Пауза'
  if (value) frame = requestAnimationFrame(animate)
}

function setZoom(value: number) {
  zoom = value
  zoomDisplay.textContent = Math.round(zoom * 100) + '%'
  zoomOut.disabled = zoom <= .5
  zoomIn.disabled = zoom >= 2
  draw()
}

for (const button of tools) button.addEventListener('click', () => {
  tool = button.dataset.tool as Tool
  for (const item of tools) item.setAttribute('aria-pressed', String(item === button))
  help.textContent = instructions[tool]
})

select.addEventListener('change', () => {
  selected = Number(select.value) || undefined
  updateUI()
  draw()
})
canvas.addEventListener('click', event => {
  const { width: w, height: h, left, top } = canvas.getBoundingClientRect()
  const camera = view(w, h)
  const point = { x: (event.clientX - left - camera.x) / camera.scale, y: (event.clientY - top - camera.y) / camera.scale }
  if (tool === 'select') {
    selected = world.agents.findLast(agent => Math.hypot(point.x - agent.x, point.y - agent.y) <= agent.radius + 5)?.id
  } else if (tool === 'food' || tool === 'obstacle') {
    const placed = tool === 'food' ? world.addFood(point) : world.addObstacle(point)
    log(placed ? (tool === 'food' ? 'Добавлена пища' : 'Добавлено препятствие') : 'Размещение здесь недоступно или достигнут лимит')
  } else {
    const agent = world.spawn(point, tool)
    if (agent) selected = agent.id
    log(agent ? `Добавлен ${names[tool].toLowerCase()} #${agent.id}` : 'Размещение здесь недоступно или достигнут лимит')
  }
  updateUI()
  draw()
})

zoomIn.addEventListener('click', () => setZoom(zoom + .25))
zoomOut.addEventListener('click', () => setZoom(zoom - .25))
run.addEventListener('click', () => setRunning(!running))
document.querySelector('#reset')!.addEventListener('click', () => setZoom(1))
function readSeed() {
  if (!seedInput.reportValidity()) return
  return seedInput.valueAsNumber
}
seedInput.required = true

document.querySelector('#restart')!.addEventListener('click', () => {
  const seed = readSeed()
  if (seed === undefined) return
  setRunning(false)
  world = new World(log, seed, supplySelect.value as FoodSupply)
  selected = undefined
  updateUI()
  setZoom(1)
  events.replaceChildren()
  log(`Восстановлен старт мира · seed ${seed}`)
})
document.querySelector('#clear')!.addEventListener('click', () => {
  events.replaceChildren()
  emptyEvents.hidden = false
})

compare.addEventListener('click', () => {
  const seed = readSeed()
  if (seed === undefined) return
  compare.disabled = true
  experiment.hidden = false
  experimentRows.replaceChildren()
  experimentDescription.textContent = 'Выполняются два прогона…'
  window.setTimeout(() => {
    try {
      for (const supply of ['normal', 'scarce'] as const) {
        const generations = runExperiment(seed, supply)
        for (const [generation, metrics] of generations) {
          const row = document.createElement('tr')
          for (const value of [generation, supply === 'normal' ? 'Обычное' : 'Редкое', metrics.born, metrics.alive, metrics.absorbed]) {
            const cell = document.createElement('td')
            cell.textContent = String(value)
            row.append(cell)
          }
          experimentRows.append(row)
        }
      }
      experimentDescription.textContent = `Seed ${seed} · каждый прогон длится ${experimentSeconds} с мира. Меняется частота пополнения пищи.`
    } finally {
      compare.disabled = false
    }
  }, 0)
})

new ResizeObserver(draw).observe(canvas)
updateUI()
setZoom(1)
log('Мир готов к запуску')
