import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useServices, useStartingPrices, useBusinessSettings, usePricingForServices, useAddOns } from '../hooks/useData'
import { classFromVehicleClass } from '../lib/nhtsa'
import { formatPrice } from '../lib/format'
import SquarePayment from '../components/SquarePayment'
import tintOptionsImage from '../../public/images/London_tint_options.png'
import type { Service, AddOn, VehicleClass, PricingClass, BusinessSettings } from '../lib/types'

interface SelectedService extends Service {
  base_price: number
  duration: number
}

interface State {
  selectedServices: Service[]
  selectedAddOns: AddOn[]
  addOnQuantities: Record<string, number>
  vehicleClass: VehicleClass | null
  year: string; make: string; model: string
  pricingClass: PricingClass | null
  customer: { first_name: string; last_name: string; email: string; phone: string }
  appointmentId: string | null
  tintScope: {
    windshield: 'none' | 'brow' | 'full' | 'brow_full' | null
    rear: boolean | null
    sideCount: number | null
    portCount: number | null
  }
  tintRemoval: 'yes' | 'no' | null
  detailScope: { interior: boolean; exterior: boolean }
}

const vehicleClassOptions: { value: VehicleClass; label: string; icon: string }[] = [
  { value: 'coupe', label: 'Coupe', icon: 'M4 9l1.5-3h13L20 9m-16 0h16v8H4V9zm0 0v8m16-8v8M7 17v2m10-2v2' },
  { value: 'sedan', label: 'Sedan', icon: 'M5 11l1.5-4.5h11L19 11M5 11h14v5H5v-5zm0 0v5m14-5v5M7 16v2m10-2v2' },
  { value: 'suv', label: 'SUV', icon: 'M3 13l2-6h14l2 6v5H3v-5zm0 0h18M6 18v2m12-2v2' },
  { value: 'jeep', label: 'Jeep', icon: 'M3 17V8h2l1-3h12l1 3h2v9m-18 0h18M3 17v2m18-2v2M7 8v9m6-9v9m-9 0h18' },
  { value: 'truck', label: 'Truck', icon: 'M3 17V8h12v9m0 0h6V11h-6m-6 6v2m-4-2v2M4 8l1-3h8l1 3' },
  { value: 'van', label: 'Van', icon: 'M3 17V7a1 1 0 011-1h12a1 1 0 011 1v10m0 0h4v-7l-3-3h-1M3 17v2m16-2v2M7 7v10m4-10v10' },
]

const steps = [
  { n: 1, label: 'Vehicle' }, { n: 2, label: 'Services' }, { n: 3, label: 'Deposit' },
]

const STORAGE_KEY = 'booking_progress_v3'
const LEGACY_STORAGE_KEYS = ['booking_progress', 'booking_progress_v2']
const defaultState: State = {
  selectedServices: [], selectedAddOns: [], addOnQuantities: {}, vehicleClass: null, year: '', make: '', model: '',
  pricingClass: null,
  customer: { first_name: '', last_name: '', email: '', phone: '' },
  appointmentId: null,
  tintScope: { windshield: null, rear: null, sideCount: null, portCount: null },
  tintRemoval: null,
  detailScope: { interior: false, exterior: false },
}

function loadSavedBooking(): { state: State; step: number } | null {
  try {
    for (const key of LEGACY_STORAGE_KEYS) localStorage.removeItem(key)
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data.state || typeof data.step !== 'number') return null
    const savedState = data.state as Partial<State>
    const vehicleClass = savedState.vehicleClass ?? null
    data.state = {
      ...defaultState,
      ...savedState,
      vehicleClass,
      pricingClass: vehicleClass ? classFromVehicleClass(vehicleClass) : null,
      appointmentId: null,
    }
    return data
  } catch { return null }
}

function clearSavedBooking() {
  try { localStorage.removeItem(STORAGE_KEY) } catch {}
}

export default function Booking() {
  const { serviceSlug } = useParams()
  const { services, loading: svcLoading } = useServices()
  const { settings } = useBusinessSettings()
  const [saved] = useState(() => loadSavedBooking())
  const [restored, setRestored] = useState(() => !!saved)
  const [step, setStep] = useState(saved?.step ?? 1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [state, setState] = useState<State>(saved?.state ?? defaultState)

  const serviceIds = useMemo(() => state.selectedServices.map((s) => s.id), [state.selectedServices])
  const { addOns } = useAddOns(serviceIds)

  // Fetch pricing rules for ALL services for the selected vehicle class, so we can show
  // accurate per-vehicle prices on every service card — not just the ones already selected.
  const allSlugs = useMemo(() => services.map((s) => s.slug), [services])
  const { rules, loading: rulesLoading } = usePricingForServices(allSlugs, state.pricingClass)

  // Map of service slug → pricing rule for the current vehicle class
  const priceMap = useMemo(() => {
    const m: Record<string, { base_price: number; duration: number; front_windshield_price: number; rear_glass_price: number; side_window_price: number; windshield_brow_price: number; interior_price: number; exterior_price: number }> = {}
    for (const r of rules) m[r.service] = { base_price: r.base_price, duration: r.duration, front_windshield_price: r.front_windshield_price, rear_glass_price: r.rear_glass_price, side_window_price: r.side_window_price, windshield_brow_price: r.windshield_brow_price, interior_price: r.interior_price, exterior_price: r.exterior_price }
    return m
  }, [rules])

  // Pre-select a service when arriving via a deep link, but keep the customer on the Vehicle
  // step so pricing is known before they confirm anything.
  useEffect(() => {
    if (services.length > 0 && serviceSlug && serviceSlug !== 'quote' && state.selectedServices.length === 0) {
      const svc = services.find((s) => s.slug === serviceSlug)
      if (svc) setState((p) => ({ ...p, selectedServices: [svc] }))
    }
  }, [services, serviceSlug])

  const update = (p: Partial<State>) => setState((prev) => ({ ...prev, ...p }))

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, step })) } catch {}
  }, [state, step])

  const resetBooking = () => {
    clearSavedBooking()
    setState(defaultState)
    setStep(1)
    setRestored(false)
    setError(null)
  }

  const handleBookingComplete = () => {
    clearSavedBooking()
    setRestored(false)
  }

  const resolvedServices: SelectedService[] = useMemo(() => {
    if (!state.pricingClass) return []
    return state.selectedServices
      .map((s) => {
        const rule = priceMap[s.slug]
        if (!rule) return null
        return { ...s, base_price: rule.base_price, duration: rule.duration }
      })
      .filter((x): x is SelectedService => x !== null)
  }, [state.selectedServices, priceMap, state.pricingClass])

  const addOnsTotal = state.selectedAddOns.reduce((sum, a) => sum + a.price * (a.per_unit_label ? (state.addOnQuantities[a.id] || 1) : 1), 0)
  const hasTint = state.selectedServices.some((s: Service) => s.slug === 'window_tint')
  const tintRule = priceMap['window_tint']
  const portWindowPrice = settings?.port_window_price ?? 2500
  const tintScopePrice = hasTint && tintRule
    ? (state.tintScope.windshield === 'full' ? tintRule.front_windshield_price : 0)
      + (state.tintScope.windshield === 'brow' ? tintRule.windshield_brow_price : 0)
      + (state.tintScope.windshield === 'brow_full' ? tintRule.front_windshield_price + tintRule.windshield_brow_price : 0)
      + (state.tintScope.rear === true ? tintRule.rear_glass_price : 0)
      + (state.tintScope.sideCount != null && state.tintScope.sideCount > 0 ? tintRule.side_window_price * state.tintScope.sideCount : 0)
      + (state.tintScope.portCount != null && state.tintScope.portCount > 0 ? portWindowPrice * state.tintScope.portCount : 0)
    : 0
  const hasDetailing = state.selectedServices.some((s: Service) => s.slug === 'detailing')
  const detailRule = priceMap['detailing']
  const detailScopePrice = hasDetailing && detailRule
    ? (state.detailScope.interior ? detailRule.interior_price : 0)
      + (state.detailScope.exterior ? detailRule.exterior_price : 0)
    : 0
  const totalPrice = resolvedServices.reduce((sum, s) => sum + (s.slug === 'window_tint' ? 0 : s.base_price), 0) + addOnsTotal + tintScopePrice + detailScopePrice
  const depositAmount = settings?.deposit_type === 'flat'
    ? (settings.flat_deposit_amount || 0)
    : (totalPrice > 0 ? Math.round(totalPrice * ((settings?.deposit_percentage || 20) / 100)) : 0)
  const balanceDue = Math.max(0, totalPrice - depositAmount)

  if (serviceSlug === 'quote') {
    return <QuoteForm />
  }

  return (
    <div className="pt-16 md:pt-20 min-h-screen bg-grain">
      {/* Progress */}
      <div className="sticky top-16 md:top-20 z-30 bg-brand-black/95 backdrop-blur-md border-b border-brand-border">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-1">
            {steps.map((s) => (
              <div key={s.n} className="flex-1 flex flex-col items-center gap-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  step > s.n ? 'bg-brand-blue text-white' : step === s.n ? 'bg-brand-blue text-white animate-blue-pulse' : 'bg-brand-muted text-brand-silver-dark border border-brand-border'
                }`}>{step > s.n ? '✓' : s.n}</div>
                <span className={`text-[10px] font-badge tracking-wider uppercase ${step >= s.n ? 'text-brand-blue' : 'text-brand-silver-dark'}`}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 md:py-12">
        {error && (
          <div className="mb-6 p-4 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}<button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
          </div>
        )}

        {restored && (step > 1 || state.selectedServices.length > 0 || state.vehicleClass || state.make) && (
          <div className="mb-6 p-3 rounded-md bg-brand-blue/10 border border-brand-blue/30 flex items-center justify-between gap-3 animate-fade-in">
            <p className="text-sm text-brand-silver">Welcome back — we've saved your booking progress.</p>
            <button onClick={resetBooking} className="text-sm text-brand-blue hover:text-white underline whitespace-nowrap">Start over</button>
          </div>
        )}

        {step === 1 && <Step1Vehicle state={state} update={update} setStep={setStep} preselectedName={state.selectedServices[0]?.name} />}
        {step === 2 && <Step2Services services={services} loading={svcLoading} state={state} update={update} setStep={setStep} addOns={addOns} priceMap={priceMap} rulesLoading={rulesLoading} resolvedServices={resolvedServices} totalPrice={totalPrice} depositAmount={depositAmount} settings={settings} />}
        {step === 3 && <Step3Deposit state={state} totalPrice={totalPrice} depositAmount={depositAmount} balanceDue={balanceDue} settings={settings} update={update} submitting={submitting} setSubmitting={setSubmitting} setError={setError} setStep={setStep} onComplete={handleBookingComplete} />}
      </div>
    </div>
  )
}

// ── Quote Request Form ──
function QuoteForm() {
  const { services } = useServices()
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', year: '', make: '', model: '', description: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const submit = async () => {
    setSubmitting(true); setError(null)

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(form.email)) {
      setError('Please enter a valid email address.')
      setSubmitting(false)
      return
    }
    const phoneDigits = form.phone.replace(/\D/g, '')
    if (phoneDigits.length < 10) {
      setError('Please enter a valid phone number (at least 10 digits).')
      setSubmitting(false)
      return
    }
    const yearNum = Number(form.year)
    if (!form.year.trim() || isNaN(yearNum) || yearNum < 1900 || yearNum > new Date().getFullYear() + 2) {
      setError('Please enter a valid vehicle year.')
      setSubmitting(false)
      return
    }

    try {
      const quoteService = services.find((s) => s.slug === 'quote')
      const { data: quoteId, error: rpcError } = await supabase.rpc('create_quote_request', {
        p_first_name: form.first_name,
        p_last_name: form.last_name || '',
        p_email: form.email,
        p_phone: form.phone,
        p_year: Number(form.year),
        p_make: form.make,
        p_model: form.model,
        p_description: form.description,
        p_service_id: quoteService?.id || '',
        p_service_slug: quoteService?.slug || 'quote',
        p_service_name: quoteService?.name || 'Quote Request',
      })
      if (rpcError) throw rpcError
      // Notify admin — fire and forget
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'new_quote_notification',
          payload: {
            customer_name: `${form.first_name} ${form.last_name || ''}`.trim(),
            customer_phone: form.phone,
            customer_email: form.email,
            vehicle: `${form.year} ${form.make} ${form.model}`.trim(),
            description: form.description,
            site_url: window.location.origin,
          },
        }),
      }).catch(() => {})
      // Send customer quote confirmation email — fire and forget
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'quote_confirmation',
          payload: {
            customer_name: `${form.first_name} ${form.last_name || ''}`.trim(),
            customer_email: form.email,
            vehicle: `${form.year} ${form.make} ${form.model}`.trim(),
            description: form.description,
          },
        }),
      }).catch(() => {})
      setSubmitted(true)
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = form.first_name.trim() && form.phone.trim() && form.email.trim() && form.year.trim() && form.make.trim() && form.model.trim() && form.description.trim()

  if (submitted) {
    return (
      <div className="pt-16 md:pt-20 min-h-screen bg-grain flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center animate-slide-up">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-brand-blue/20 flex items-center justify-center">
            <svg className="w-10 h-10 text-brand-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <h1 className="font-display text-3xl tracking-wide text-white uppercase mb-3">Quote Request Received</h1>
          <p className="text-brand-silver mb-8">We'll reach out personally with your quote — usually within 1 business day.</p>
          <a href="/" className="btn-primary">Back to Home</a>
        </div>
      </div>
    )
  }

  return (
    <div className="pt-16 md:pt-20 min-h-screen bg-grain">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 md:py-12 animate-slide-up">
        <h1 className="font-display text-3xl md:text-4xl tracking-wide text-white uppercase mb-2">Request a Quote</h1>
        <p className="text-brand-silver mb-8">Tell us about your vehicle and what you're looking for. We'll follow up personally with a custom quote — no automated pricing, no surprises.</p>

        {error && (
          <div className="mb-6 p-4 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}<button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
          </div>
        )}

        <div className="space-y-6">
          {/* Contact Info */}
          <div className="card p-6 bg-card-gradient space-y-4">
            <h2 className="text-white font-semibold">Your Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-brand-silver mb-2">First Name <span className="text-brand-blue">*</span></label>
                <input className="input" placeholder="Jane" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm text-brand-silver mb-2">Last Name <span className="text-brand-silver-dark">(optional)</span></label>
                <input className="input" placeholder="Smith" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm text-brand-silver mb-2">Phone <span className="text-brand-blue">*</span></label>
                <input type="tel" className="input" placeholder="(519) 555-0100" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm text-brand-silver mb-2">Email <span className="text-brand-blue">*</span></label>
                <input type="email" className="input" placeholder="you@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
          </div>

          {/* Vehicle Info */}
          <div className="card p-6 bg-card-gradient space-y-4">
            <h2 className="text-white font-semibold">Your Vehicle</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-brand-silver mb-2">Year <span className="text-brand-blue">*</span></label>
                <input className="input" inputMode="numeric" placeholder="2021" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm text-brand-silver mb-2">Make <span className="text-brand-blue">*</span></label>
                <input className="input" placeholder="Toyota" value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm text-brand-silver mb-2">Model <span className="text-brand-blue">*</span></label>
                <input className="input" placeholder="Camry" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="card p-6 bg-card-gradient space-y-4">
            <h2 className="text-white font-semibold">What Are You Looking For? <span className="text-brand-blue">*</span></h2>
            <textarea
              className="input resize-none"
              rows={5}
              placeholder="Describe what you'd like quoted — e.g. full window tint, ceramic coating, paint correction, or anything else on your mind."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <button onClick={submit} className="btn-primary w-full" disabled={submitting || !canSubmit}>
            {submitting ? 'Sending…' : 'Send Quote Request'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Wrap({ title, subtitle, children, onBack }: { title: string; subtitle: string; children: React.ReactNode; onBack?: () => void }) {
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }) }, [])
  return (
    <div className="animate-slide-up">
      {onBack && (
        <button onClick={onBack} className="btn-ghost mb-5 -ml-1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" /></svg> Back
        </button>
      )}
      <h1 className="font-display text-3xl md:text-4xl tracking-wide text-white uppercase mb-2">{title}</h1>
      <p className="text-brand-silver mb-8">{subtitle}</p>
      {children}
    </div>
  )
}

function Spinner() {
  return <div className="flex items-center justify-center py-12"><div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" /></div>
}

// ── Step 1: Vehicle ──
function Step1Vehicle({ state, update, setStep, preselectedName }: {
  state: State
  update: (p: Partial<State>) => void
  setStep: (n: number) => void
  preselectedName?: string
}) {
  const onClass = (vc: VehicleClass) => {
    const pc = classFromVehicleClass(vc)
    update({ vehicleClass: vc, pricingClass: pc })
  }

  const yearNum = Number(state.year)
  const yearValid = state.year.trim() !== '' && !isNaN(yearNum) && yearNum >= 1900 && yearNum <= new Date().getFullYear() + 2
  const canContinue = !!state.vehicleClass && yearValid && state.make.trim() !== '' && state.model.trim() !== ''

  return (
    <Wrap title="What Are You Driving?" subtitle="Tell us about your vehicle first so we can show you accurate pricing for your specific vehicle class.">
      {preselectedName && (
        <div className="card p-4 mb-6 bg-brand-blue/5 border-brand-blue/30 animate-fade-in">
          <p className="text-sm text-brand-silver">
            <span className="text-brand-blue font-semibold">{preselectedName}</span> is pre-selected for you — you'll confirm it on the next step.
          </p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
        {vehicleClassOptions.map((opt) => (
          <button key={opt.value} onClick={() => onClass(opt.value)}
            className={`card card-hover p-6 flex flex-col items-center gap-3 ${state.vehicleClass === opt.value ? 'border-brand-blue bg-brand-blue/5' : 'bg-card-gradient'}`}>
            <svg className="w-10 h-10 text-brand-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d={opt.icon} strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span className="text-white font-badge font-semibold tracking-wider uppercase">{opt.label}</span>
          </button>
        ))}
      </div>

      <div className="card p-6 mb-6 space-y-4 bg-card-gradient">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-brand-silver mb-2">Year <span className="text-brand-blue">*</span></label>
            <input className="input" inputMode="numeric" placeholder="2021" value={state.year} onChange={(e) => update({ year: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm text-brand-silver mb-2">Make <span className="text-brand-blue">*</span></label>
            <input className="input" placeholder="Toyota" value={state.make} onChange={(e) => update({ make: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm text-brand-silver mb-2">Model <span className="text-brand-blue">*</span></label>
            <input className="input" placeholder="Camry" value={state.model} onChange={(e) => update({ model: e.target.value })} />
          </div>
        </div>
      </div>

      <button onClick={() => setStep(2)} className="btn-primary w-full" disabled={!canContinue}>
        {canContinue ? 'Continue to Services' : 'Select a vehicle class and enter your details'}
      </button>
    </Wrap>
  )
}

// ── Step 2: Services ──
function AddOnRow({ a, sel, svc, qty, onToggle, onQty, radio }: { a: AddOn; sel: boolean; svc?: Service; qty?: number; onToggle: () => void; onQty?: (n: number) => void; radio?: boolean }) {
  const perUnit = a.per_unit_label
  const count = qty || 1
  return (
    <div className={`w-full rounded-md border transition-all ${sel ? 'border-brand-blue bg-brand-blue/5' : 'border-brand-border bg-brand-muted/30'}`}>
      <button onClick={onToggle} className="w-full p-4 text-left hover:bg-white/[0.02] transition-colors">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-white font-medium text-sm">{a.name}</span>
              {svc && <span className="text-[10px] text-brand-silver-dark uppercase tracking-wider">{svc.name}</span>}
            </div>
            {a.description && <p className="text-brand-silver text-xs mt-0.5">{a.description}</p>}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-brand-blue font-bold text-sm">
              {a.price === 0 ? 'Included' : perUnit ? `+${formatPrice(a.price)} / ${perUnit}` : `+${formatPrice(a.price)}`}
            </span>
            {radio ? (
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${sel ? 'border-brand-blue' : 'border-brand-border'}`}>
                {sel && <span className="w-2.5 h-2.5 rounded-full bg-brand-blue" />}
              </div>
            ) : (
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${sel ? 'bg-brand-blue border-brand-blue' : 'border-brand-border'}`}>
                {sel && <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              </div>
            )}
          </div>
        </div>
      </button>
      {sel && perUnit && onQty && (
        <div className="px-4 pb-4 pt-1 border-t border-brand-blue/20">
          <p className="text-xs text-brand-silver mb-3">How many {perUnit}s need removal?</p>
          <div className="flex items-center gap-4">
            <div className="flex items-center rounded-md border border-brand-border overflow-hidden">
              <button onClick={(e) => { e.stopPropagation(); onQty(Math.max(1, count - 1)) }}
                className="w-10 h-10 flex items-center justify-center text-brand-silver hover:text-white hover:bg-brand-muted transition-colors text-lg font-bold">−</button>
              <span className="px-4 text-white font-semibold text-sm min-w-[3rem] text-center">{count}</span>
              <button onClick={(e) => { e.stopPropagation(); onQty(Math.min(20, count + 1)) }}
                className="w-10 h-10 flex items-center justify-center text-brand-silver hover:text-white hover:bg-brand-muted transition-colors text-lg font-bold">+</button>
            </div>
            <span className="text-brand-silver text-sm">{count} {perUnit}{count > 1 ? 's' : ''} = <span className="text-brand-blue font-semibold">{formatPrice(a.price * count)}</span></span>
          </div>
        </div>
      )}
    </div>
  )
}

function Step2Services({ services, loading, state, update, setStep, addOns, priceMap, rulesLoading, resolvedServices, totalPrice, depositAmount, settings }: {
  services: Service[]
  loading: boolean
  state: State
  update: (p: Partial<State>) => void
  setStep: (n: number) => void
  addOns: AddOn[]
  priceMap: Record<string, { base_price: number; duration: number; front_windshield_price: number; rear_glass_price: number; side_window_price: number; windshield_brow_price: number; interior_price: number; exterior_price: number }>
  rulesLoading: boolean
  resolvedServices: SelectedService[]
  totalPrice: number
  depositAmount: number
  settings: BusinessSettings | null
}) {
  const slugs = useMemo(() => services.map((s) => s.slug), [services])
  const { prices: startingPrices } = useStartingPrices(slugs)
  const [tintMapOpen, setTintMapOpen] = useState(false)

  useEffect(() => {
    if (tintMapOpen) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [tintMapOpen])

  const TintHelpIcon = () => (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); setTintMapOpen(true) }}
      className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-brand-border text-brand-silver hover:text-brand-blue hover:border-brand-blue transition-colors text-xs font-bold flex-shrink-0"
      aria-label="View tint map reference"
    >?</button>
  )

  const toggle = (s: Service) => {
    const exists = state.selectedServices.find((x: Service) => x.id === s.id)
    const nextServices = exists
      ? state.selectedServices.filter((x: Service) => x.id !== s.id)
      : [...state.selectedServices, s]
    const activeServiceIds = new Set(nextServices.map((x: Service) => x.id))
    const patch: Partial<State> = {
      selectedServices: nextServices,
      selectedAddOns: state.selectedAddOns.filter((a: AddOn) => a.visibility === 'always' || (a.service_id && activeServiceIds.has(a.service_id))),
    }
    if (exists && s.slug === 'window_tint') {
      patch.tintScope = { windshield: null, rear: null, sideCount: null, portCount: null }
      patch.tintRemoval = null
    }
    if (exists && s.slug === 'detailing') {
      patch.detailScope = { interior: false, exterior: false }
    }
    update(patch)
  }

  const toggleAddOn = (a: AddOn, exclusive = false) => {
    const exists = state.selectedAddOns.find((x: AddOn) => x.id === a.id)
    if (exists) {
      if (exclusive) return
      const { [a.id]: _, ...rest } = state.addOnQuantities
      update({ selectedAddOns: state.selectedAddOns.filter((x: AddOn) => x.id !== a.id), addOnQuantities: rest })
    } else {
      let nextAddOns = [...state.selectedAddOns, a]
      let nextQty = a.per_unit_label ? { ...state.addOnQuantities, [a.id]: 1 } : state.addOnQuantities
      if (exclusive) {
        const removed = nextAddOns.filter((x: AddOn) => x.service_id === a.service_id && x.required && x.id !== a.id)
        if (removed.length > 0) {
          const removedIds = new Set(removed.map((x: AddOn) => x.id))
          nextAddOns = nextAddOns.filter((x: AddOn) => !removedIds.has(x.id))
          const cleanedQty: Record<string, number> = {}
          for (const [k, v] of Object.entries(nextQty)) { if (!removedIds.has(k)) cleanedQty[k] = v as number }
          nextQty = cleanedQty
        }
      }
      update({ selectedAddOns: nextAddOns, addOnQuantities: nextQty })
    }
  }

  const setAddOnQty = (id: string, n: number) => update({ addOnQuantities: { ...state.addOnQuantities, [id]: n } })

  const windowTintService = services.find((s: Service) => s.slug === 'window_tint')
  const windowTintSelected = state.selectedServices.some((s: Service) => s.slug === 'window_tint')
  const tintRule = priceMap['window_tint']
  const portWindowPrice = settings?.port_window_price ?? 2500
  const tintScopePrice = windowTintSelected && tintRule
    ? (state.tintScope.windshield === 'full' ? tintRule.front_windshield_price : 0)
      + (state.tintScope.windshield === 'brow' ? tintRule.windshield_brow_price : 0)
      + (state.tintScope.windshield === 'brow_full' ? tintRule.front_windshield_price + tintRule.windshield_brow_price : 0)
      + (state.tintScope.windshield === 'brow_full' ? tintRule.front_windshield_price + tintRule.windshield_brow_price : 0)
      + (state.tintScope.rear === true ? tintRule.rear_glass_price : 0)
      + (state.tintScope.sideCount != null && state.tintScope.sideCount > 0 ? tintRule.side_window_price * state.tintScope.sideCount : 0)
      + (state.tintScope.portCount != null && state.tintScope.portCount > 0 ? portWindowPrice * state.tintScope.portCount : 0)
    : 0

  const detailingSelected = state.selectedServices.some((s: Service) => s.slug === 'detailing')
  const detailRule = priceMap['detailing']
  const detailScopePrice = detailingSelected && detailRule
    ? (state.detailScope.interior ? detailRule.interior_price : 0)
      + (state.detailScope.exterior ? detailRule.exterior_price : 0)
    : 0

  const setTintRemoval = (val: 'yes' | 'no') => {
    if (val === 'no') {
      const removalAddOnIds = addOns
        .filter((a: AddOn) => a.visibility === 'qualifying')
        .map((a: AddOn) => a.id)
      const removalIdSet = new Set(removalAddOnIds)
      const cleanedQty: Record<string, number> = {}
      for (const [k, v] of Object.entries(state.addOnQuantities)) { if (!removalIdSet.has(k)) cleanedQty[k] = v as number }
      update({
        tintRemoval: 'no',
        selectedAddOns: state.selectedAddOns.filter((a: AddOn) => !removalIdSet.has(a.id)),
        addOnQuantities: cleanedQty,
      })
    } else {
      update({ tintRemoval: 'yes' })
    }
  }

  const requiredAddOns: AddOn[] = addOns.filter(
    (a: AddOn) => a.required && a.visibility !== 'always' && !!a.service_id && state.selectedServices.some((s: Service) => s.id === a.service_id)
  )
  const qualifyingAddOns: AddOn[] = addOns.filter(
    (a: AddOn) => a.visibility === 'qualifying' && !!a.service_id && state.selectedServices.some((s: Service) => s.id === a.service_id)
  )
  const generalOptionalAddOns: AddOn[] = addOns.filter(
    (a: AddOn) => !a.required && a.visibility !== 'qualifying' && (
      a.visibility === 'always' || (!!a.service_id && state.selectedServices.some((s: Service) => s.id === a.service_id))
    )
  )

  const requiredByService: Record<string, AddOn[]> = {}
  for (const a of requiredAddOns) {
    if (!a.service_id) continue
    if (!requiredByService[a.service_id]) requiredByService[a.service_id] = []
    requiredByService[a.service_id].push(a)
  }

  const missingServices = state.selectedServices.filter((s: Service) => {
    const required = requiredByService[s.id]
    if (!required || required.length === 0) return false
    return !required.some((a: AddOn) => state.selectedAddOns.some((x: AddOn) => x.id === a.id))
  })

  const tintScopeValid = !windowTintSelected || (
    state.tintScope.windshield !== null &&
    state.tintScope.rear !== null &&
    state.tintScope.sideCount !== null &&
    state.tintScope.portCount !== null
  )
  const tintRemovalValid = !windowTintSelected || state.tintRemoval !== null
  const detailScopeValid = !detailingSelected || state.detailScope.interior || state.detailScope.exterior
  const canContinue = state.selectedServices.length > 0 && missingServices.length === 0 && tintScopeValid && tintRemovalValid && detailScopeValid
  const hasSelections = state.selectedServices.length > 0

  const priceLabel = (s: Service) => {
    const rule = priceMap[s.slug]
    if (rule) {
      if (s.slug === 'window_tint') return 'Select scope for pricing'
      if (s.slug === 'detailing') return 'Select scope for pricing'
      return formatPrice(rule.base_price)
    }
    if (startingPrices[s.slug]) return `Starting at ${formatPrice(startingPrices[s.slug])}`
    return null
  }

  return (
    <Wrap title="Choose Your Services" subtitle={`Pricing shown for your vehicle class (${state.pricingClass?.replace('_', ' ')}). Select one or more services to book.`} onBack={() => setStep(1)}>
      {loading ? <Spinner /> : (
        <div className="space-y-4">
          {services.map((s: Service) => {
            const sel = state.selectedServices.some((x: Service) => x.id === s.id)
            const price = priceLabel(s)
            const isExact = !!priceMap[s.slug]
            const serviceRequiredAddOns = requiredByService[s.id] || []
            const serviceQualifyingAddOns = qualifyingAddOns.filter((a: AddOn) => a.service_id === s.id)
            const serviceOptionalAddOns = generalOptionalAddOns.filter((a: AddOn) => a.service_id === s.id)
            return (
              <div key={s.id} className="space-y-4">
                <button onClick={() => toggle(s)}
                  className={`card w-full p-6 text-left transition-all ${sel ? 'border-brand-blue bg-brand-blue/5' : 'card-hover bg-card-gradient'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white mb-1">{s.name}</h3>
                      <p className="text-brand-silver text-sm">{s.description}</p>
                    </div>
                    <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${sel ? 'bg-brand-blue border-brand-blue' : 'border-brand-border'}`}>
                      {sel && <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </div>
                  </div>
                  {price && (
                    <p className={`text-sm font-medium mt-3 ${isExact ? 'text-brand-blue' : 'text-brand-silver-dark'}`}>
                      {isExact ? price : price}
                    </p>
                  )}
                </button>

                {/* Required scope selections for this service */}
                {sel && serviceRequiredAddOns.length > 0 && (
                  <div className="animate-fade-in space-y-4">
                    {(() => {
                      const hasSelection = serviceRequiredAddOns.some((a: AddOn) => state.selectedAddOns.some((x: AddOn) => x.id === a.id))
                      return (
                        <div className={`card p-6 bg-card-gradient border ${hasSelection ? 'border-brand-border' : 'border-amber-500/40'}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-semibold text-white">{s.name} — Select Scope</h3>
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold tracking-wider uppercase bg-amber-500/15 text-amber-400 border border-amber-500/30">Required</span>
                          </div>
                          <p className="text-brand-silver text-sm mb-4">Choose one option to continue.</p>
                          <div className="space-y-3">
                            {serviceRequiredAddOns.map((a: AddOn) => (
                              <AddOnRow
                                key={a.id}
                                a={a}
                                sel={state.selectedAddOns.some((x: AddOn) => x.id === a.id)}
                                qty={state.addOnQuantities[a.id]}
                                onToggle={() => toggleAddOn(a, true)}
                                onQty={(n) => setAddOnQty(a.id, n)}
                                radio
                              />
                            ))}
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )}

                {/* Window Tint: tint removal + scope */}
                {sel && s.slug === 'window_tint' && tintRule && (
                  <div className="animate-fade-in space-y-4">
                    <div className={`card p-6 bg-card-gradient border ${tintRemovalValid ? 'border-brand-border' : 'border-amber-500/40'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold text-white">Tint Removal</h3>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold tracking-wider uppercase bg-amber-500/15 text-amber-400 border border-amber-500/30">Required</span>
                      </div>
                      <p className="text-brand-silver text-sm mb-4">Do you need old tint removed before applying new tint?</p>
                      <div className="space-y-3">
                        {(['no', 'yes'] as const).map((val) => (
                          <button key={val} onClick={() => setTintRemoval(val)}
                            className={`w-full p-4 text-left rounded-md border transition-all ${state.tintRemoval === val ? 'border-brand-blue bg-brand-blue/5' : 'border-brand-border bg-brand-muted/30 hover:bg-white/[0.02]'}`}>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-white font-medium text-sm">{val === 'no' ? 'No, no tint removal needed' : 'Yes, I need tint removal'}</span>
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${state.tintRemoval === val ? 'border-brand-blue' : 'border-brand-border'}`}>
                                {state.tintRemoval === val && <span className="w-2.5 h-2.5 rounded-full bg-brand-blue" />}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                      {state.tintRemoval === 'yes' && serviceQualifyingAddOns.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-brand-border space-y-3">
                          <p className="text-brand-silver text-sm">Select which windows need old tint removed:</p>
                          {serviceQualifyingAddOns.map((a: AddOn) => (
                            <AddOnRow
                              key={a.id}
                              a={a}
                              sel={state.selectedAddOns.some((x: AddOn) => x.id === a.id)}
                              qty={state.addOnQuantities[a.id]}
                              onToggle={() => toggleAddOn(a)}
                              onQty={(n) => setAddOnQty(a.id, n)}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    <div className={`card p-6 bg-card-gradient border ${tintScopeValid ? 'border-brand-border' : 'border-amber-500/40'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold text-white">Window Tint — Tint Scope</h3>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold tracking-wider uppercase bg-amber-500/15 text-amber-400 border border-amber-500/30">Required</span>
                      </div>
                      <p className="text-brand-silver text-sm mb-4">Answer all four questions to build your tint scope. Each must be answered to continue.</p>
                      <div className="space-y-5">
                        {/* Windshield */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-white font-medium text-sm flex items-center gap-1.5">Windshield <TintHelpIcon /></span>
                            {state.tintScope.windshield !== null && <span className="text-brand-blue font-bold text-sm">{state.tintScope.windshield === 'none' ? 'None' : `+${formatPrice(state.tintScope.windshield === 'full' ? tintRule.front_windshield_price : state.tintScope.windshield === 'brow' ? tintRule.windshield_brow_price : tintRule.front_windshield_price + tintRule.windshield_brow_price)}`}</span>}
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {(['none', 'brow', 'full', 'brow_full'] as const).map((opt) => (
                              <button key={opt} onClick={() => update({ tintScope: { ...state.tintScope, windshield: opt } })}
                                className={`p-3 rounded-md border text-center transition-all ${state.tintScope.windshield === opt ? 'border-brand-blue bg-brand-blue/5' : 'border-brand-border bg-brand-muted/30 hover:bg-white/[0.02]'}`}>
                                <span className={`text-sm font-medium ${state.tintScope.windshield === opt ? 'text-brand-blue' : 'text-brand-silver'}`}>{opt === 'none' ? 'None' : opt === 'brow' ? 'Brow' : opt === 'full' ? 'Full' : 'Brow + Full'}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                        {/* Rear Glass */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-white font-medium text-sm flex items-center gap-1.5">Rear Glass (Back Window) <TintHelpIcon /></span>
                            {state.tintScope.rear !== null && <span className="text-brand-blue font-bold text-sm">{state.tintScope.rear ? `+${formatPrice(tintRule.rear_glass_price)}` : 'No'}</span>}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => update({ tintScope: { ...state.tintScope, rear: true } })}
                              className={`p-3 rounded-md border text-center transition-all ${state.tintScope.rear === true ? 'border-brand-blue bg-brand-blue/5' : 'border-brand-border bg-brand-muted/30 hover:bg-white/[0.02]'}`}>
                              <span className={`text-sm font-medium ${state.tintScope.rear === true ? 'text-brand-blue' : 'text-brand-silver'}`}>Yes, tint it</span>
                            </button>
                            <button onClick={() => update({ tintScope: { ...state.tintScope, rear: false } })}
                              className={`p-3 rounded-md border text-center transition-all ${state.tintScope.rear === false ? 'border-brand-blue bg-brand-blue/5' : 'border-brand-border bg-brand-muted/30 hover:bg-white/[0.02]'}`}>
                              <span className={`text-sm font-medium ${state.tintScope.rear === false ? 'text-brand-blue' : 'text-brand-silver'}`}>No, skip</span>
                            </button>
                          </div>
                        </div>
                        {/* Side Windows */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-white font-medium text-sm flex items-center gap-1.5">Side Windows <TintHelpIcon /></span>
                            <span className="text-brand-blue font-bold text-sm">+{formatPrice(tintRule.side_window_price)} / window</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center rounded-md border border-brand-border overflow-hidden">
                              <button onClick={() => update({ tintScope: { ...state.tintScope, sideCount: Math.max(0, (state.tintScope.sideCount ?? 0) - 1) } })}
                                className="w-10 h-10 flex items-center justify-center text-brand-silver hover:text-white hover:bg-brand-muted transition-colors text-lg font-bold">−</button>
                              <span className="px-4 text-white font-semibold text-sm min-w-[3rem] text-center">{state.tintScope.sideCount ?? '—'}</span>
                              <button onClick={() => update({ tintScope: { ...state.tintScope, sideCount: Math.min(20, (state.tintScope.sideCount ?? 0) + 1) } })}
                                className="w-10 h-10 flex items-center justify-center text-brand-silver hover:text-white hover:bg-brand-muted transition-colors text-lg font-bold">+</button>
                            </div>
                            <span className="text-brand-silver text-sm">{(state.tintScope.sideCount ?? 0) > 0 ? <><span className="text-brand-blue font-semibold">{formatPrice(tintRule.side_window_price * state.tintScope.sideCount!)}</span> total</> : 'Enter 0 if none'}</span>
                          </div>
                        </div>
                        {/* Port Windows */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-white font-medium text-sm flex items-center gap-1.5">Port Windows <TintHelpIcon /></span>
                            <span className="text-brand-blue font-bold text-sm">+{formatPrice(portWindowPrice)} / window</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center rounded-md border border-brand-border overflow-hidden">
                              <button onClick={() => update({ tintScope: { ...state.tintScope, portCount: Math.max(0, (state.tintScope.portCount ?? 0) - 1) } })}
                                className="w-10 h-10 flex items-center justify-center text-brand-silver hover:text-white hover:bg-brand-muted transition-colors text-lg font-bold">−</button>
                              <span className="px-4 text-white font-semibold text-sm min-w-[3rem] text-center">{state.tintScope.portCount ?? '—'}</span>
                              <button onClick={() => update({ tintScope: { ...state.tintScope, portCount: Math.min(20, (state.tintScope.portCount ?? 0) + 1) } })}
                                className="w-10 h-10 flex items-center justify-center text-brand-silver hover:text-white hover:bg-brand-muted transition-colors text-lg font-bold">+</button>
                            </div>
                            <span className="text-brand-silver text-sm">{(state.tintScope.portCount ?? 0) > 0 ? <><span className="text-brand-blue font-semibold">{formatPrice(portWindowPrice * state.tintScope.portCount!)}</span> total</> : 'Enter 0 if none'}</span>
                          </div>
                        </div>
                      </div>
                      {tintScopePrice > 0 && (
                        <div className="mt-4 pt-3 border-t border-brand-border flex justify-between text-sm">
                          <span className="text-brand-silver">Tint Scope Total</span>
                          <span className="text-brand-blue font-bold">{formatPrice(tintScopePrice)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Detailing: scope selection */}
                {sel && s.slug === 'detailing' && detailRule && (
                  <div className="animate-fade-in space-y-4">
                    <div className={`card p-6 bg-card-gradient border ${detailScopeValid ? 'border-brand-border' : 'border-amber-500/40'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold text-white">Detailing — Select Your Scope</h3>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold tracking-wider uppercase bg-amber-500/15 text-amber-400 border border-amber-500/30">Required</span>
                      </div>
                      <p className="text-brand-silver text-sm mb-4">Choose at least one option to continue. Select both for a full detail.</p>
                      <div className="space-y-3">
                        <button onClick={() => update({ detailScope: { ...state.detailScope, interior: !state.detailScope.interior } })}
                          className={`w-full p-4 text-left rounded-md border transition-all ${state.detailScope.interior ? 'border-brand-blue bg-brand-blue/5' : 'border-brand-border bg-brand-muted/30 hover:bg-white/[0.02]'}`}>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-white font-medium text-sm">Interior Detail</span>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-brand-blue font-bold text-sm">+{formatPrice(detailRule.interior_price)}</span>
                              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${state.detailScope.interior ? 'bg-brand-blue border-brand-blue' : 'border-brand-border'}`}>
                                {state.detailScope.interior && <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                              </div>
                            </div>
                          </div>
                        </button>
                        <button onClick={() => update({ detailScope: { ...state.detailScope, exterior: !state.detailScope.exterior } })}
                          className={`w-full p-4 text-left rounded-md border transition-all ${state.detailScope.exterior ? 'border-brand-blue bg-brand-blue/5' : 'border-brand-border bg-brand-muted/30 hover:bg-white/[0.02]'}`}>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-white font-medium text-sm">Exterior Detail</span>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-brand-blue font-bold text-sm">+{formatPrice(detailRule.exterior_price)}</span>
                              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${state.detailScope.exterior ? 'bg-brand-blue border-brand-blue' : 'border-brand-border'}`}>
                                {state.detailScope.exterior && <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                              </div>
                            </div>
                          </div>
                        </button>
                      </div>
                      {detailScopePrice > 0 && (
                        <div className="mt-4 pt-3 border-t border-brand-border flex justify-between text-sm">
                          <span className="text-brand-silver">Detail Scope Total</span>
                          <span className="text-brand-blue font-bold">{formatPrice(detailScopePrice)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Service-specific optional add-ons */}
                {sel && serviceOptionalAddOns.length > 0 && (
                  <div className="animate-fade-in">
                    <div className="card p-6 bg-card-gradient">
                      <h3 className="text-lg font-semibold text-white mb-1">Optional Extras</h3>
                      <p className="text-brand-silver text-sm mb-4">Enhance your {s.name.toLowerCase()} with these add-ons.</p>
                      <div className="space-y-3">
                        {serviceOptionalAddOns.map((a: AddOn) => (
                          <AddOnRow
                            key={a.id}
                            a={a}
                            sel={state.selectedAddOns.some((x: AddOn) => x.id === a.id)}
                            svc={s}
                            qty={state.addOnQuantities[a.id]}
                            onToggle={() => toggleAddOn(a)}
                            onQty={(n) => setAddOnQty(a.id, n)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* Service-independent optional extras */}
          {generalOptionalAddOns.filter((a: AddOn) => !a.service_id || !state.selectedServices.some((sv: Service) => sv.id === a.service_id)).length > 0 && (
            <div className="animate-fade-in">
              <div className="card p-6 bg-card-gradient">
                <h3 className="text-lg font-semibold text-white mb-1">Optional Extras</h3>
                <p className="text-brand-silver text-sm mb-4">Enhance your service with these add-ons.</p>
                <div className="space-y-3">
                  {generalOptionalAddOns.filter((a: AddOn) => !a.service_id || !state.selectedServices.some((sv: Service) => sv.id === a.service_id)).map((a: AddOn) => {
                    const svc = state.selectedServices.find((s: Service) => s.id === a.service_id)
                    return (
                      <AddOnRow
                        key={a.id}
                        a={a}
                        sel={state.selectedAddOns.some((x: AddOn) => x.id === a.id)}
                        svc={svc}
                        qty={state.addOnQuantities[a.id]}
                        onToggle={() => toggleAddOn(a)}
                        onQty={(n) => setAddOnQty(a.id, n)}
                      />
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Blocking hint when a required selection is still missing */}
          {state.selectedServices.length > 0 && !canContinue && (
            <p className="text-amber-400 text-sm text-center animate-fade-in">
              {windowTintSelected && !tintScopeValid
                ? 'Please answer all tint scope questions above.'
                : windowTintSelected && !tintRemovalValid
                  ? 'Please let us know if you need tint removal above.'
                  : detailingSelected && !detailScopeValid
                    ? 'Please select Interior, Exterior, or both to continue.'
                    : `Please make the required selection${missingServices.length > 1 ? 's' : ''} above${missingServices.length === 1 ? ` for ${missingServices[0].name}` : ''} before continuing.`}
            </p>
          )}

          {/* Live running total */}
          {hasSelections && (
            <div className="card p-6 bg-brand-blue/5 border-brand-blue/30 animate-fade-in">
              {rulesLoading ? (
                <div className="flex items-center justify-center py-2"><div className="w-5 h-5 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" /></div>
              ) : (
                <>
                  <div className="space-y-2 mb-4">
                    {resolvedServices.map((s: SelectedService) => {
                      const serviceAddOns = state.selectedAddOns.filter((a: AddOn) => a.service_id === s.id)
                      return (
                        <div key={s.id} className="space-y-1">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-white font-medium">{s.name}</span>
                            <span className="text-brand-blue font-bold">{s.slug === 'window_tint' ? formatPrice(tintScopePrice) : s.slug === 'detailing' ? formatPrice(detailScopePrice) : formatPrice(s.base_price)}</span>
                          </div>
                          {s.slug === 'window_tint' && tintRule && tintScopePrice > 0 && (
                            <div className="pl-3 space-y-1">
                              {state.tintScope.windshield === 'full' && (
                                <div className="flex justify-between items-center text-xs">
                                  <span className="text-brand-silver">Windshield Tint (Full)</span>
                                  <span className="text-brand-blue">+{formatPrice(tintRule.front_windshield_price)}</span>
                                </div>
                              )}
                              {state.tintScope.windshield === 'brow' && (
                                <div className="flex justify-between items-center text-xs">
                                  <span className="text-brand-silver">Windshield Brow</span>
                                  <span className="text-brand-blue">+{formatPrice(tintRule.windshield_brow_price)}</span>
                                </div>
                              )}
                              {state.tintScope.windshield === 'brow_full' && (
                                <div className="flex justify-between items-center text-xs">
                                  <span className="text-brand-silver">Windshield Brow + Full Tint</span>
                                  <span className="text-brand-blue">+{formatPrice(tintRule.front_windshield_price + tintRule.windshield_brow_price)}</span>
                                </div>
                              )}
                              {state.tintScope.rear === true && (
                                <div className="flex justify-between items-center text-xs">
                                  <span className="text-brand-silver">Rear Glass Tint</span>
                                  <span className="text-brand-blue">+{formatPrice(tintRule.rear_glass_price)}</span>
                                </div>
                              )}
                              {state.tintScope.sideCount != null && state.tintScope.sideCount > 0 && (
                                <div className="flex justify-between items-center text-xs">
                                  <span className="text-brand-silver">Side Window Tint × {state.tintScope.sideCount}</span>
                                  <span className="text-brand-blue">+{formatPrice(tintRule.side_window_price * state.tintScope.sideCount)}</span>
                                </div>
                              )}
                              {state.tintScope.portCount != null && state.tintScope.portCount > 0 && (
                                <div className="flex justify-between items-center text-xs">
                                  <span className="text-brand-silver">Port Window Tint × {state.tintScope.portCount}</span>
                                  <span className="text-brand-blue">+{formatPrice(portWindowPrice * state.tintScope.portCount)}</span>
                                </div>
                              )}
                            </div>
                          )}
                          {s.slug === 'detailing' && detailRule && detailScopePrice > 0 && (
                            <div className="pl-3 space-y-1">
                              {state.detailScope.interior && (
                                <div className="flex justify-between items-center text-xs">
                                  <span className="text-brand-silver">Interior Detail</span>
                                  <span className="text-brand-blue">+{formatPrice(detailRule.interior_price)}</span>
                                </div>
                              )}
                              {state.detailScope.exterior && (
                                <div className="flex justify-between items-center text-xs">
                                  <span className="text-brand-silver">Exterior Detail</span>
                                  <span className="text-brand-blue">+{formatPrice(detailRule.exterior_price)}</span>
                                </div>
                              )}
                            </div>
                          )}
                          {serviceAddOns.map((a: AddOn) => {
                            const qty = a.per_unit_label ? (state.addOnQuantities[a.id] || 1) : 1
                            return (
                              <div key={a.id} className="flex justify-between items-center text-xs pl-3">
                                <span className="text-brand-silver">{a.name}{a.per_unit_label ? ` × ${qty} ${a.per_unit_label}${qty > 1 ? 's' : ''}` : ''}</span>
                                <span className="text-brand-blue">+{formatPrice(a.price * qty)}</span>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                    {state.selectedAddOns
                      .filter((a: AddOn) => !state.selectedServices.some((sv: Service) => sv.id === a.service_id))
                      .map((a: AddOn) => {
                        const qty = a.per_unit_label ? (state.addOnQuantities[a.id] || 1) : 1
                        return (
                          <div key={a.id} className="flex justify-between items-center text-sm">
                            <span className="text-brand-silver">{a.name}{a.per_unit_label ? ` × ${qty} ${a.per_unit_label}${qty > 1 ? 's' : ''}` : ''}</span>
                            <span className="text-brand-blue">+{formatPrice(a.price * qty)}</span>
                          </div>
                        )
                      })}
                  </div>
                  <div className="border-t border-brand-border pt-3 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-brand-silver">Estimated Total</span>
                      <span className="text-xl font-bold text-white">{formatPrice(totalPrice)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-brand-silver-dark">Deposit to book</span>
                      <span className="text-brand-blue font-semibold">{formatPrice(depositAmount)}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {tintMapOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setTintMapOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Tint map reference — expanded view"
        >
          <button
            type="button"
            onClick={() => setTintMapOpen(false)}
            className="absolute top-4 right-4 z-10 w-11 h-11 rounded-full bg-brand-card/80 border border-brand-border flex items-center justify-center text-white hover:text-brand-blue hover:border-brand-blue transition-colors"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" /></svg>
          </button>
          <img
            src={tintOptionsImage}
            alt="London Tint window tinting options — windshield brow, full windshield, side windows, rear glass, and port windows"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <button onClick={() => setStep(3)} className="btn-primary w-full mt-4" disabled={!canContinue}>
        {state.selectedServices.length === 0
          ? 'Select at least one service'
          : !canContinue
            ? 'Complete required selections above'
            : `Continue (${state.selectedServices.length} service${state.selectedServices.length > 1 ? 's' : ''})`}
      </button>
    </Wrap>
  )
}

// ── Step 3: Your Info + Deposit ──
function Step3Deposit({ state, totalPrice, depositAmount, balanceDue, settings, update, submitting, setSubmitting, setError, setStep, onComplete }: {
  state: State
  totalPrice: number
  depositAmount: number
  balanceDue: number
  settings: BusinessSettings | null
  update: (p: Partial<State>) => void
  submitting: boolean
  setSubmitting: (b: boolean) => void
  setError: (e: string | null) => void
  setStep: (n: number) => void
  onComplete: () => void
}) {
  const [confirmed, setConfirmed] = useState(false)
  const [paymentPhase, setPaymentPhase] = useState(false)
  const isFlat = settings?.deposit_type === 'flat'

  // Scroll to top when switching between the form, payment, and confirmation views
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [paymentPhase, confirmed])

  const submit = async () => {
    setSubmitting(true); setError(null)

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(state.customer.email)) {
      setError('Please enter a valid email address.')
      setSubmitting(false)
      return
    }
    const phoneDigits = state.customer.phone.replace(/\D/g, '')
    if (phoneDigits.length < 10) {
      setError('Please enter a valid phone number (at least 10 digits).')
      setSubmitting(false)
      return
    }

    try {
      const servicesJson = state.selectedServices.map((s: Service) => {
        const entry: Record<string, unknown> = { id: s.id, slug: s.slug, name: s.name }
        if (s.slug === 'window_tint') {
          entry.tint_scope = state.tintScope
          entry.tint_removal = state.tintRemoval
        }
        if (s.slug === 'detailing') {
          entry.detail_scope = state.detailScope
        }
        return entry
      })
      const addOnsJson = state.selectedAddOns.map((a: AddOn) => {
        const qty = a.per_unit_label ? (state.addOnQuantities[a.id] || 1) : 1
        return { id: a.id, name: a.name, price: a.price * qty, ...(a.per_unit_label ? { quantity: qty, per_unit_label: a.per_unit_label } : {}) }
      })

      const { data: apptId, error: rpcError } = await supabase.rpc('create_booking', {
        p_first_name: state.customer.first_name,
        p_last_name: state.customer.last_name || '',
        p_email: state.customer.email,
        p_phone: state.customer.phone,
        p_year: Number(state.year),
        p_make: state.make,
        p_model: state.model,
        p_vehicle_class: state.vehicleClass,
        p_services: servicesJson,
        p_add_ons: addOnsJson,
        p_total_price: totalPrice,
        p_deposit_amount: depositAmount,
        p_balance_due: balanceDue,
      })
      if (rpcError) throw rpcError
      const appointmentId = apptId as string

      update({ appointmentId }); setPaymentPhase(true)
    } catch (e: any) { setError(e.message || 'Failed to create appointment.') }
    finally { setSubmitting(false) }
  }

  if (confirmed) {
    return (
      <Wrap title="Request Received!" subtitle="We'll be in touch shortly.">
        <div className="card p-8 text-center mb-6 bg-card-gradient">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-brand-blue/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-brand-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <h2 className="text-2xl font-semibold text-white mb-2">Booking Request Sent</h2>
          <p className="text-brand-silver mb-6">We've received your deposit and your appointment request. London will reach out to confirm your scheduled time within 1 business day.</p>
        </div>
        <div className="card p-6 mb-6 space-y-3 text-sm bg-card-gradient">
          <div className="flex justify-between"><span className="text-brand-silver">Services</span><span className="text-white text-right">{state.selectedServices.map((s: Service) => s.name).join(', ')}</span></div>
          {state.selectedAddOns.length > 0 && <div className="flex justify-between"><span className="text-brand-silver">Add-Ons</span><span className="text-white text-right">{state.selectedAddOns.map((a: AddOn) => a.name).join(', ')}</span></div>}
          <div className="flex justify-between"><span className="text-brand-silver">Vehicle</span><span className="text-white">{state.year} {state.make} {state.model}</span></div>
          <div className="flex justify-between"><span className="text-brand-silver">Name</span><span className="text-white">{state.customer.first_name} {state.customer.last_name}</span></div>
          <div className="flex justify-between"><span className="text-brand-silver">Phone</span><span className="text-white">{state.customer.phone}</span></div>
          <div className="border-t border-brand-border pt-3 flex justify-between"><span className="text-brand-silver">Deposit Paid</span><span className="text-brand-blue font-semibold">{formatPrice(depositAmount)}</span></div>
          <div className="flex justify-between"><span className="text-brand-silver">Balance Due at Appointment</span><span className="text-white">{formatPrice(balanceDue)}</span></div>
        </div>
        <div className="card p-4 mb-6 bg-amber-500/5 border-amber-500/20">
          <p className="text-amber-300/90 text-xs">The remaining balance is due at the time of service completion. Cash and Square (card) payments are both accepted.</p>
        </div>
        <div className="flex gap-3">
          <a href="/" className="btn-secondary flex-1">Back to Home</a>
          <a href="/book" className="btn-primary flex-1">Book Another</a>
        </div>
      </Wrap>
    )
  }

  if (paymentPhase && state.appointmentId) {
    return (
      <Wrap title="Pay Your Deposit" subtitle="Complete your payment to secure your spot.">
        <div className="card p-6 mb-6 space-y-4 bg-card-gradient">
          <div className="flex justify-between text-sm"><span className="text-brand-silver">Services</span><span className="text-white text-right">{state.selectedServices.map((s: Service) => s.name).join(', ')}</span></div>
          {state.selectedAddOns.length > 0 && <div className="flex justify-between text-sm"><span className="text-brand-silver">Add-Ons</span><span className="text-white text-right">{state.selectedAddOns.map((a: AddOn) => a.name).join(', ')}</span></div>}
          <div className="flex justify-between text-sm"><span className="text-brand-silver">Vehicle</span><span className="text-white">{state.year} {state.make} {state.model}</span></div>
          <div className="border-t border-brand-border pt-4 space-y-2">
            <div className="flex justify-between text-brand-blue"><span className="font-medium">Deposit Due Today</span><span className="font-bold text-lg">{formatPrice(depositAmount)}</span></div>
            <div className="flex justify-between text-brand-silver-dark"><span>Remaining Balance (due at completion)</span><span>{formatPrice(balanceDue)}</span></div>
          </div>
        </div>

        <div className="card p-4 mb-6 bg-amber-500/5 border-amber-500/20">
          <p className="text-amber-300/90 text-xs">The remaining balance is due at the time of service completion. Cash and Square (card) payments are both accepted.</p>
        </div>

        <div className="card p-6 mb-6 bg-brand-blue/5 border-brand-blue/30">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-brand-blue flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7v10l10 5 10-5V7L12 2zM12 22V12M12 12l10-5M12 12L2 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <div><p className="text-white text-sm font-medium mb-1">Secure Payment via Square</p><p className="text-brand-silver text-xs">Your deposit is processed securely through Square. We never see or store your card information. Apple Pay and Google Pay are supported on compatible devices.</p></div>
          </div>
        </div>

        <SquarePayment
          amount={depositAmount}
          appointmentId={state.appointmentId}
          onSuccess={() => {
            const customerName = `${state.customer.first_name} ${state.customer.last_name || ''}`.trim()
            const vehicle = `${state.year} ${state.make} ${state.model}`.trim()
            const servicesStr = state.selectedServices.map((s: Service) => s.name).join(', ')
            const siteUrl = window.location.origin

            // Notify admin — fire and forget, only after payment succeeds
            fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'new_booking_notification',
                payload: {
                  customer_name: customerName,
                  customer_phone: state.customer.phone,
                  customer_email: state.customer.email || null,
                  vehicle,
                  services: servicesStr,
                  deposit_amount: formatPrice(depositAmount),
                  appointment_id: state.appointmentId,
                  site_url: siteUrl,
                },
              }),
            }).catch(() => {})
            // Send customer confirmation email — fire and forget, only after payment succeeds
            fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'booking_confirmation',
                payload: {
                  customer_name: customerName,
                  customer_email: state.customer.email,
                  vehicle,
                  services: servicesStr,
                  deposit_amount: formatPrice(depositAmount),
                  balance_due: formatPrice(balanceDue),
                  appointment_id: state.appointmentId,
                  site_url: siteUrl,
                },
              }),
            }).catch(() => {})

            setConfirmed(true); onComplete()
          }}
          onError={(msg: string) => setError(msg)}
        />
      </Wrap>
    )
  }

  return (
    <Wrap title="Your Information" subtitle="Enter your contact info, then pay your deposit to request your appointment." onBack={() => setStep(2)}>
      <div className="card p-6 mb-6 space-y-4 bg-card-gradient">
        <div className="flex justify-between text-sm"><span className="text-brand-silver">Services</span><span className="text-white text-right">{state.selectedServices.map((s: Service) => s.name).join(', ')}</span></div>
        {state.selectedAddOns.length > 0 && <div className="flex justify-between text-sm"><span className="text-brand-silver">Add-Ons</span><span className="text-white text-right">{state.selectedAddOns.map((a: AddOn) => a.name).join(', ')}</span></div>}
        <div className="flex justify-between text-sm"><span className="text-brand-silver">Vehicle</span><span className="text-white">{state.year} {state.make} {state.model}</span></div>
        <div className="border-t border-brand-border pt-4 space-y-2">
          <div className="flex justify-between"><span className="text-brand-silver">Estimated Total</span><span className="text-white font-semibold">{formatPrice(totalPrice)}</span></div>
          <div className="flex justify-between text-brand-blue"><span className="font-medium">Deposit Due Today</span><span className="font-bold text-lg">{formatPrice(depositAmount)}</span></div>
          <div className="flex justify-between text-brand-silver-dark"><span>Remaining Balance</span><span>{formatPrice(balanceDue)}</span></div>
        </div>
      </div>

      <div className="card p-6 mb-6 bg-card-gradient">
        <h3 className="text-white font-semibold mb-4">Your Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-brand-silver mb-2">First Name <span className="text-brand-blue">*</span></label>
            <input className="input" value={state.customer.first_name} onChange={(e) => update({ customer: { ...state.customer, first_name: e.target.value } })} />
          </div>
          <div>
            <label className="block text-sm text-brand-silver mb-2">Last Name <span className="text-brand-silver-dark">(optional)</span></label>
            <input className="input" value={state.customer.last_name} onChange={(e) => update({ customer: { ...state.customer, last_name: e.target.value } })} />
          </div>
          <div>
            <label className="block text-sm text-brand-silver mb-2">Phone <span className="text-brand-blue">*</span></label>
            <input type="tel" className="input" value={state.customer.phone} onChange={(e) => update({ customer: { ...state.customer, phone: e.target.value } })} />
          </div>
          <div>
            <label className="block text-sm text-brand-silver mb-2">Email <span className="text-brand-blue">*</span></label>
            <input type="email" className="input" placeholder="you@example.com" value={state.customer.email} onChange={(e) => update({ customer: { ...state.customer, email: e.target.value } })} />
            <p className="text-brand-silver-dark text-xs mt-1">We'll send your booking details and review request here.</p>
          </div>
        </div>
      </div>

      <div className="card p-4 mb-6 bg-amber-500/5 border-amber-500/20">
        <p className="text-amber-300/90 text-xs">
          {isFlat
            ? `This ${formatPrice(depositAmount)} deposit is a booking fee and is required to book. It is non-refundable, even in the event of tear-offs and refunds. It will be applied as a credit toward your final bill after service. No-shows will forfeit the deposit immediately.`
            : `This deposit is a booking fee and is required to book. It is non-refundable, even in the event of tear-offs and refunds. It will be applied as a credit toward your final bill after service. No-shows will forfeit the deposit immediately.`}
        </p>
      </div>

      <button onClick={submit} className="btn-primary w-full" disabled={submitting || !state.customer.first_name || !state.customer.phone || !state.customer.email}>
        {submitting ? 'Saving…' : 'Continue to Payment'}
      </button>
    </Wrap>
  )
}
