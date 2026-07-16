export type Color = {
  hue: number // 0-360
  saturation: number // 0-100
  lightness: number // 0-100
  name?: string // display name for this step (e.g. "10", "20"); falls back to a step-of-10 default
  locked?: boolean // when true, this color's points on the H/S/L curves can be selected but not moved
}

export type Curve = {
  id: string
  name: string
  type: 'hue' | 'saturation' | 'lightness'
  values: number[]
}

export type Scale = {
  id: string
  name: string
  colors: Color[]
  curves: Partial<Record<Curve['type'], string>>
}

export type Palette = {
  id: string
  name: string
  backgroundColor: string
  scales: Record<string, Scale>
  curves: Record<string, Curve>
}
