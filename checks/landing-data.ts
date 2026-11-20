// Reads a LANDLOG directory written by checks/ladder-robots.ts.
import { readdirSync, readFileSync } from 'node:fs';

export interface LoggedLanding { impact: number; slope: number; outcome: string; airTime: number; fromLip: boolean }
export interface LoggedRide { challenge: string; bike: string; fit: string; style: string; kit: unknown; ok: boolean; stars: number; t: number; points: number; landings: LoggedLanding[] }

export function readLog(dir: string): LoggedRide[] {
  return readdirSync(dir).filter((f) => f.endsWith('.jsonl')).flatMap((f) =>
    readFileSync(`${dir}/${f}`, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as LoggedRide));
}
