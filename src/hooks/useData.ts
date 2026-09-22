import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Service, AddOn, GalleryItem, Review, BusinessSettings, PricingClass } from '../lib/types'

export function useServices() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.from('services').select('*').eq('active', true).order('display_order')
      .then(({ data }) => { setServices(data || []); setLoading(false) })
  }, [])
  return { services, loading }
}

export function useAddOns(serviceIds: string[]) {
  const [addOns, setAddOns] = useState<AddOn[]>([])
  useEffect(() => {
    if (serviceIds.length === 0) { setAddOns([]); return }
    // Fetch service-specific add-ons (by service_id) plus "always" add-ons (service_id IS NULL)
    supabase.from('add_ons').select('*').or(`service_id.in.(${serviceIds.join(',')}),service_id.is.null`)
      .then(({ data }) => setAddOns(data || []))
  }, [serviceIds.join(',')])
  return { addOns }
}

export function usePricingForServices(serviceSlugs: string[], pricingClass: PricingClass | null) {
  const [rules, setRules] = useState<{ service: string; base_price: number; duration: number; front_windshield_price: number; rear_glass_price: number; side_window_price: number; windshield_brow_price: number; interior_price: number; exterior_price: number }[]>([])
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (serviceSlugs.length === 0 || !pricingClass) { setRules([]); return }
    setLoading(true)
    supabase.from('pricing_rules').select('service,base_price,duration,front_windshield_price,rear_glass_price,side_window_price,windshield_brow_price,interior_price,exterior_price')
      .in('service', serviceSlugs).eq('pricing_class', pricingClass)
      .then(({ data }) => { setRules(data || []); setLoading(false) })
  }, [serviceSlugs.join(','), pricingClass])
  return { rules, loading }
}

export function useFeaturedGallery(limit = 6) {
  const [items, setItems] = useState<GalleryItem[]>([])
  useEffect(() => {
    supabase.from('gallery').select('*').eq('featured', true).limit(limit)
      .then(({ data }) => setItems(data || []))
  }, [limit])
  return { items }
}

export function useFeaturedReviews(limit = 4) {
  const [reviews, setReviews] = useState<Review[]>([])
  useEffect(() => {
    supabase.from('reviews').select('*').eq('featured', true).order('created_at', { ascending: false }).limit(limit)
      .then(({ data }) => setReviews(data || []))
  }, [limit])
  return { reviews }
}

export function useStartingPrices(serviceSlugs: string[]) {
  const [prices, setPrices] = useState<Record<string, number>>({})
  useEffect(() => {
    if (serviceSlugs.length === 0) return
    supabase.from('pricing_rules').select('service,base_price').in('service', serviceSlugs)
      .then(({ data }) => {
        const map: Record<string, number> = {}
        for (const r of data || []) {
          if (r.base_price > 0 && (!map[r.service] || r.base_price < map[r.service])) {
            map[r.service] = r.base_price
          }
        }
        setPrices(map)
      })
  }, [serviceSlugs.join(',')])
  return { prices }
}

export function useBusinessSettings() {
  const [settings, setSettings] = useState<BusinessSettings | null>(null)
  useEffect(() => {
    supabase.from('business_settings').select('*').eq('id', 1).maybeSingle()
      .then(({ data }) => setSettings(data as BusinessSettings | null))
  }, [])
  return { settings }
}
