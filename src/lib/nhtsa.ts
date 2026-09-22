import { supabase } from './supabase'
import type { PricingClass, VehicleClass } from './types'

const NHTSA = 'https://vpic.nhtsa.dot.gov/api/vehicles'

async function nhtsaFetch(path: string): Promise<any> {
  const r = await fetch(`${NHTSA}${path}`)
  if (!r.ok) throw new Error(`NHTSA ${r.status}`)
  return r.json()
}

export async function getYears(): Promise<number[]> {
  const now = new Date().getFullYear()
  return Array.from({ length: now - 1989 }, (_, i) => now + 1 - i)
}

export async function getMakes(year: number): Promise<string[]> {
  const key = `makes_${year}`
  const { data: cached } = await supabase.from('vehicle_cache').select('value').eq('key', key).maybeSingle()
  if (cached) return cached.value as string[]
  try {
    const json = await nhtsaFetch(`/GetAllMakes?format=json`)
    const makes: string[] = Array.from(new Set(
      (json.Results || []).map((r: any) => r.Make_Name as string).filter(Boolean).sort()
    ))
    await supabase.from('vehicle_cache').upsert({ key, value: makes })
    return makes
  } catch { return [] }
}

export async function getModels(year: number, make: string): Promise<string[]> {
  const key = `models_${year}_${make.toLowerCase().replace(/\s+/g, '_')}`
  const { data: cached } = await supabase.from('vehicle_cache').select('value').eq('key', key).maybeSingle()
  if (cached) return cached.value as string[]
  try {
    const json = await nhtsaFetch(`/GetModelsForMakeYear/make/${encodeURIComponent(make)}/modelyear/${year}?format=json`)
    const models: string[] = Array.from(new Set(
      (json.Results || []).map((r: any) => r.Model_Name as string).filter(Boolean).sort()
    ))
    await supabase.from('vehicle_cache').upsert({ key, value: models })
    return models
  } catch { return [] }
}

export async function getTrims(year: number, make: string, model: string): Promise<string[]> {
  const key = `trims_${year}_${make.toLowerCase().replace(/\s+/g, '_')}_${model.toLowerCase().replace(/\s+/g, '_')}`
  const { data: cached } = await supabase.from('vehicle_cache').select('value').eq('key', key).maybeSingle()
  if (cached) return cached.value as string[]
  try {
    const json = await nhtsaFetch(`/GetVariableValuesForModelYear/modelyear/${year}/make/${encodeURIComponent(make)}/model/${encodeURIComponent(model)}?format=json`)
    const trims: string[] = Array.from(new Set(
      (json.Results || []).map((r: any) => r.ElementName as string).filter((t: string) => t && t !== model)
    ))
    await supabase.from('vehicle_cache').upsert({ key, value: trims })
    return trims
  } catch { return [] }
}

export async function mapVehicleToPricingClass(
  make: string, model: string, trim?: string
): Promise<{ pricing_class: PricingClass; body_style: string | null } | null> {
  if (trim) {
    const { data } = await supabase.from('vehicle_mappings').select('pricing_class,body_style')
      .eq('make', make).eq('model', model).eq('trim', trim).maybeSingle()
    if (data) return data as { pricing_class: PricingClass; body_style: string | null }
  }
  const { data } = await supabase.from('vehicle_mappings').select('pricing_class,body_style')
    .eq('make', make).eq('model', model).is('trim', null).maybeSingle()
  return data as { pricing_class: PricingClass; body_style: string | null } | null
}

export const classFromVehicleClass = (vc: VehicleClass): PricingClass => {
  const m: { [k in VehicleClass]: PricingClass } = {
    coupe: 'coupe', sedan: 'sedan', suv: 'mid_suv', jeep: 'mid_suv', truck: 'truck', van: 'van'
  }
  return m[vc]
}
