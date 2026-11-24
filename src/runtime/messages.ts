import type { GenerationMetrics } from '../experiments.ts'
import type { EventType, FoodSupply, Kind, Point, WorldSnapshot, WorldView } from '../simulation.ts'

export type JournalEntry = {
  message: string
  type: EventType
  participants: readonly number[]
  timestamp: number
}

export type Checkpoint = {
  version: 1
  world: WorldSnapshot
  running: boolean
  journal: JournalEntry[]
  savedAt: number
}

export type Command =
  | { type: 'init'; key: string; visible: boolean }
  | { type: 'running'; value: boolean }
  | { type: 'visibility'; visible: boolean }
  | { type: 'restart'; seed: number; supply: FoodSupply }
  | { type: 'place'; tool: Kind | 'food' | 'obstacle'; point: Point }
  | { type: 'compare'; seed: number }
  | { type: 'clear' }
  | { type: 'ack' }

export type WorkerUpdate =
  | { type: 'frame'; world: WorldView; running: boolean; selected?: number | null; journal?: JournalEntry[] }
  | { type: 'storage'; state: 'restored' | 'saved' | 'unavailable'; timestamp?: number }
  | { type: 'comparison'; seed: number; results?: { supply: FoodSupply; generations: Map<number, GenerationMetrics> }[] }
