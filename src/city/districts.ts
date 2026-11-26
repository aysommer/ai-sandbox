export type Point = { x: number; y: number }
export type BuildingId = 'north-home' | 'south-home' | 'police' | 'office' | 'cafe' | 'restaurant' | 'garage' | 'station' | 'stockroom'
export type Building = { id: BuildingId; label: string; door: Point; road: number; accent: string }
export type Job = { building: BuildingId; title: string; start: number; end: number }
export type ResidentProfile = { id: number; name: string; role: string; color: string; home: BuildingId; job: Job }

export const mapWidth = 980
export const mapHeight = 600
export const streets = { horizontal: [164, 341, 520], vertical: [92, 477, 890] }
export const minutesPerDay = 1440

export const buildings: Record<BuildingId, Building> = {
  'north-home': { id: 'north-home', label: 'Северный квартал', door: { x: 240, y: 142 }, road: 164, accent: '#5c7d70' },
  'south-home': { id: 'south-home', label: 'Южный квартал', door: { x: 240, y: 498 }, road: 520, accent: '#5c7d70' },
  police: { id: 'police', label: 'Участок', door: { x: 580, y: 142 }, road: 164, accent: '#456ab0' },
  office: { id: 'office', label: 'Офис', door: { x: 757, y: 142 }, road: 164, accent: '#5d58a5' },
  cafe: { id: 'cafe', label: 'Кофейня', door: { x: 579, y: 319 }, road: 341, accent: '#9b6648' },
  restaurant: { id: 'restaurant', label: 'Ресторан', door: { x: 759, y: 319 }, road: 341, accent: '#b76850' },
  garage: { id: 'garage', label: 'Мастерская', door: { x: 579, y: 498 }, road: 520, accent: '#666d7a' },
  station: { id: 'station', label: 'Станция', door: { x: 759, y: 498 }, road: 520, accent: '#3c7785' },
  stockroom: { id: 'stockroom', label: 'Склад', door: { x: 245, y: 319 }, road: 341, accent: '#7d7448' },
}

export const profiles: readonly ResidentProfile[] = [
  { id: 1, name: 'Ирина', role: 'Полицейский', color: '#345fac', home: 'south-home', job: { building: 'police', title: 'Дежурство', start: 480, end: 960 } },
  { id: 2, name: 'Максим', role: 'Вор', color: '#74528c', home: 'north-home', job: { building: 'stockroom', title: 'Подработка на складе', start: 630, end: 870 } },
  { id: 3, name: 'Алия', role: 'Программист', color: '#4f4b9d', home: 'south-home', job: { building: 'office', title: 'Разработка ПО', start: 540, end: 1020 } },
  { id: 4, name: 'Лена', role: 'Бариста', color: '#926143', home: 'north-home', job: { building: 'cafe', title: 'Работа в кофейне', start: 450, end: 930 } },
  { id: 5, name: 'Сергей', role: 'Автомеханик', color: '#59616d', home: 'north-home', job: { building: 'garage', title: 'Смена в мастерской', start: 510, end: 990 } },
  { id: 6, name: 'Олег', role: 'Машинист', color: '#327482', home: 'north-home', job: { building: 'station', title: 'Смена на станции', start: 470, end: 950 } },
  { id: 7, name: 'Ника', role: 'Официант', color: '#a25046', home: 'south-home', job: { building: 'restaurant', title: 'Обслуживание гостей', start: 660, end: 1140 } },
  { id: 8, name: 'Денис', role: 'Повар', color: '#866825', home: 'south-home', job: { building: 'restaurant', title: 'Смена на кухне', start: 600, end: 1080 } },
]

/** Formats an absolute city time or shift boundary as local clock hours and minutes. */
export class CityTime {
  /** Converts a minute to its time of day. */
  static format(minute: number) {
    const withinDay = minute % minutesPerDay
    const hours = String(Math.floor(withinDay / 60)).padStart(2, '0')
    const minutes = String(withinDay % 60).padStart(2, '0')
    return hours + ':' + minutes
  }
}

/** Builds walking routes along two sidewalks and the street grid. */
export class StreetNetwork {
  /** Joins building entrances by the nearest usable cross street. */
  static route(from: Building, to: Building): Point[] {
    const route = [{ x: from.door.x, y: from.road }]
    if (from.road !== to.road) {
      const cross = streets.vertical.reduce((best, x) =>
        Math.abs(x - from.door.x) + Math.abs(x - to.door.x) <
        Math.abs(best - from.door.x) + Math.abs(best - to.door.x) ? x : best)
      route.push({ x: cross, y: from.road }, { x: cross, y: to.road })
    }
    return [...route, { x: to.door.x, y: to.road }, to.door]
  }

  /** Computes the exact walking distance of a street route. */
  static distance(start: Point, route: readonly Point[]) {
    let current = start
    let distance = 0
    for (const point of route) {
      distance += Math.hypot(point.x - current.x, point.y - current.y)
      current = point
    }
    return distance
  }
}
