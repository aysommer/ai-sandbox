import { buildings, minutesPerDay, profiles, StreetNetwork, type Point, type ResidentProfile } from './districts.ts'
import { CityEconomy, type EconomyState } from './economy.ts'

export type Activity = 'home' | 'commute' | 'work' | 'return'
export type ResidentState = { id: number; activity: Activity; position: Point; worked: number; remaining: Point[] }
export type CityEvent = { minute: number; resident: number; activity: Activity }
export type CityState = { minute: number; residents: ResidentState[]; events: CityEvent[]; economy: EconomyState }
export type SavedCityState = Omit<CityState, 'economy'> & { economy?: EconomyState }
const walkingSpeed = 26
const orderTimes = { cafe: 10 * 60, restaurant: 12 * 60 } as const

/** Runs the same daily schedule for all residents, creating observable city events. */
export class CitySimulation {
  private readonly state: CityState

  /** Starts a city at 07:00 or restores an existing state. */
  constructor(saved?: SavedCityState) {
    const restored = saved && structuredClone(saved)
    this.state = restored ? { ...restored, economy: restored.economy ?? CityEconomy.start() } : {
      minute: 420,
      residents: profiles.map(profile => ({
        id: profile.id, activity: 'home', position: { ...buildings[profile.home].door }, remaining: [], worked: 0,
      })),
      events: [],
      economy: CityEconomy.start(),
    }
  }

  /** Captures a cloneable city state for a frame or a checkpoint. */
  snapshot(): CityState {
    return structuredClone(this.state)
  }

  /** Advances whole city minutes and updates residents in a stable order. */
  advance(minutes: number) {
    for (let step = 0; step < minutes; step++) {
      this.state.minute++
      const time = this.state.minute % minutesPerDay
      for (const [index, resident] of this.state.residents.entries()) {
        this.advanceResident(resident, profiles[index], time)
      }
      this.trade(time)
    }
  }

  /** Applies scheduled departures and arrivals, counting only time spent at work. */
  private advanceResident(resident: ResidentState, profile: ResidentProfile, time: number) {
    const job = profile.job
    if (time === 0) resident.worked = 0
    if (resident.activity === 'home') {
      const home = buildings[profile.home]
      const route = StreetNetwork.route(home, buildings[job.building])
      const travel = Math.ceil(StreetNetwork.distance(home.door, route) / walkingSpeed)
      if (time < job.start - travel + 1 || time >= job.end) return
      resident.remaining = route
      this.change(resident, 'commute')
    }

    if (resident.activity === 'work') {
      resident.worked++
      if (time < job.end) return
      CityEconomy.payShift(this.state.economy, this.state.minute, resident.id, resident.worked)
      resident.remaining = StreetNetwork.route(buildings[job.building], buildings[profile.home])
      this.change(resident, 'return')
      return
    }

    this.walk(resident)
    if (!resident.remaining.length) this.change(resident, resident.activity === 'commute' ? 'work' : 'home')
  }

  /** Runs scheduled orders while the venue is staffed and replenishes its stock daily. */
  private trade(time: number) {
    const { economy, minute, residents } = this.state
    if (time === 8 * 60) {
      CityEconomy.restock(economy, 'cafe', minute)
      CityEconomy.restock(economy, 'restaurant', minute)
    }
    for (const merchant of ['cafe', 'restaurant'] as const) {
      const customer = profiles[time - orderTimes[merchant]]
      if (!customer) continue
      const canSell = profiles.every((profile, index) =>
        profile.job.building !== merchant || residents[index].activity === 'work')
      if (canSell) CityEconomy.sell(economy, merchant, minute, customer.id)
    }
  }

  /** Walks a minute along the route, stopping precisely at the final entrance. */
  private walk(resident: ResidentState) {
    let budget = walkingSpeed
    while (budget > 0 && resident.remaining.length) {
      const target = resident.remaining[0]
      const dx = target.x - resident.position.x
      const dy = target.y - resident.position.y
      const distance = Math.hypot(dx, dy)
      if (distance <= budget) {
        resident.position = { ...target }
        resident.remaining.shift()
        budget -= distance
      } else {
        resident.position.x += dx / distance * budget
        resident.position.y += dy / distance * budget
        budget = 0
      }
    }
  }

  /** Publishes a transition and retains a bounded history for the console. */
  private change(resident: ResidentState, activity: Activity) {
    resident.activity = activity
    this.state.events.push({ minute: this.state.minute, resident: resident.id, activity })
    if (this.state.events.length > 100) this.state.events.shift()
  }
}
