export type VehicleClass = 'coupe' | 'sedan' | 'suv' | 'jeep' | 'truck' | 'van'
export type PricingClass = 'sedan' | 'coupe' | 'mid_suv' | 'large_suv' | 'truck' | 'van'
export type ServiceSlug = 'window_tint' | 'detailing' | 'quote'
export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
export type PaymentStatus = 'pending' | 'completed' | 'refunded' | 'failed'

export interface Service {
  id: string; name: string; slug: string; description: string | null; active: boolean; display_order: number
}

export type AddOnVisibility = 'service' | 'qualifying' | 'always'

export interface AddOn {
  id: string; service_id: string | null; name: string; price: number; description: string | null; required: boolean; per_unit_label: string | null; visibility: AddOnVisibility
}
export interface VehicleMapping {
  id: string; make: string; model: string; trim: string | null; pricing_class: PricingClass; body_style: string | null
}
export interface PricingRule {
  id: string; service: string; pricing_class: PricingClass; base_price: number; duration: number
  front_windshield_price: number; rear_glass_price: number; side_window_price: number
  windshield_brow_price: number
  interior_price: number; exterior_price: number
}
export interface Customer {
  id: string; first_name: string; last_name: string | null; email: string | null; phone: string; created_at: string
}
export interface Vehicle {
  id: string; customer_id: string | null; year: number; make: string; model: string
  trim: string | null; vehicle_class: VehicleClass; body_style: string | null; vin: string | null; notes: string | null
}
export interface Appointment {
  id: string; customer_id: string; vehicle_id: string; package_id: string | null
  services: { id: string; slug: string; name: string; base_price: number }[]
  appointment_date: string | null; status: AppointmentStatus; deposit_paid: boolean
  balance_due: number; total_price: number; deposit_amount: number
  assigned_bay: number | null; add_ons: { id: string; name: string; price: number }[]
  notes: string | null; google_event_id: string | null; created_at: string
}
export interface Payment {
  id: string; appointment_id: string; square_payment_id: string | null
  amount: number; status: PaymentStatus; created_at: string
}
export interface GalleryItem {
  id: string; image: string; category: string; featured: boolean; caption: string | null
}
export interface Review {
  id: string; customer_name: string; vehicle: string | null; rating: number
  review: string; featured: boolean; approved: boolean; created_at: string
}
export interface ReviewToken {
  id: string; appointment_id: string | null; customer_name: string
  vehicle: string; customer_email: string; used: boolean; created_at: string
}
export interface BusinessSettings {
  id: number; business_name: string; phone: string; email: string; address: string; maps_url: string | null
  hours_monday: string; hours_tuesday: string; hours_wednesday: string; hours_thursday: string
  hours_friday: string; hours_saturday: string; hours_sunday: string
  buffer_minutes: number; bays: number; square_location_id: string | null; deposit_percentage: number
  deposit_type: 'percentage' | 'flat'; flat_deposit_amount: number
  facebook_url: string | null; instagram_url: string | null
  facebook_visible: boolean; instagram_visible: boolean
  port_window_price: number
}
