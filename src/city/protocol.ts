import type { CityState, SavedCityState } from './simulation.ts'

export type CityCommand =
  | { type: 'open'; key?: string; visible: boolean }
  | { type: 'run'; running: boolean }
  | { type: 'step' }
  | { type: 'speed'; value: number }
  | { type: 'visible'; visible: boolean }
export type CityFrame = { state: CityState; running: boolean; speed: number; save: 'ready' | 'saved' | 'restored' | 'unavailable' }
export type CityCheckpoint = { version: 1; state: SavedCityState; running: boolean; speed: number }
