import type { Location } from '../types'

export interface Point {
  x: string
  y: string
}

export const LOCATION_POS: Record<Location, Point> = {
  shop:    { x: '11%', y: '15%' },
  portal:  { x: '11%', y: '72%' },
  gate:    { x: '50%', y: '18%' },
  cell:    { x: '76%', y: '16%' },
  cell2:   { x: '88%', y: '16%' },
  yard:    { x: '68%', y: '48%' },
  library: { x: '90%', y: '72%' },
  tunnel:  { x: '76%', y: '16%' },
}

export const DROPBOX_POS: Point = { x: '52%', y: '24%' }

const OFFSETS = [
  { dx: 0, dy: 0 },
  { dx: 5, dy: 0 },
  { dx: -5, dy: 0 },
  { dx: 0, dy: 5 },
]

export function offsetPos(base: Point, index: number): Point {
  const o = OFFSETS[index % OFFSETS.length]
  return {
    x: `calc(${base.x} + ${o.dx}%)`,
    y: `calc(${base.y} + ${o.dy}%)`,
  }
}
