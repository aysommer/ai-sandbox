import './style.css'

const canvas = document.querySelector<HTMLCanvasElement>('#world')!
const context = canvas.getContext('2d')!
const select = document.querySelector<HTMLSelectElement>('#selected-agent')!
const events = document.querySelector<HTMLOListElement>('#events')!
const emptyEvents = document.querySelector<HTMLParagraphElement>('#empty-events')!
const zoomDisplay = document.querySelector<HTMLOutputElement>('#zoom-value')!
const zoomIn = document.querySelector<HTMLButtonElement>('#zoom-in')!
const zoomOut = document.querySelector<HTMLButtonElement>('#zoom-out')!

const entities = [
  { id: '01', x: .19, y: .36 },
  { id: '02', x: .37, y: .65 },
  { id: '03', x: .53, y: .39 },
  { id: '04', x: .69, y: .74 },
  { id: '05', x: .81, y: .32 },
  { id: '06', x: .84, y: .58 },
]
const obstacles = [
  { x: .23, y: .49, width: .11, height: .035 },
  { x: .55, y: .55, width: .04, height: .19 },
  { x: .68, y: .22, width: .09, height: .045 },
]
const food = Array.from({ length: 38 }, (_, index) => ({
  x: .08 + ((index * 137 + 31) % 499) / 600,
  y: .13 + ((index * 229 + 13) % 503) / 680,
})).filter(point => obstacles.every(obstacle =>
  point.x < obstacle.x || point.x > obstacle.x + obstacle.width ||
  point.y < obstacle.y || point.y > obstacle.y + obstacle.height,
))
let zoom = 1

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
  if (events.childElementCount > 50) events.lastElementChild?.remove()
  emptyEvents.hidden = true
}

function project(position: number, dimension: number) {
  return dimension * (.5 + (position - .5) * zoom)
}

function draw() {
  const { width, height } = canvas.getBoundingClientRect()
  const density = window.devicePixelRatio || 1
  canvas.width = Math.round(width * density)
  canvas.height = Math.round(height * density)
  context.scale(density, density)

  context.fillStyle = '#171c32'
  context.fillRect(0, 0, width, height)
  context.strokeStyle = '#2c3551'
  const grid = 24 * zoom
  context.beginPath()
  for (let x = (width / 2) % grid; x < width; x += grid) {
    context.moveTo(x, 0)
    context.lineTo(x, height)
  }
  for (let y = (height / 2) % grid; y < height; y += grid) {
    context.moveTo(0, y)
    context.lineTo(width, y)
  }
  context.stroke()

  for (const obstacle of obstacles) {
    context.fillStyle = '#45536f'
    context.beginPath()
    context.roundRect(project(obstacle.x, width), project(obstacle.y, height), obstacle.width * width * zoom, obstacle.height * height * zoom, 4)
    context.fill()
  }

  for (const point of food) {
    context.fillStyle = '#68d8ad'
    context.beginPath()
    context.arc(project(point.x, width), project(point.y, height), 2.6 * zoom, 0, 2 * Math.PI)
    context.fill()
  }

  for (const entity of entities) {
    const x = project(entity.x, width)
    const y = project(entity.y, height)
    const selected = select.value === entity.id
    context.beginPath()
    context.arc(x, y, 18 * zoom, 0, 2 * Math.PI)
    context.fillStyle = selected ? '#6276ef66' : '#667bf332'
    context.fill()
    context.strokeStyle = selected ? '#e1e6ff' : '#8797f670'
    context.stroke()
    context.beginPath()
    context.arc(x, y, 9 * zoom, 0, 2 * Math.PI)
    context.fillStyle = '#9aabff'
    context.fill()
    context.fillStyle = '#e5eaff'
    context.textAlign = 'center'
    context.font = '12px system-ui'
    context.fillText('#' + entity.id, x, y + 32 * zoom)
  }
}

function setZoom(value: number) {
  zoom = value
  zoomDisplay.textContent = Math.round(zoom * 100) + '%'
  zoomOut.disabled = zoom <= .5
  zoomIn.disabled = zoom >= 2
  draw()
}

for (const { id } of entities) select.add(new Option('Сущность #' + id, id))
select.addEventListener('change', () => {
  draw()
  log(select.value ? 'Выбрана сущность #' + select.value : 'Выбор снят')
})
canvas.addEventListener('click', event => {
  const { width, height, left, top } = canvas.getBoundingClientRect()
  const x = event.clientX - left
  const y = event.clientY - top
  const hit = entities.find(entity => Math.hypot(x - project(entity.x, width), y - project(entity.y, height)) <= 18 * zoom)
  if ((hit?.id ?? '') !== select.value) {
    select.value = hit?.id ?? ''
    select.dispatchEvent(new Event('change'))
  }
})
zoomIn.addEventListener('click', () => setZoom(zoom + .25))
zoomOut.addEventListener('click', () => setZoom(zoom - .25))
document.querySelector('#reset')!.addEventListener('click', () => {
  select.value = ''
  setZoom(1)
  log('Вид карты сброшен')
})
document.querySelector('#clear')!.addEventListener('click', () => {
  events.replaceChildren()
  emptyEvents.hidden = false
})
new ResizeObserver(draw).observe(canvas)
setZoom(1)
log('Демонстрационная карта загружена')
