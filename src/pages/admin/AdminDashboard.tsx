import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { isAdminAuthed, clearAdminSession } from './AdminLogin'

const TOKEN_KEY = 'london_admin_token'
import CatalogPanel from '../../components/admin/CatalogPanel'
import GalleryPanel from '../../components/admin/GalleryPanel'
import ReviewsPanel from '../../components/admin/ReviewsPanel'
import { formatPrice, formatDate, formatTime, formatDuration } from '../../lib/format'
import { computeAvailableSlots, getDurationForAppt, type AvailableSlot } from '../../lib/scheduling'
import { syncToGoogleCalendar } from '../../lib/googleCalendar'
import type { BusinessSettings, PricingClass } from '../../lib/types'

type Tab = 'today' | 'tomorrow' | 'unscheduled' | 'quotes' | 'revenue' | 'calendar' | 'catalog' | 'gallery' | 'reviews' | 'settings'

interface ApptRow {
  id: string
  customer_id: string
  vehicle_id: string
  appointment_date: string | null
  status: string
  deposit_paid: boolean
  balance_due: number
  total_price: number
  deposit_amount: number
  assigned_bay: number | null
  add_ons: any[]
  services: { id: string; slug: string; name: string; base_price?: number; tint_scope?: any; tint_removal?: string | null; detail_scope?: any }[]
  notes: string | null
  google_event_id: string | null
  square_card_id: string | null
  created_at: string
  customer: { first_name: string; last_name: string | null; email: string | null; phone: string; square_customer_id: string | null } | null
  vehicle: { year: number; make: string; model: string; trim: string | null } | null
}

interface PricingRuleRow {
  service: string
  pricing_class: PricingClass
  base_price: number
  duration: number
  front_windshield_price: number
  rear_glass_price: number
  side_window_price: number
  windshield_brow_price: number
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const location = useLocation()
  const [authed, setAuthed] = useState(false)
  const [tab, setTab] = useState<Tab>(() => {
    const p = new URLSearchParams(location.search).get('tab') as Tab | null
    return p && ['today','tomorrow','unscheduled','quotes','revenue','calendar','catalog','gallery','reviews','settings'].includes(p) ? p : 'unscheduled'
  })
  const [appts, setAppts] = useState<ApptRow[]>([])
  const [pricingRules, setPricingRules] = useState<PricingRuleRow[]>([])
  const [settings, setSettings] = useState<BusinessSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [revenue, setRevenue] = useState(0)

  useEffect(() => {
    let mounted = true
    isAdminAuthed().then((ok) => {
      if (!mounted) return
      if (!ok) { navigate('/admin/login'); return }
      setAuthed(true)
    })
    return () => { mounted = false }
  }, [navigate])

  const load = useCallback(async () => {
    setLoading(true)
    const { data: a } = await supabase.from('appointments').select('*, customer:customers(*), vehicle:vehicles(*)').order('created_at', { ascending: false })
    setAppts((a || []) as ApptRow[])
    const { data: s } = await supabase.from('business_settings').select('*').eq('id', 1).maybeSingle()
    setSettings(s as BusinessSettings | null)
    const { data: pr } = await supabase.from('pricing_rules').select('service,pricing_class,base_price,duration,front_windshield_price,rear_glass_price,side_window_price,windshield_brow_price')
    setPricingRules((pr || []) as PricingRuleRow[])
    const t = new Date(); t.setHours(0, 0, 0, 0)
    const te = new Date(t); te.setHours(23, 59, 59, 999)
    const { data: tp } = await supabase.from('payments').select('amount').eq('status', 'completed').gte('created_at', t.toISOString()).lte('created_at', te.toISOString())
    setRevenue((tp || []).reduce((s: number, p: any) => s + p.amount, 0))
    setLoading(false)
  }, [])

  useEffect(() => { if (authed) load() }, [authed, load])

  const signOut = () => {
    clearAdminSession()
    navigate('/admin/login')
  }
  if (!authed) return null

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowEnd = new Date(tomorrow); tomorrowEnd.setHours(23, 59, 59, 999)

  const todayAppts = appts.filter((a) => { if (!a.appointment_date) return false; const d = new Date(a.appointment_date); return d >= today && d < tomorrow })
  const tomorrowAppts = appts.filter((a) => { if (!a.appointment_date) return false; const d = new Date(a.appointment_date); return d >= tomorrow && d <= tomorrowEnd })
  const unscheduled = appts.filter((a) => !a.appointment_date && a.deposit_paid)
  const quotes = appts.filter((a) => (a.services || []).some((s) => s.slug === 'quote'))

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'unscheduled', label: 'Booking List', count: unscheduled.length },
    { id: 'today', label: "Today's Jobs", count: todayAppts.length },
    { id: 'tomorrow', label: 'Tomorrow', count: tomorrowAppts.length },
    { id: 'quotes', label: 'Quotes', count: quotes.length },
    { id: 'revenue', label: 'Revenue Today' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'catalog', label: 'Catalog' },
    { id: 'gallery', label: 'Gallery' },
    { id: 'reviews', label: 'Reviews' },
    { id: 'settings', label: 'Settings' },
  ]

  return (
    <div className="min-h-screen bg-brand-black bg-grain">
      <header className="bg-brand-charcoal border-b border-brand-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/images/London_icon.png" alt="London Tint & Detail" className="h-10 w-10 object-contain" />
            <span className="font-badge text-[9px] tracking-[0.25em] text-brand-blue uppercase">Admin</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="/" className="text-brand-silver text-sm hover:text-brand-blue transition-colors">View Site</a>
            <button onClick={signOut} className="text-brand-silver text-sm hover:text-red-400 transition-colors">Sign Out</button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-2 mb-8 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-2 sm:flex-wrap sm:overflow-visible sm:mx-0 sm:px-0 sm:pb-0">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-md text-sm font-badge font-semibold tracking-wider uppercase transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 ${tab === t.id ? 'bg-brand-blue text-white' : 'bg-brand-muted/50 text-brand-silver border border-brand-border hover:text-white'}`}>
              {t.label}
              {t.count !== undefined && t.count > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t.id ? 'bg-white/20' : 'bg-brand-blue/20 text-brand-blue'}`}>{t.count}</span>}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <>
            {tab === 'today' && <ApptList appts={todayAppts} title="Today's Jobs" settings={settings} pricingRules={pricingRules} allAppts={appts} onChange={load} />}
            {tab === 'tomorrow' && <ApptList appts={tomorrowAppts} title="Tomorrow's Jobs" settings={settings} pricingRules={pricingRules} allAppts={appts} onChange={load} />}
            {tab === 'unscheduled' && <ApptList appts={unscheduled} title="Booking List" emptyText="No customers waiting to be scheduled." settings={settings} pricingRules={pricingRules} allAppts={appts} onChange={load} />}
            {tab === 'quotes' && <ApptList appts={quotes} title="Quote Requests" settings={settings} pricingRules={pricingRules} allAppts={appts} onChange={load} />}
            {tab === 'revenue' && (
              <div>
                <h2 className="text-2xl font-semibold text-white mb-6">Revenue Today</h2>
                <div className="card p-8 bg-card-gradient">
                  <p className="text-brand-silver text-sm mb-2">Total deposits collected</p>
                  <p className="text-4xl font-bold text-brand-blue">{formatPrice(revenue)}</p>
                </div>
              </div>
            )}
            {tab === 'calendar' && <CalendarView appts={appts} settings={settings} pricingRules={pricingRules} onChange={load} />}
            {tab === 'catalog' && <CatalogPanel />}
            {tab === 'gallery' && <GalleryPanel />}
            {tab === 'reviews' && <ReviewsPanel />}
            {tab === 'settings' && <SettingsPanel settings={settings} onUpdate={load} />}
          </>
        )}
      </div>

      <footer className="bg-brand-charcoal border-t border-brand-border mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <img src="/images/London_icon.png" alt="London Tint & Detail" className="h-8 w-8 object-contain" />
            <p className="text-brand-silver-dark text-xs font-badge tracking-widest uppercase">Protect. Enhance. Customize.</p>
          </div>
          <p className="text-brand-silver-dark text-xs">© {new Date().getFullYear()} Cars by London. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}

function statusBadgeClass(status: string) {
  switch (status) {
    case 'confirmed': return 'badge-confirmed'
    case 'pending': return 'badge-pending'
    case 'completed': return 'badge-completed'
    case 'cancelled': return 'badge-cancelled'
    case 'no_show': return 'badge-cancelled'
    default: return 'badge-pending'
  }
}

function buildGCalPayload(a: ApptRow, start: string, end: string) {
  const svcNames = (a.services || []).map((s) => s.name).join(', ') || 'Service'
  const vehicle = a.vehicle ? `${a.vehicle.year} ${a.vehicle.make} ${a.vehicle.model}` : 'Unknown vehicle'
  const customer = a.customer ? `${a.customer.first_name} ${a.customer.last_name || ''}`.trim() : 'Unknown'
  return {
    appointment_id: a.id,
    summary: `${customer} — ${svcNames}`,
    description: `Customer: ${customer}\nVehicle: ${vehicle}\nServices: ${svcNames}\nBalance Due: ${formatPrice(a.balance_due)}\n${a.notes ? 'Notes: ' + a.notes : ''}`,
    start,
    end,
    google_event_id: a.google_event_id,
  }
}

function ApptList({ appts, title, emptyText, settings, pricingRules, allAppts, onChange }: {
  appts: ApptRow[]
  title: string
  emptyText?: string
  settings: BusinessSettings | null
  pricingRules: PricingRuleRow[]
  allAppts: ApptRow[]
  onChange: () => void
}) {
  const [schedulingId, setSchedulingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const schedulingAppt = appts.find((a) => a.id === schedulingId) || null

  return (
    <div>
      <h2 className="text-2xl font-semibold text-white mb-6">{title}</h2>
      {schedulingAppt && settings && (
        <ScheduleModal
          appt={schedulingAppt}
          settings={settings}
          pricingRules={pricingRules}
          allAppts={allAppts}
          onClose={() => setSchedulingId(null)}
          onDone={() => { setSchedulingId(null); onChange() }}
        />
      )}
      {appts.length === 0 ? <div className="card p-12 text-center text-brand-silver bg-card-gradient">{emptyText || 'No appointments here.'}</div> : (
        <div className="space-y-4">
          {appts.map((a) => (
            <div key={a.id} className="card p-4 sm:p-6 bg-card-gradient">
              <div className="flex items-start justify-between gap-3 cursor-pointer" onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}>
                <div className="flex-1">
                  <div className="flex items-center gap-2 sm:gap-3 mb-3 flex-wrap">
                    <span className={`text-xs px-2 py-1 rounded-full font-badge font-semibold tracking-wider uppercase ${statusBadgeClass(a.status)}`}>{a.status}</span>
                    <span className="text-white font-semibold text-sm sm:text-base">{(a.services || []).map((s) => s.name).join(', ') || 'Service'}</span>
                    {a.assigned_bay !== null && <span className="text-xs text-brand-silver-dark">Bay {a.assigned_bay}</span>}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm text-brand-silver">
                    <div><span className="text-brand-silver-dark block text-xs">Customer</span>{a.customer?.first_name} {a.customer?.last_name}</div>
                    <div><span className="text-brand-silver-dark block text-xs">Vehicle</span>{a.vehicle?.year} {a.vehicle?.make} {a.vehicle?.model}</div>
                    <div><span className="text-brand-silver-dark block text-xs">When</span>{a.appointment_date ? `${formatDate(a.appointment_date)} ${formatTime(a.appointment_date)}` : <span className="text-amber-400">To be scheduled</span>}</div>
                    <div><span className="text-brand-silver-dark block text-xs">Balance Due</span><span className="text-brand-blue">{formatPrice(a.balance_due)}</span></div>
                  </div>
                </div>
                <svg className={`w-5 h-5 text-brand-silver-dark flex-shrink-0 mt-1 transition-transform duration-200 ${expandedId === a.id ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              {expandedId === a.id && (
                <ExpandedCard
                  appt={a}
                  settings={settings}
                  pricingRules={pricingRules}
                  onSchedule={(id) => setSchedulingId(id)}
                  onChange={onChange}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ExpandedCard({ appt, settings, pricingRules, onSchedule, onChange }: {
  appt: ApptRow
  settings: BusinessSettings | null
  pricingRules: PricingRuleRow[]
  onSchedule: (id: string) => void
  onChange: () => void
}) {
  const [notes, setNotes] = useState(appt.notes || '')
  const [savingNotes, setSavingNotes] = useState(false)
  const [showReviewPrompt, setShowReviewPrompt] = useState(false)
  const [sendingReview, setSendingReview] = useState(false)
  const [reviewResult, setReviewResult] = useState<{ sent: boolean; error: string | null } | null>(null)
  const [showWorkOrder, setShowWorkOrder] = useState(false)

  const duration = getDurationForAppt(appt, pricingRules)

  const saveNotes = async () => {
    setSavingNotes(true)
    await supabase.from('appointments').update({ notes }).eq('id', appt.id)
    setSavingNotes(false)
  }

  const retryGCal = async () => {
    if (!appt.appointment_date) return
    const start = new Date(appt.appointment_date)
    const end = new Date(start.getTime() + duration * 3600000)
    const payload = buildGCalPayload(appt, start.toISOString(), end.toISOString())
    const action = appt.google_event_id ? 'update' : 'create'
    const result = await syncToGoogleCalendar(action, payload)
    if (result.error) {
      alert('Google Calendar sync failed: ' + result.error)
    } else {
      alert('Synced to Google Calendar successfully.')
      onChange()
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-brand-border space-y-4 animate-slide-up">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
        <div><span className="text-brand-silver-dark block text-xs">Phone</span><a href={`tel:${appt.customer?.phone}`} className="text-brand-blue">{appt.customer?.phone}</a></div>
        <div><span className="text-brand-silver-dark block text-xs">Email</span><a href={`mailto:${appt.customer?.email}`} className="text-brand-blue break-all">{appt.customer?.email || '—'}</a></div>
        <div><span className="text-brand-silver-dark block text-xs">Vehicle</span><span className="text-white">{appt.vehicle?.year} {appt.vehicle?.make} {appt.vehicle?.model}</span></div>
        <div><span className="text-brand-silver-dark block text-xs">When</span><span className="text-white">{appt.appointment_date ? `${formatDate(appt.appointment_date)} ${formatTime(appt.appointment_date)}` : 'Unscheduled'}</span></div>
        {appt.assigned_bay !== null && <div><span className="text-brand-silver-dark block text-xs">Bay</span><span className="text-white">Bay {appt.assigned_bay}</span></div>}
        <div><span className="text-brand-silver-dark block text-xs">Duration</span><span className="text-white">{formatDuration(duration)}</span></div>
        <div><span className="text-brand-silver-dark block text-xs">Total Price</span><span className="text-white">{formatPrice(appt.total_price)}</span></div>
        <div><span className="text-brand-silver-dark block text-xs">Deposit Paid</span><span className="text-brand-blue">{formatPrice(appt.deposit_amount)}</span></div>
        <div><span className="text-brand-silver-dark block text-xs">Balance Due</span><span className="text-brand-blue font-semibold">{formatPrice(appt.balance_due)}</span></div>
        <div><span className="text-brand-silver-dark block text-xs">Google Calendar</span><span className={appt.google_event_id ? 'text-green-400' : 'text-brand-silver-dark'}>{appt.google_event_id ? 'Synced' : 'Not synced'}</span></div>
      </div>

      <PurchaseDetails appt={appt} settings={settings} />

      {appt.balance_due > 0 && (
        <CollectPayment appt={appt} onChange={onChange} />
      )}

      <PaymentHistory apptId={appt.id} onChange={onChange} />

      {appt.balance_due === 0 && appt.deposit_paid && (
        <SendReceiptButton appt={appt} />
      )}

      <div>
        <label className="block text-sm text-brand-silver mb-2">Notes</label>
        <textarea className="input min-h-[80px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add internal notes about this job…" />
        <button onClick={saveNotes} className="btn-secondary !text-xs !mt-2 !px-4 !py-2" disabled={savingNotes}>{savingNotes ? 'Saving…' : 'Save Notes'}</button>
      </div>

      <div className="flex flex-wrap gap-2">
        {appt.deposit_paid && !appt.appointment_date && (
          <button onClick={() => onSchedule(appt.id)} className="btn-primary !text-xs !px-4 !py-2">Schedule</button>
        )}
        {appt.appointment_date && appt.status !== 'completed' && appt.status !== 'cancelled' && (
          <button onClick={() => onSchedule(appt.id)} className="btn-secondary !text-xs !px-4 !py-2">Reschedule</button>
        )}
        {appt.appointment_date && appt.status === 'confirmed' && (
          <button
            onClick={async () => {
              await updateStatus(appt.id, 'completed', onChange)
              if (appt.customer?.email) setShowReviewPrompt(true)
            }}
            className="btn-secondary !text-xs !px-4 !py-2 hover:!text-green-400"
          >Mark Complete</button>
        )}
        {appt.status === 'completed' && appt.customer?.email && !reviewResult && (
          <button onClick={() => setShowReviewPrompt(true)} className="btn-secondary !text-xs !px-4 !py-2">Send Review Request</button>
        )}
        {appt.status !== 'cancelled' && appt.status !== 'completed' && (
          <button onClick={async () => { await cancelAppt(appt, onChange) }} className="btn-secondary !text-xs !px-4 !py-2 hover:!text-red-400">Cancel</button>
        )}
        {appt.appointment_date && !appt.google_event_id && (
          <button onClick={retryGCal} className="btn-secondary !text-xs !px-4 !py-2">Retry Google Sync</button>
        )}
        {appt.appointment_date && appt.google_event_id && (
          <button onClick={retryGCal} className="btn-secondary !text-xs !px-4 !py-2">Update Google Event</button>
        )}
        <button onClick={() => setShowWorkOrder(true)} className="btn-secondary !text-xs !px-4 !py-2">Work Order</button>
        <a href={`mailto:${appt.customer?.email}`} className="btn-secondary !text-xs !px-4 !py-2">Email</a>
        <a href={`tel:${appt.customer?.phone}`} className="btn-secondary !text-xs !px-4 !py-2">Call</a>
      </div>

      {showReviewPrompt && !reviewResult && (
        <div className="p-4 rounded-lg border border-brand-blue/40 bg-brand-blue/5 space-y-3">
          <p className="text-sm text-white font-semibold">Send Review Request?</p>
          <p className="text-sm text-brand-silver">
            Email a review link to <span className="text-white">{appt.customer?.email}</span>.
            {!appt.customer?.email && <span className="text-amber-400">No email on file — cannot send.</span>}
          </p>
          <div className="flex gap-2">
            <button
              disabled={sendingReview}
              onClick={async () => {
                setSendingReview(true)
                const result = await sendReviewRequest(appt)
                setSendingReview(false)
                setReviewResult({ sent: !result.error, error: result.error })
                setShowReviewPrompt(false)
              }}
              className="btn-primary !text-xs !px-4 !py-2"
            >{sendingReview ? 'Sending…' : 'Yes, Send Email'}</button>
            <button onClick={() => setShowReviewPrompt(false)} className="btn-secondary !text-xs !px-4 !py-2">Skip</button>
          </div>
        </div>
      )}

      {reviewResult && (
        <div className={`p-3 rounded-lg text-sm ${reviewResult.sent ? 'bg-green-500/10 border border-green-500/30 text-green-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
          {reviewResult.sent ? 'Review request sent successfully.' : `Failed to send: ${reviewResult.error}`}
        </div>
      )}

      {showWorkOrder && (
        <WorkOrderModal appt={appt} settings={settings} onClose={() => setShowWorkOrder(false)} />
      )}
    </div>
  )
}

function tintScopeLabel(windshield: string | null): string {
  switch (windshield) {
    case 'brow': return 'Brow only'
    case 'full': return 'Full windshield'
    case 'brow_full': return 'Full windshield + brow'
    case 'none': return 'None'
    default: return 'Not specified'
  }
}

function PurchaseDetails({ appt, settings }: { appt: ApptRow; settings: BusinessSettings | null }) {
  const portWindowPrice = settings?.port_window_price ?? 2500
  const tintService = (appt.services || []).find((s) => s.slug === 'window_tint')
  const detailService = (appt.services || []).find((s) => s.slug === 'detailing')

  const tintScope = tintService?.tint_scope as any | undefined
  const tintRemoval = tintService?.tint_removal as string | null | undefined
  const detailScope = detailService?.detail_scope as any | undefined

  const hasTintDetails = tintService && (tintScope || tintRemoval)
  const hasDetailScope = detailService && detailScope

  if (!hasTintDetails && !hasDetailScope && (!appt.add_ons || appt.add_ons.length === 0)) return null

  return (
    <div className="p-3 rounded-lg bg-brand-muted/20 border border-brand-border space-y-3">
      <span className="text-brand-silver-dark block text-xs">Purchase Details</span>

      {hasTintDetails && (
        <div className="space-y-1 text-sm">
          <div className="text-white font-medium text-xs">Window Tint</div>
          {tintScope && (
            <div className="pl-3 space-y-0.5 text-brand-silver">
              <div className="flex justify-between"><span>Windshield</span><span className="text-white">{tintScopeLabel(tintScope.windshield)}</span></div>
              <div className="flex justify-between"><span>Rear Glass</span><span className="text-white">{tintScope.rear === true ? 'Yes' : tintScope.rear === false ? 'No' : 'Not specified'}</span></div>
              {tintScope.sideCount != null && <div className="flex justify-between"><span>Side Windows</span><span className="text-white">{tintScope.sideCount} window{tintScope.sideCount !== 1 ? 's' : ''}</span></div>}
              {tintScope.portCount != null && tintScope.portCount > 0 && <div className="flex justify-between"><span>Port Windows</span><span className="text-white">{tintScope.portCount} window{tintScope.portCount !== 1 ? 's' : ''} ({formatPrice(portWindowPrice * tintScope.portCount)})</span></div>}
            </div>
          )}
          {tintRemoval && (
            <div className="pl-3 flex justify-between text-brand-silver"><span>Tint Removal</span><span className="text-white">{tintRemoval === 'yes' ? 'Yes — old film needs removal' : 'No'}</span></div>
          )}
        </div>
      )}

      {hasDetailScope && (
        <div className="space-y-1 text-sm">
          <div className="text-white font-medium text-xs">Detailing</div>
          <div className="pl-3 space-y-0.5 text-brand-silver">
            <div className="flex justify-between"><span>Interior</span><span className="text-white">{detailScope.interior ? 'Yes' : 'No'}</span></div>
            <div className="flex justify-between"><span>Exterior</span><span className="text-white">{detailScope.exterior ? 'Yes' : 'No'}</span></div>
          </div>
        </div>
      )}

      {appt.add_ons && appt.add_ons.length > 0 && (
        <div className="space-y-1 text-sm">
          <div className="text-white font-medium text-xs">Add-Ons</div>
          <div className="pl-3 space-y-0.5 text-brand-silver">
            {appt.add_ons.map((a: any, i: number) => (
              <div key={i} className="flex justify-between">
                <span>{a.name}{a.quantity ? ` × ${a.quantity}` : ''}</span>
                <span className="text-white">{formatPrice(a.price)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-between pt-2 border-t border-brand-border text-sm">
        <span className="text-brand-silver">Total Price</span>
        <span className="text-white font-semibold">{formatPrice(appt.total_price)}</span>
      </div>
    </div>
  )
}

function WorkOrderModal({ appt, settings, onClose }: { appt: ApptRow; settings: BusinessSettings | null; onClose: () => void }) {
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ sent: boolean; error: string | null } | null>(null)
  const [emailTo, setEmailTo] = useState(settings?.email || '')

  const portWindowPrice = settings?.port_window_price ?? 2500
  const tintService = (appt.services || []).find((s) => s.slug === 'window_tint')
  const detailService = (appt.services || []).find((s) => s.slug === 'detailing')
  const tintScope = tintService?.tint_scope as any | undefined
  const tintRemoval = tintService?.tint_removal as string | null | undefined
  const detailScope = detailService?.detail_scope as any | undefined
  const vehicle = appt.vehicle ? `${appt.vehicle.year} ${appt.vehicle.make} ${appt.vehicle.model}` : ''
  const customerName = `${appt.customer?.first_name || ''} ${appt.customer?.last_name || ''}`.trim()
  const orderId = appt.id.slice(0, 8).toUpperCase()

  const handlePrint = () => { window.print() }

  const handleEmail = async () => {
    if (!emailTo.trim()) { setResult({ sent: false, error: 'Enter an email address' }); return }
    setSending(true)
    setResult(null)
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      const lineItems: { label: string; price: number }[] = []
      ;(appt.services || []).forEach((s) => {
        if (s.slug === 'window_tint' && s.base_price != null) {
          if (tintScope?.windshield === 'full' || tintScope?.windshield === 'brow_full') lineItems.push({ label: 'Windshield tint', price: s.base_price })
          if (tintScope?.windshield === 'brow' || tintScope?.windshield === 'brow_full') lineItems.push({ label: 'Windshield brow', price: 0 })
          if (tintScope?.rear === true) lineItems.push({ label: 'Rear glass tint', price: 0 })
          if (tintScope?.sideCount) lineItems.push({ label: `Side windows × ${tintScope.sideCount}`, price: 0 })
          if (tintScope?.portCount) lineItems.push({ label: `Port windows × ${tintScope.portCount}`, price: portWindowPrice * tintScope.portCount })
        } else if (s.slug === 'detailing') {
          lineItems.push({ label: `Detailing${detailScope?.interior ? ' (Interior)' : ''}${detailScope?.exterior ? ' (Exterior)' : ''}`, price: s.base_price || 0 })
        } else {
          lineItems.push({ label: s.name, price: s.base_price || 0 })
        }
      })
      ;(appt.add_ons || []).forEach((a: any) => {
        lineItems.push({ label: `${a.name}${a.quantity ? ` × ${a.quantity}` : ''}`, price: a.price || 0 })
      })

      const res = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'work_order',
          payload: {
            customer_name: customerName,
            customer_email: emailTo.trim(),
            customer_phone: appt.customer?.phone || '',
            vehicle,
            order_id: orderId,
            line_items: lineItems,
            total_price: appt.total_price,
            deposit_amount: appt.deposit_amount,
            balance_due: appt.balance_due,
            notes: appt.notes || '',
            appointment_date: appt.appointment_date,
          },
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setResult({ sent: false, error: err.error || 'Failed to send email' })
      } else {
        setResult({ sent: true, error: null })
      }
    } catch (e: any) {
      setResult({ sent: false, error: e.message || 'Network error' })
    }
    setSending(false)
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto bg-card-gradient" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6 print:hidden">
          <h3 className="text-xl font-semibold text-white">Work Order #{orderId}</h3>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint} className="btn-secondary !text-xs !px-4 !py-2">Print</button>
            <button onClick={handleEmail} disabled={sending} className="btn-primary !text-xs !px-4 !py-2">{sending ? 'Sending…' : 'Email'}</button>
            <button onClick={onClose} className="text-brand-silver-dark hover:text-white transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" /></svg>
            </button>
          </div>
        </div>

        {result && (
          <div className={`mb-4 p-3 rounded-lg text-sm print:hidden ${result.sent ? 'bg-green-500/10 border border-green-500/30 text-green-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
            {result.sent ? `Work order emailed to ${emailTo}.` : `Failed: ${result.error}`}
          </div>
        )}

        <div className="mb-4 print:hidden">
          <label className="block text-xs text-brand-silver-dark mb-1">Email to</label>
          <input type="email" className="input !py-2 !text-sm" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="admin@example.com" />
        </div>

        <div className="print:block">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-brand-border print-border-b">
            <img src="/images/London_icon.png" alt="London Tint & Detail" className="h-12 w-12 object-contain" />
            <div>
              <div className="text-white font-semibold text-lg print-heading">London Tint & Detail</div>
              <div className="text-brand-silver-dark text-xs print-sub">{settings?.address || ''} · {settings?.phone || ''}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
            <div>
              <span className="text-brand-silver-dark block text-xs mb-1 print-label">Customer</span>
              <span className="text-white print-value">{customerName}</span>
              <div className="text-brand-silver text-xs mt-1 print-sub">{appt.customer?.phone}</div>
              <div className="text-brand-silver text-xs print-sub">{appt.customer?.email || ''}</div>
            </div>
            <div>
              <span className="text-brand-silver-dark block text-xs mb-1 print-label">Vehicle</span>
              <span className="text-white print-value">{vehicle}</span>
              {appt.appointment_date && <div className="text-brand-silver text-xs mt-1 print-sub">{formatDate(appt.appointment_date)} at {formatTime(appt.appointment_date)}</div>}
            </div>
          </div>

          <div className="space-y-2 mb-6">
            <div className="text-brand-silver-dark text-xs print-label">Services & Items</div>
            <div className="rounded-lg border border-brand-border overflow-hidden print-border">
              {(appt.services || []).map((s, i) => (
                <div key={`svc-${i}`} className="p-3 border-b border-brand-border last:border-b-0 print-border-b">
                  <div className="flex justify-between items-start">
                    <span className="text-white font-medium text-sm print-value">{s.name}</span>
                    {s.base_price != null && <span className="text-white text-sm print-value">{formatPrice(s.base_price)}</span>}
                  </div>
                  {s.slug === 'window_tint' && tintScope && (
                    <div className="mt-2 pl-3 space-y-1 text-xs text-brand-silver print-sub">
                      <div className="flex justify-between"><span>Windshield</span><span className="text-white print-value">{tintScopeLabel(tintScope.windshield)}</span></div>
                      <div className="flex justify-between"><span>Rear Glass</span><span className="text-white print-value">{tintScope.rear === true ? 'Yes' : 'No'}</span></div>
                      {tintScope.sideCount != null && <div className="flex justify-between"><span>Side Windows</span><span className="text-white print-value">{tintScope.sideCount}</span></div>}
                      {tintScope.portCount != null && tintScope.portCount > 0 && <div className="flex justify-between"><span>Port Windows</span><span className="text-white print-value">{tintScope.portCount} ({formatPrice(portWindowPrice * tintScope.portCount)})</span></div>}
                      {tintRemoval && <div className="flex justify-between"><span>Tint Removal</span><span className="text-white print-value">{tintRemoval === 'yes' ? 'Yes' : 'No'}</span></div>}
                    </div>
                  )}
                  {s.slug === 'detailing' && detailScope && (
                    <div className="mt-2 pl-3 space-y-1 text-xs text-brand-silver print-sub">
                      <div className="flex justify-between"><span>Interior</span><span className="text-white print-value">{detailScope.interior ? 'Yes' : 'No'}</span></div>
                      <div className="flex justify-between"><span>Exterior</span><span className="text-white print-value">{detailScope.exterior ? 'Yes' : 'No'}</span></div>
                    </div>
                  )}
                </div>
              ))}
              {(appt.add_ons || []).map((a: any, i: number) => (
                <div key={`addon-${i}`} className="p-3 border-b border-brand-border last:border-b-0 flex justify-between items-center print-border-b">
                  <span className="text-brand-silver text-sm print-value">{a.name}{a.quantity ? ` × ${a.quantity}` : ''}</span>
                  <span className="text-white text-sm print-value">{formatPrice(a.price)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2 mb-6">
            <div className="flex justify-between text-sm"><span className="text-brand-silver print-sub">Total Price</span><span className="text-white font-semibold print-total">{formatPrice(appt.total_price)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-brand-silver print-sub">Deposit Paid</span><span className="text-brand-blue print-total">{formatPrice(appt.deposit_amount)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-brand-silver print-sub">Balance Due</span><span className="text-brand-blue font-semibold print-total">{formatPrice(appt.balance_due)}</span></div>
          </div>

          {appt.notes && (
            <div className="mb-6">
              <div className="text-brand-silver-dark text-xs mb-1 print-label">Notes</div>
              <div className="text-sm text-brand-silver p-3 rounded-lg bg-brand-muted/20 border border-brand-border print-border print-sub">{appt.notes}</div>
            </div>
          )}

          <div className="text-center text-brand-silver-dark text-xs pt-4 border-t border-brand-border print-border-t print-sub">
            Work Order #{orderId} · Generated {new Date().toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
  )
}

async function updateStatus(id: string, status: string, onChange: () => void) {
  await supabase.from('appointments').update({ status }).eq('id', id)
  onChange()
}

const SQUARE_APP_ID = import.meta.env.VITE_SQUARE_APPLICATION_ID as string | undefined
const SQUARE_LOCATION_ID = import.meta.env.VITE_SQUARE_LOCATION_ID as string | undefined

function CollectPayment({ appt, onChange }: { appt: ApptRow; onChange: () => void }) {
  const [showOptions, setShowOptions] = useState(false)
  const [showNewCard, setShowNewCard] = useState(false)
  const [showDiscount, setShowDiscount] = useState(false)
  const [showCashConfirm, setShowCashConfirm] = useState(false)
  const [discountAmount, setDiscountAmount] = useState('')
  const [discountReason, setDiscountReason] = useState('')
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [cardInstance, setCardInstance] = useState<any>(null)
  const [cardError, setCardError] = useState<string | null>(null)
  const [linkSending, setLinkSending] = useState(false)

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  const callSquare = async (path: string, payload: any) => {
    const res = await fetch(`${supabaseUrl}/functions/v1/square`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, ...payload }),
    })
    if (!res.ok) throw new Error(`Server error (${res.status})`)
    return res.json()
  }

  const chargeCardOnFile = async () => {
    setProcessing(true)
    setResult(null)
    try {
      const data = await callSquare('/charge-card-on-file', { amount: appt.balance_due, appointment_id: appt.id })
      if (data.error) {
        setResult({ success: false, message: typeof data.error === 'string' ? data.error : 'Charge failed' })
      } else {
        setResult({ success: true, message: `Charged ${formatPrice(appt.balance_due)} to card on file.` })
        onChange()
      }
    } catch (e: any) {
      setResult({ success: false, message: e.message || 'Network error' })
    }
    setProcessing(false)
  }

  const initNewCard = async () => {
    if (!window.Square || !SQUARE_APP_ID || !SQUARE_LOCATION_ID) {
      setCardError('Square payment form unavailable. Check configuration.')
      return
    }
    setCardError(null)
    try {
      const payments = await window.Square.payments(SQUARE_APP_ID, SQUARE_LOCATION_ID)
      const card = await payments.card()
      await card.attach('#new-card-container')
      setCardInstance(card)
    } catch (e: any) {
      setCardError(e.message || 'Failed to load card form')
    }
  }

  const processNewCard = async () => {
    if (!cardInstance) return
    setProcessing(true)
    setResult(null)
    try {
      const tokenResult = await cardInstance.tokenize()
      if (tokenResult.errors) {
        setCardError(tokenResult.errors.map((e: any) => e.detail || e.message).join('; '))
        setProcessing(false)
        return
      }
      const data = await callSquare('/create-balance-payment', {
        amount: appt.balance_due,
        appointment_id: appt.id,
        source_id: tokenResult.token,
      })
      if (data.error) {
        setResult({ success: false, message: typeof data.error === 'string' ? data.error : 'Payment failed' })
      } else {
        setResult({ success: true, message: `Charged ${formatPrice(appt.balance_due)} to new card.` })
        setShowNewCard(false)
        await cardInstance.destroy()
        setCardInstance(null)
        onChange()
      }
    } catch (e: any) {
      setResult({ success: false, message: e.message || 'Network error' })
    }
    setProcessing(false)
  }

  const sendPaymentLink = async () => {
    if (!appt.customer?.email) {
      setResult({ success: false, message: 'No customer email on file — add their email to send a link.' })
      return
    }
    setLinkSending(true)
    setResult(null)
    try {
      const siteUrl = window.location.origin
      const vehicle = appt.vehicle ? `${appt.vehicle.year} ${appt.vehicle.make} ${appt.vehicle.model}` : ''
      const customerName = `${appt.customer?.first_name || ''} ${appt.customer?.last_name || ''}`.trim()
      const services = (appt.services || []).map((s) => s.name).join(', ') || 'Service'

      const { data: tokenRow } = await supabase.from('payment_tokens').insert({
        appointment_id: appt.id,
        amount: appt.balance_due,
        customer_name: customerName,
        customer_email: appt.customer.email,
        vehicle,
        services,
      }).select('id').single()

      if (!tokenRow) {
        setResult({ success: false, message: 'Failed to create payment link.' })
        setLinkSending(false)
        return
      }

      const payUrl = `${siteUrl}/pay?token=${tokenRow.id}`

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'payment_link',
          payload: { customer_name: customerName, customer_email: appt.customer.email, vehicle, services, balance_due: appt.balance_due, pay_url: payUrl },
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setResult({ success: false, message: err.error || 'Failed to send email' })
      } else {
        setResult({ success: true, message: `Payment link sent to ${appt.customer.email}.` })
        setShowOptions(false)
      }
    } catch (e: any) {
      setResult({ success: false, message: e.message || 'Network error' })
    }
    setLinkSending(false)
  }

  const copyPaymentLink = async () => {
    const siteUrl = window.location.origin
    const vehicle = appt.vehicle ? `${appt.vehicle.year} ${appt.vehicle.make} ${appt.vehicle.model}` : ''
    const customerName = `${appt.customer?.first_name || ''} ${appt.customer?.last_name || ''}`.trim()
    const services = (appt.services || []).map((s) => s.name).join(', ') || 'Service'

    const { data: tokenRow } = await supabase.from('payment_tokens').insert({
      appointment_id: appt.id,
      amount: appt.balance_due,
      customer_name: customerName,
      customer_email: appt.customer?.email || '',
      vehicle,
      services,
    }).select('id').single()

    if (!tokenRow) {
      setResult({ success: false, message: 'Failed to create payment link.' })
      return
    }

    const payUrl = `${siteUrl}/pay?token=${tokenRow.id}`
    try {
      await navigator.clipboard.writeText(payUrl)
      setResult({ success: true, message: 'Payment link copied to clipboard.' })
      setShowOptions(false)
    } catch {
      setResult({ success: true, message: `Link: ${payUrl}` })
    }
  }

  const recordCash = async () => {
    setProcessing(true)
    setResult(null)
    try {
      const data = await callSquare('/record-cash-payment', { amount: appt.balance_due, appointment_id: appt.id })
      if (data.error) {
        setResult({ success: false, message: 'Failed to record cash payment' })
      } else {
        setResult({ success: true, message: `Recorded ${formatPrice(appt.balance_due)} cash payment.` })
        setShowCashConfirm(false)
        onChange()
      }
    } catch (e: any) {
      setResult({ success: false, message: e.message || 'Network error' })
    }
    setProcessing(false)
  }

  const recordDiscount = async () => {
    const cents = Math.round(parseFloat(discountAmount || '0') * 100)
    if (cents <= 0 || cents > appt.balance_due) {
      setResult({ success: false, message: 'Discount must be greater than 0 and at most the balance due.' })
      return
    }
    setProcessing(true)
    setResult(null)
    try {
      const data = await callSquare('/record-discount', { amount: cents, appointment_id: appt.id, reason: discountReason })
      if (data.error) {
        setResult({ success: false, message: 'Failed to record discount' })
      } else {
        setResult({ success: true, message: `Applied ${formatPrice(cents)} discount.` })
        setShowDiscount(false)
        setDiscountAmount('')
        setDiscountReason('')
        onChange()
      }
    } catch (e: any) {
      setResult({ success: false, message: e.message || 'Network error' })
    }
    setProcessing(false)
  }

  return (
    <div className="p-4 rounded-lg border border-brand-blue/30 bg-brand-blue/5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-white font-semibold">Collect Payment</span>
        <span className="text-sm text-brand-blue font-semibold">{formatPrice(appt.balance_due)} due</span>
      </div>

      {!showOptions && !showNewCard && !showDiscount && !showCashConfirm && (
        <button onClick={() => setShowOptions(true)} className="btn-primary w-full !text-xs !py-2.5">Collect Balance</button>
      )}

      {showOptions && !showNewCard && !showDiscount && !showCashConfirm && (
        <div className="space-y-2">
          {appt.square_card_id && (
            <button onClick={chargeCardOnFile} disabled={processing} className="btn-primary w-full !text-xs !py-2.5 flex items-center justify-between">
              <span>Charge Card on File</span>
              <span className="opacity-80">{formatPrice(appt.balance_due)}</span>
            </button>
          )}
          <button onClick={() => { setShowOptions(false); setShowNewCard(true); initNewCard() }} className="btn-secondary w-full !text-xs !py-2.5">Enter New Card</button>
          <button onClick={() => { setShowOptions(false); setShowCashConfirm(true) }} className="btn-secondary w-full !text-xs !py-2.5">Record Cash Payment</button>
          <button onClick={() => { setShowOptions(false); setShowDiscount(true) }} className="btn-secondary w-full !text-xs !py-2.5">Record Discount</button>
          <button onClick={sendPaymentLink} disabled={linkSending} className="btn-secondary w-full !text-xs !py-2.5">{linkSending ? 'Sending…' : 'Send Payment Link'}</button>
          <button onClick={copyPaymentLink} className="btn-secondary w-full !text-xs !py-2.5">Copy Payment Link</button>
          <button onClick={() => setShowOptions(false)} className="text-brand-silver-dark text-xs hover:text-white transition-colors w-full text-center">Cancel</button>
        </div>
      )}

      {showNewCard && (
        <div className="space-y-3">
          <p className="text-xs text-brand-silver">Enter customer's card details:</p>
          <div id="new-card-container" />
          {cardError && <div className="text-xs text-red-400">{cardError}</div>}
          <div className="flex gap-2">
            <button onClick={processNewCard} disabled={processing} className="btn-primary flex-1 !text-xs !py-2.5">{processing ? 'Processing…' : `Charge ${formatPrice(appt.balance_due)}`}</button>
            <button onClick={async () => { if (cardInstance) { await cardInstance.destroy(); setCardInstance(null) }; setShowNewCard(false); setShowOptions(true) }} className="btn-secondary !text-xs !px-4">Back</button>
          </div>
        </div>
      )}

      {showCashConfirm && (
        <div className="space-y-3">
          <p className="text-sm text-white">Record <span className="text-brand-blue font-semibold">{formatPrice(appt.balance_due)}</span> as cash collected from the customer?</p>
          <div className="flex gap-2">
            <button onClick={recordCash} disabled={processing} className="btn-primary flex-1 !text-xs !py-2.5">{processing ? 'Recording…' : 'Yes, Record Cash'}</button>
            <button onClick={() => { setShowCashConfirm(false); setShowOptions(true) }} className="btn-secondary !text-xs !px-4">Back</button>
          </div>
        </div>
      )}

      {showDiscount && (
        <div className="space-y-3">
          <p className="text-xs text-brand-silver">Apply a discount to reduce the balance:</p>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-silver-dark">$</span>
            <input type="text" inputMode="decimal" className="input pl-7" placeholder="0.00" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value.replace(/[^0-9.]/g, ''))} />
          </div>
          <input type="text" className="input" placeholder="Reason (optional)" value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} />
          <div className="flex gap-2">
            <button onClick={recordDiscount} disabled={processing} className="btn-primary flex-1 !text-xs !py-2.5">{processing ? 'Applying…' : 'Apply Discount'}</button>
            <button onClick={() => { setShowDiscount(false); setShowOptions(true) }} className="btn-secondary !text-xs !px-4">Back</button>
          </div>
        </div>
      )}

      {result && (
        <div className={`p-3 rounded-lg text-sm ${result.success ? 'bg-green-500/10 border border-green-500/30 text-green-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
          {result.message}
        </div>
      )}
    </div>
  )
}

function PaymentHistory({ apptId, onChange }: { apptId: string; onChange?: () => void }) {
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [voiding, setVoiding] = useState<string | null>(null)

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const { data } = await supabase.from('payments')
        .select('id, amount, status, payment_type, payment_method, created_at')
        .eq('appointment_id', apptId)
        .order('created_at', { ascending: true })
      if (mounted) { setPayments(data || []); setLoading(false) }
    }
    load()
    return () => { mounted = false }
  }, [apptId])

  const voidPayment = async (paymentId: string, amount: number, method: string) => {
    if (!confirm(`Void this ${method} payment of ${formatPrice(amount)} and restore the balance?`)) return
    setVoiding(paymentId)
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/square`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: '/void-payment', payment_id: paymentId, appointment_id: apptId }),
      })
      const data = await res.json()
      if (data.error) {
        alert(typeof data.error === 'string' ? data.error : 'Failed to void payment')
      } else {
        // Refresh payment list
        const { data: fresh } = await supabase.from('payments')
          .select('id, amount, status, payment_type, payment_method, created_at')
          .eq('appointment_id', apptId)
          .order('created_at', { ascending: true })
        setPayments(fresh || [])
        if (onChange) onChange()
      }
    } catch (e: any) {
      alert(e.message || 'Network error')
    }
    setVoiding(null)
  }

  if (loading || payments.length === 0) return null

  const methodLabel = (m: string) => {
    switch (m) {
      case 'square': return 'Card (Square)'
      case 'cash': return 'Cash'
      case 'card_on_file': return 'Card on File'
      case 'discount': return 'Discount'
      default: return m
    }
  }
  const typeLabel = (t: string) => {
    switch (t) {
      case 'deposit': return 'Deposit'
      case 'balance': return 'Balance'
      case 'discount': return 'Discount'
      default: return t
    }
  }

  return (
    <div className="space-y-2">
      <span className="text-brand-silver-dark block text-xs">Payment History</span>
      <div className="space-y-1">
        {payments.map((p) => (
          <div key={p.id} className="flex items-center justify-between text-xs p-2 rounded-md bg-brand-muted/20 border border-brand-border">
            <span className="text-brand-silver">{typeLabel(p.payment_type)} — {methodLabel(p.payment_method)}</span>
            <div className="flex items-center gap-2">
              <span className={p.status === 'voided' ? 'text-brand-silver-dark line-through' : 'text-white'}>{formatPrice(p.amount)}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-badge tracking-wider uppercase ${p.status === 'completed' ? 'bg-green-500/20 text-green-400' : p.status === 'refunded' ? 'bg-red-500/20 text-red-400' : p.status === 'voided' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>{p.status}</span>
              {p.status === 'completed' && (p.payment_method === 'cash' || p.payment_method === 'discount') && (
                <button
                  onClick={() => voidPayment(p.id, p.amount, p.payment_method)}
                  disabled={voiding === p.id}
                  className="text-[10px] text-brand-silver-dark hover:text-red-400 transition-colors px-1"
                  title="Void this payment"
                >
                  {voiding === p.id ? '…' : 'Void'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SendReceiptButton({ appt }: { appt: ApptRow }) {
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ sent: boolean; error: string | null } | null>(null)

  const sendReceipt = async () => {
    if (!appt.customer?.email) { setResult({ sent: false, error: 'No email on file' }); return }
    setSending(true)
    setResult(null)

    const { data: payments } = await supabase.from('payments')
      .select('amount, payment_type, payment_method, status')
      .eq('appointment_id', appt.id)
      .in('status', ['completed'])
      .order('created_at', { ascending: true })

    const depositPaid = (payments || []).filter((p: any) => p.payment_type === 'deposit').reduce((s: number, p: any) => s + p.amount, 0)
    const balancePaid = (payments || []).filter((p: any) => p.payment_type === 'balance').reduce((s: number, p: any) => s + p.amount, 0)
    const discountAmount = (payments || []).filter((p: any) => p.payment_type === 'discount').reduce((s: number, p: any) => s + p.amount, 0)
    const totalPaid = depositPaid + balancePaid

    if (totalPaid === 0) {
      setResult({ sent: false, error: 'No completed payments to receipt' })
      setSending(false)
      return
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    const siteUrl = window.location.origin
    const vehicle = appt.vehicle ? `${appt.vehicle.year} ${appt.vehicle.make} ${appt.vehicle.model}` : ''
    const customerName = `${appt.customer?.first_name || ''} ${appt.customer?.last_name || ''}`.trim()
    const services = (appt.services || []).map((s) => s.name).join(', ') || 'Service'
    const receiptId = appt.id.slice(0, 8).toUpperCase()

    const res = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'payment_receipt',
        payload: {
          customer_name: customerName,
          customer_email: appt.customer.email,
          vehicle,
          services,
          deposit_amount: depositPaid,
          balance_paid: balancePaid,
          discount_amount: discountAmount,
          total_paid: totalPaid,
          payment_date: new Date().toISOString(),
          receipt_id: receiptId,
          site_url: siteUrl,
        },
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      setResult({ sent: false, error: err.error || 'Failed to send receipt' })
    } else {
      setResult({ sent: true, error: null })
    }
    setSending(false)
  }

  if (!appt.customer?.email) return null

  return (
    <div>
      <button onClick={sendReceipt} disabled={sending} className="btn-secondary !text-xs !px-4 !py-2">
        {sending ? 'Sending…' : 'Send Paid Receipt'}
      </button>
      {result && (
        <div className={`mt-2 p-3 rounded-lg text-sm ${result.sent ? 'bg-green-500/10 border border-green-500/30 text-green-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
          {result.sent ? 'Receipt sent to customer.' : `Failed: ${result.error}`}
        </div>
      )}
    </div>
  )
}

async function cancelAppt(a: ApptRow, onChange: () => void) {
  const gcalNote = a.google_event_id ? ' This will also remove it from Google Calendar.' : ''
  if (!confirm(`Cancel this appointment?${gcalNote}`)) return
  await supabase.from('appointments').update({ status: 'cancelled', appointment_date: null, assigned_bay: null }).eq('id', a.id)
  if (a.google_event_id) {
    await syncToGoogleCalendar('delete', { appointment_id: a.id, google_event_id: a.google_event_id })
  }
  onChange()
}

function ScheduleModal({ appt, settings, pricingRules, allAppts, onClose, onDone }: {
  appt: ApptRow
  settings: BusinessSettings
  pricingRules: PricingRuleRow[]
  allAppts: ApptRow[]
  onClose: () => void
  onDone: () => void
}) {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [gcalError, setGcalError] = useState<string | null>(null)

  const duration = getDurationForAppt(appt, pricingRules)
  const dateObj = new Date(selectedDate + 'T00:00:00')

  const occupied = allAppts
    .filter((a) => a.id !== appt.id && a.appointment_date && a.status !== 'cancelled' && a.status !== 'completed')
    .map((a) => {
      const start = new Date(a.appointment_date!)
      const dur = getDurationForAppt(a, pricingRules)
      const end = new Date(start.getTime() + dur * 3600000)
      return { start: start.toISOString(), end: end.toISOString(), bay: a.assigned_bay }
    })

  const slots = computeAvailableSlots(dateObj, duration, settings, occupied)
  const slotsByTime = new Map<string, AvailableSlot[]>()
  slots.forEach((s) => {
    const key = s.start.toISOString()
    if (!slotsByTime.has(key)) slotsByTime.set(key, [])
    slotsByTime.get(key)!.push(s)
  })

  const save = async () => {
    if (!selectedSlot) return
    setSaving(true); setError(null); setGcalError(null)
    const startISO = selectedSlot.start.toISOString()
    const endISO = selectedSlot.end.toISOString()
    const { error: ue } = await supabase.from('appointments')
      .update({ appointment_date: startISO, assigned_bay: selectedSlot.bay, status: 'confirmed' })
      .eq('id', appt.id)
    if (ue) { setError(ue.message); setSaving(false); return }

    const gcalPayload = buildGCalPayload(appt, startISO, endISO)
    const action = appt.google_event_id ? 'update' : 'create'
    const result = await syncToGoogleCalendar(action, gcalPayload)
    if (result.error) {
      setGcalError(`Saved to database, but Google Calendar sync failed: ${result.error}. You can retry from the appointment detail.`)
    }
    setSaving(false)
    onDone()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="card p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto bg-card-gradient" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-white">Schedule Appointment</h3>
          <button onClick={onClose} className="text-brand-silver-dark hover:text-white transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div className="mb-4 p-3 rounded-md bg-brand-muted/30 border border-brand-border text-sm">
          <div className="text-white font-medium">{(appt.services || []).map((s) => s.name).join(', ')}</div>
          <div className="text-brand-silver">{appt.customer?.first_name} {appt.customer?.last_name} — {appt.vehicle?.year} {appt.vehicle?.make} {appt.vehicle?.model}</div>
          <div className="text-brand-silver-dark mt-1">Duration: {formatDuration(duration)} · Bays: {settings.bays}</div>
        </div>
        <div className="mb-4">
          <label className="block text-sm text-brand-silver mb-2">Date</label>
          <input type="date" className="input" value={selectedDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => { setSelectedDate(e.target.value); setSelectedSlot(null) }} />
        </div>
        {slots.length === 0 ? (
          <div className="card p-6 text-center text-brand-silver bg-brand-muted/20">No available slots on this day. The shop may be closed or fully booked.</div>
        ) : (
          <div className="mb-4">
            <label className="block text-sm text-brand-silver mb-2">Available Time Slots</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
              {Array.from(slotsByTime.entries()).map(([key, baySlots]) => {
                const time = new Date(key)
                const isSelected = selectedSlot?.start.toISOString() === key
                return (
                  <button key={key} onClick={() => setSelectedSlot(baySlots[0])}
                    className={`p-2 rounded-md text-sm transition-all ${isSelected ? 'bg-brand-blue text-white' : 'bg-brand-muted/40 text-brand-silver border border-brand-border hover:border-brand-blue hover:text-white'}`}>
                    {formatTime(time)}
                    <span className="block text-[10px] opacity-70">{baySlots.length} bay{baySlots.length > 1 ? 's' : ''}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
        {selectedSlot && (
          <div className="mb-4 p-3 rounded-md bg-brand-blue/10 border border-brand-blue/30 text-sm">
            <div className="text-white"><span className="text-brand-silver">Start:</span> {formatDate(selectedSlot.start)} at {formatTime(selectedSlot.start)}</div>
            <div className="text-white"><span className="text-brand-silver">End:</span> {formatTime(selectedSlot.end)}</div>
            <div className="text-white"><span className="text-brand-silver">Bay:</span> {selectedSlot.bay}</div>
          </div>
        )}
        {error && <div className="mb-4 p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>}
        {gcalError && <div className="mb-4 p-3 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">{gcalError}</div>}
        <div className="flex flex-col sm:flex-row gap-2">
          <button onClick={save} className="btn-primary flex-1" disabled={!selectedSlot || saving}>{saving ? 'Saving…' : 'Confirm & Sync to Google Calendar'}</button>
          <button onClick={onClose} className="btn-secondary sm:flex-none">Cancel</button>
        </div>
      </div>
    </div>
  )
}

async function sendReviewRequest(appt: ApptRow) {
  const customerEmail = appt.customer?.email
  if (!customerEmail) return { error: 'No email on file for this customer.' }

  const vehicle = appt.vehicle ? `${appt.vehicle.year} ${appt.vehicle.make} ${appt.vehicle.model}` : ''
  const customerName = `${appt.customer?.first_name || ''} ${appt.customer?.last_name || ''}`.trim()

  const { data: token, error: te } = await supabase.from('review_tokens').insert({
    appointment_id: appt.id,
    customer_name: customerName,
    vehicle,
    customer_email: customerEmail,
  }).select('id').maybeSingle()

  if (te || !token) return { error: te?.message || 'Could not create review token.' }

  const { data: settings } = await supabase.from('business_settings').select('google_review_url').eq('id', 1).maybeSingle()
  const googleReviewUrl = settings?.google_review_url || null

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  const siteUrl = window.location.origin

  const res = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'review_request',
      payload: { customer_email: customerEmail, customer_name: customerName, vehicle, token_id: token.id, site_url: siteUrl, google_review_url: googleReviewUrl },
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    return { error: err.error || 'Failed to send email.' }
  }
  return { error: null }
}

function DetailModal({ appt, settings, pricingRules, allAppts, onClose, onChange }: {
  appt: ApptRow
  settings: BusinessSettings | null
  pricingRules: PricingRuleRow[]
  allAppts: ApptRow[]
  onClose: () => void
  onChange: () => void
}) {
  const [notes, setNotes] = useState(appt.notes || '')
  const [savingNotes, setSavingNotes] = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)
  const [showReviewPrompt, setShowReviewPrompt] = useState(false)
  const [sendingReview, setSendingReview] = useState(false)
  const [reviewResult, setReviewResult] = useState<{ sent: boolean; error: string | null } | null>(null)

  const duration = getDurationForAppt(appt, pricingRules)

  if (showSchedule && settings) {
    return (
      <ScheduleModal
        appt={appt}
        settings={settings}
        pricingRules={pricingRules}
        allAppts={allAppts}
        onClose={() => setShowSchedule(false)}
        onDone={() => { setShowSchedule(false); onChange() }}
      />
    )
  }

  const saveNotes = async () => {
    setSavingNotes(true)
    await supabase.from('appointments').update({ notes }).eq('id', appt.id)
    setSavingNotes(false)
  }

  const retryGCal = async () => {
    if (!appt.appointment_date) return
    const start = new Date(appt.appointment_date)
    const end = new Date(start.getTime() + duration * 3600000)
    const payload = buildGCalPayload(appt, start.toISOString(), end.toISOString())
    const action = appt.google_event_id ? 'update' : 'create'
    const result = await syncToGoogleCalendar(action, payload)
    if (result.error) {
      alert('Google Calendar sync failed: ' + result.error)
    } else {
      alert('Synced to Google Calendar successfully.')
      onChange()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="card p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto bg-card-gradient" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-white">Appointment Details</h3>
          <button onClick={onClose} className="text-brand-silver-dark hover:text-white transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div className="space-y-3 text-sm mb-4">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <span className={`text-xs px-2 py-1 rounded-full font-badge font-semibold tracking-wider uppercase ${statusBadgeClass(appt.status)}`}>{appt.status}</span>
            <span className="text-white font-semibold text-sm sm:text-base">{(appt.services || []).map((s) => s.name).join(', ')}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><span className="text-brand-silver-dark block text-xs">Customer</span><span className="text-white">{appt.customer?.first_name} {appt.customer?.last_name}</span></div>
            <div><span className="text-brand-silver-dark block text-xs">Phone</span><a href={`tel:${appt.customer?.phone}`} className="text-brand-blue">{appt.customer?.phone}</a></div>
            <div><span className="text-brand-silver-dark block text-xs">Email</span><a href={`mailto:${appt.customer?.email}`} className="text-brand-blue break-all">{appt.customer?.email || '—'}</a></div>
            <div><span className="text-brand-silver-dark block text-xs">Vehicle</span><span className="text-white">{appt.vehicle?.year} {appt.vehicle?.make} {appt.vehicle?.model}</span></div>
            <div><span className="text-brand-silver-dark block text-xs">When</span><span className="text-white">{appt.appointment_date ? `${formatDate(appt.appointment_date)} ${formatTime(appt.appointment_date)}` : 'Unscheduled'}</span></div>
            {appt.assigned_bay !== null && <div><span className="text-brand-silver-dark block text-xs">Bay</span><span className="text-white">Bay {appt.assigned_bay}</span></div>}
            <div><span className="text-brand-silver-dark block text-xs">Duration</span><span className="text-white">{formatDuration(duration)}</span></div>
            <div><span className="text-brand-silver-dark block text-xs">Total Price</span><span className="text-white">{formatPrice(appt.total_price)}</span></div>
            <div><span className="text-brand-silver-dark block text-xs">Deposit Paid</span><span className="text-brand-blue">{formatPrice(appt.deposit_amount)}</span></div>
            <div><span className="text-brand-silver-dark block text-xs">Balance Due</span><span className="text-brand-blue font-semibold">{formatPrice(appt.balance_due)}</span></div>
            <div><span className="text-brand-silver-dark block text-xs">Google Calendar</span><span className={appt.google_event_id ? 'text-green-400' : 'text-brand-silver-dark'}>{appt.google_event_id ? 'Synced' : 'Not synced'}</span></div>
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-sm text-brand-silver mb-2">Notes</label>
          <textarea className="input min-h-[80px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add internal notes about this job…" />
          <button onClick={saveNotes} className="btn-secondary !text-xs !mt-2 !px-4 !py-2" disabled={savingNotes}>{savingNotes ? 'Saving…' : 'Save Notes'}</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {appt.deposit_paid && !appt.appointment_date && (
            <button onClick={() => setShowSchedule(true)} className="btn-primary !text-xs !px-4 !py-2">Schedule</button>
          )}
          {appt.appointment_date && appt.status !== 'completed' && appt.status !== 'cancelled' && (
            <button onClick={() => setShowSchedule(true)} className="btn-secondary !text-xs !px-4 !py-2">Reschedule</button>
          )}
          {appt.appointment_date && appt.status === 'confirmed' && (
            <button
              onClick={async () => {
                await updateStatus(appt.id, 'completed', onChange)
                if (appt.customer?.email) setShowReviewPrompt(true)
              }}
              className="btn-secondary !text-xs !px-4 !py-2 hover:!text-green-400"
            >Mark Complete</button>
          )}
          {appt.status === 'completed' && appt.customer?.email && !reviewResult && (
            <button onClick={() => setShowReviewPrompt(true)} className="btn-secondary !text-xs !px-4 !py-2">
              Send Review Request
            </button>
          )}
          {appt.status !== 'cancelled' && appt.status !== 'completed' && (
            <button onClick={async () => { await cancelAppt(appt, onChange) }} className="btn-secondary !text-xs !px-4 !py-2 hover:!text-red-400">Cancel</button>
          )}
          {appt.appointment_date && !appt.google_event_id && (
            <button onClick={retryGCal} className="btn-secondary !text-xs !px-4 !py-2">Retry Google Sync</button>
          )}
          {appt.appointment_date && appt.google_event_id && (
            <button onClick={retryGCal} className="btn-secondary !text-xs !px-4 !py-2">Update Google Event</button>
          )}
        </div>

        {showReviewPrompt && !reviewResult && (
          <div className="mt-4 p-4 rounded-lg border border-brand-blue/40 bg-brand-blue/5 space-y-3 animate-slide-up">
            <p className="text-sm text-white font-semibold">Send Review Request?</p>
            <p className="text-sm text-brand-silver">
              Email a review link to <span className="text-white">{appt.customer?.email}</span>.
              {!appt.customer?.email && <span className="text-amber-400">No email on file — cannot send.</span>}
            </p>
            <div className="flex gap-2">
              <button
                disabled={sendingReview}
                onClick={async () => {
                  setSendingReview(true)
                  const result = await sendReviewRequest(appt)
                  setSendingReview(false)
                  setReviewResult({ sent: !result.error, error: result.error })
                  setShowReviewPrompt(false)
                }}
                className="btn-primary !text-xs !px-4 !py-2"
              >{sendingReview ? 'Sending…' : 'Yes, Send Email'}</button>
              <button onClick={() => setShowReviewPrompt(false)} className="btn-secondary !text-xs !px-4 !py-2">Skip</button>
            </div>
          </div>
        )}

        {reviewResult && (
          <div className={`mt-4 p-3 rounded-lg text-sm ${reviewResult.sent ? 'bg-green-500/10 border border-green-500/30 text-green-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
            {reviewResult.sent ? 'Review request sent successfully.' : `Failed to send: ${reviewResult.error}`}
          </div>
        )}

      </div>
    </div>
  )
}

function CalendarView({ appts, settings, pricingRules, onChange }: {
  appts: ApptRow[]
  settings: BusinessSettings | null
  pricingRules: PricingRuleRow[]
  onChange: () => void
}) {
  const [month, setMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [scheduleForDay, setScheduleForDay] = useState<Date | null>(null)
  const [scheduleApptId, setScheduleApptId] = useState<string | null>(null)

  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0)
  const days: (Date | null)[] = []
  for (let i = 0; i < first.getDay(); i++) days.push(null)
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(month.getFullYear(), month.getMonth(), d))
  const byDay = new Map<string, ApptRow[]>()
  appts.forEach((a) => {
    if (!a.appointment_date || a.status === 'cancelled') return
    const k = new Date(a.appointment_date).toDateString()
    if (!byDay.has(k)) byDay.set(k, [])
    byDay.get(k)!.push(a)
  })

  const dayAppts = selectedDay ? (byDay.get(selectedDay.toDateString()) || []) : []
  const detailAppt = appts.find((a) => a.id === detailId) || null
  const scheduleAppt = appts.find((a) => a.id === scheduleApptId) || null
  const unscheduled = appts.filter((a) => !a.appointment_date && a.deposit_paid && a.status !== 'cancelled')

  return (
    <div>
      {detailAppt && (
        <DetailModal appt={detailAppt} settings={settings} pricingRules={pricingRules} allAppts={appts} onClose={() => setDetailId(null)} onChange={() => { setDetailId(null); onChange() }} />
      )}
      {scheduleAppt && settings && (
        <ScheduleModal appt={scheduleAppt} settings={settings} pricingRules={pricingRules} allAppts={appts} onClose={() => setScheduleApptId(null)} onDone={() => { setScheduleApptId(null); onChange() }} />
      )}
      <div className="flex items-center justify-between mb-6 gap-3">
        <h2 className="text-xl sm:text-2xl font-semibold text-white truncate">{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="btn-secondary !px-3 sm:!px-4 !py-2 !text-xs">←</button>
          <button onClick={() => setMonth(new Date())} className="btn-secondary !px-3 sm:!px-4 !py-2 !text-xs">Today</button>
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="btn-secondary !px-3 sm:!px-4 !py-2 !text-xs">→</button>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-3 sm:p-4 bg-card-gradient">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="text-center text-[10px] sm:text-xs text-brand-silver-dark font-badge tracking-wider py-2">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((d, i) => {
              if (!d) return <div key={i} className="min-h-[64px] sm:min-h-[80px] rounded-md bg-brand-muted/10" />
              const da = byDay.get(d.toDateString()) || []
              const isToday = d.toDateString() === new Date().toDateString()
              const isSelected = selectedDay?.toDateString() === d.toDateString()
              return (
                <button key={i} onClick={() => setSelectedDay(d)}
                  className={`min-h-[64px] sm:min-h-[80px] rounded-md p-1 sm:p-2 border text-left transition-all ${isSelected ? 'border-brand-blue bg-brand-blue/10' : isToday ? 'border-brand-blue/50 bg-brand-blue/5' : 'border-brand-border bg-brand-muted/20 hover:border-brand-blue/50'}`}>
                  <div className={`text-[10px] sm:text-xs mb-1 font-badge ${isToday ? 'text-brand-blue font-bold' : 'text-brand-silver-dark'}`}>{d.getDate()}</div>
                  <div className="space-y-0.5">
                    {da.slice(0, 3).map((a) => (
                      <div key={a.id} className={`text-[9px] sm:text-[10px] rounded px-1 py-0.5 truncate ${a.status === 'confirmed' ? 'bg-brand-blue/20 text-brand-blue' : a.status === 'completed' ? 'bg-green-500/20 text-green-400' : a.status === 'pending' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
                        {formatTime(a.appointment_date!)} {a.customer?.first_name}
                      </div>
                    ))}
                  </div>
                  {da.length > 3 && <div className="text-[9px] sm:text-[10px] text-brand-silver-dark">+{da.length - 3} more</div>}
                </button>
              )
            })}
          </div>
        </div>
        <div>
          {selectedDay ? (
            <div className="card p-4 bg-card-gradient">
              <h3 className="text-lg font-semibold text-white mb-4">{selectedDay.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
              {dayAppts.length === 0 ? (
                <p className="text-brand-silver-dark text-sm">No jobs scheduled.</p>
              ) : (
                <div className="space-y-2">
                  {dayAppts.sort((a, b) => new Date(a.appointment_date!).getTime() - new Date(b.appointment_date!).getTime()).map((a) => (
                    <button key={a.id} onClick={() => setDetailId(a.id)} className="w-full text-left p-3 rounded-md bg-brand-muted/30 border border-brand-border hover:border-brand-blue transition-all">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white text-sm font-medium">{formatTime(a.appointment_date!)}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-badge tracking-wider uppercase ${statusBadgeClass(a.status)}`}>{a.status}</span>
                      </div>
                      <div className="text-brand-silver text-sm">{(a.services || []).map((s) => s.name).join(', ')}</div>
                      <div className="text-brand-silver-dark text-xs">{a.customer?.first_name} {a.customer?.last_name} — {a.vehicle?.year} {a.vehicle?.make} {a.vehicle?.model}</div>
                      {a.assigned_bay !== null && <div className="text-brand-silver-dark text-xs mt-0.5">Bay {a.assigned_bay}</div>}
                    </button>
                  ))}
                </div>
              )}
              {unscheduled.length > 0 && (
                <div className="mt-4 pt-4 border-t border-brand-border">
                  <h4 className="text-sm text-brand-silver mb-2">Schedule a booking onto this day:</h4>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {unscheduled.map((a) => (
                      <button key={a.id} onClick={() => { setScheduleApptId(a.id); setScheduleForDay(selectedDay) }} className="w-full text-left p-2 rounded-md bg-brand-muted/20 border border-brand-border hover:border-brand-blue transition-all text-xs">
                        <div className="text-white">{a.customer?.first_name} {a.customer?.last_name}</div>
                        <div className="text-brand-silver-dark">{a.vehicle?.year} {a.vehicle?.make} {a.vehicle?.model}</div>
                        <div className="text-brand-silver-dark">{(a.services || []).map((s) => s.name).join(', ')}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="card p-6 bg-card-gradient text-center">
              <p className="text-brand-silver-dark text-sm">Click a day to see its jobs and schedule unscheduled bookings.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SettingsPanel({ settings, onUpdate }: { settings: BusinessSettings | null; onUpdate: () => void }) {
  const [form, setForm] = useState<BusinessSettings | null>(settings)
  const [flatDepositInput, setFlatDepositInput] = useState(() =>
    settings ? String(settings.flat_deposit_amount / 100) : ''
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showGcalHelp, setShowGcalHelp] = useState(false)
  useEffect(() => {
    setForm(settings)
    if (settings) setFlatDepositInput(String(settings.flat_deposit_amount / 100))
  }, [settings])

  const save = async () => {
    if (!form) return; setSaving(true)
    const flatCents = Math.round(parseFloat(flatDepositInput || '0') * 100)
    const formToSave = { ...form, flat_deposit_amount: flatCents }
    await supabase.from('business_settings').update({
      business_name: form.business_name, phone: form.phone, email: form.email, address: form.address, maps_url: form.maps_url,
      hours_monday: form.hours_monday, hours_tuesday: form.hours_tuesday, hours_wednesday: form.hours_wednesday,
      hours_thursday: form.hours_thursday, hours_friday: form.hours_friday, hours_saturday: form.hours_saturday, hours_sunday: form.hours_sunday,
      buffer_minutes: form.buffer_minutes, bays: form.bays, deposit_percentage: form.deposit_percentage,
      deposit_type: formToSave.deposit_type, flat_deposit_amount: formToSave.flat_deposit_amount,
      facebook_url: form.facebook_url, instagram_url: form.instagram_url,
      facebook_visible: form.facebook_visible, instagram_visible: form.instagram_visible,
      port_window_price: form.port_window_price,
      google_review_url: form.google_review_url,
    }).eq('id', 1)
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000); onUpdate()
  }
  if (!form) return null

  const days = [
    { k: 'hours_monday', l: 'Monday' }, { k: 'hours_tuesday', l: 'Tuesday' }, { k: 'hours_wednesday', l: 'Wednesday' },
    { k: 'hours_thursday', l: 'Thursday' }, { k: 'hours_friday', l: 'Friday' }, { k: 'hours_saturday', l: 'Saturday' }, { k: 'hours_sunday', l: 'Sunday' },
  ] as const

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-2xl font-semibold text-white">Settings</h2>
      <div className="card p-6 space-y-4 bg-card-gradient">
        <h3 className="eyebrow">Business Info</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="block text-sm text-brand-silver mb-2">Business Name</label><input className="input" value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} /></div>
          <div><label className="block text-sm text-brand-silver mb-2">Phone</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><label className="block text-sm text-brand-silver mb-2">Email</label><input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><label className="block text-sm text-brand-silver mb-2">Address</label><input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div className="sm:col-span-2"><label className="block text-sm text-brand-silver mb-2">Google Maps URL</label><input className="input" value={form.maps_url || ''} onChange={(e) => setForm({ ...form, maps_url: e.target.value })} /></div>
        </div>
      </div>
      <div className="card p-6 space-y-4 bg-card-gradient">
        <h3 className="eyebrow">Business Hours</h3>
        <div className="space-y-3">
          {days.map((d) => (
            <div key={d.k} className="flex items-center gap-3 sm:gap-4">
              <span className="text-brand-silver text-sm w-20 sm:w-24 shrink-0">{d.l}</span>
              <input className="input flex-1 min-w-0" value={form[d.k]} onChange={(e) => setForm({ ...form, [d.k]: e.target.value })} placeholder="Closed or 9-6" />
            </div>
          ))}
        </div>
      </div>
      <div className="card p-6 space-y-4 bg-card-gradient">
        <h3 className="eyebrow">Operations</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div><label className="block text-sm text-brand-silver mb-2">Bays</label><input type="number" className="input" value={form.bays} onChange={(e) => setForm({ ...form, bays: Number(e.target.value) })} /></div>
          <div><label className="block text-sm text-brand-silver mb-2">Buffer (min)</label><input type="number" className="input" value={form.buffer_minutes} onChange={(e) => setForm({ ...form, buffer_minutes: Number(e.target.value) })} /></div>
          <div>
            <label className="block text-sm text-brand-silver mb-2">Port Window Tint ($)</label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={(form.port_window_price / 100).toFixed(2)}
              onChange={(e) => setForm({ ...form, port_window_price: Math.round(parseFloat(e.target.value || '0') * 100) })}
            />
            <p className="text-xs text-brand-silver-dark mt-1">Flat price per port window (same for all vehicles)</p>
          </div>
        </div>
      </div>
      <div className="card p-6 space-y-4 bg-card-gradient">
        <h3 className="eyebrow">Deposit</h3>
        <div className="space-y-3">
          <div className="flex gap-3">
            <button type="button" onClick={() => setForm({ ...form, deposit_type: 'percentage' })} className={`flex-1 p-3 rounded-md border text-sm font-medium transition-all ${form.deposit_type === 'percentage' ? 'bg-brand-blue text-white border-brand-blue' : 'bg-brand-muted/50 text-brand-silver border-brand-border hover:border-brand-blue'}`}>Percentage of total</button>
            <button type="button" onClick={() => setForm({ ...form, deposit_type: 'flat' })} className={`flex-1 p-3 rounded-md border text-sm font-medium transition-all ${form.deposit_type === 'flat' ? 'bg-brand-blue text-white border-brand-blue' : 'bg-brand-muted/50 text-brand-silver border-brand-border hover:border-brand-blue'}`}>Flat amount</button>
          </div>
          {form.deposit_type === 'percentage' ? (
            <div><label className="block text-sm text-brand-silver mb-2">Deposit %</label><input type="number" className="input" value={form.deposit_percentage} onChange={(e) => setForm({ ...form, deposit_percentage: Number(e.target.value) })} /></div>
          ) : (
            <div>
              <label className="block text-sm text-brand-silver mb-2">Flat Deposit Amount (dollars)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-silver-dark">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  className="input pl-7"
                  value={flatDepositInput}
                  onChange={(e) => setFlatDepositInput(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="50"
                />
              </div>
              {flatDepositInput && !isNaN(parseFloat(flatDepositInput)) && (
                <p className="text-xs text-brand-silver-dark mt-1">${parseFloat(flatDepositInput).toFixed(2)} due at booking</p>
              )}
            </div>
          )}
          <p className="text-xs text-brand-silver-dark">The deposit is a booking fee and is required to book. It is non-refundable, even in the event of tear-offs and refunds. It is applied as a credit toward the customer's final bill after service. No-shows will forfeit the deposit immediately.</p>
        </div>
      </div>
      <div className="card p-6 space-y-4 bg-card-gradient">
        <div className="flex items-center justify-between">
          <h3 className="eyebrow">Google Calendar Sync</h3>
          <button onClick={() => setShowGcalHelp((v) => !v)} className="text-brand-blue text-xs hover:underline">{showGcalHelp ? 'Hide' : 'Setup instructions'}</button>
        </div>
        {showGcalHelp && (
          <div className="space-y-3 text-sm text-brand-silver">
            <p className="text-brand-silver-dark text-xs">One-time setup to connect your Google Calendar so scheduled jobs appear on it automatically.</p>
            <ol className="list-decimal list-inside space-y-2 text-xs">
              <li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="text-brand-blue hover:underline">console.cloud.google.com</a> and create a free project.</li>
              <li>Search for "Google Calendar API" in the library and click <strong>Enable</strong>.</li>
              <li>Go to <strong>IAM &amp; Admin → Service Accounts → Create Service Account</strong>. Name it "Cars by London Calendar".</li>
              <li>Open the service account, go to <strong>Keys → Add Key → JSON</strong>. A JSON file downloads — this is your credential.</li>
              <li>Open <a href="https://calendar.google.com" target="_blank" rel="noreferrer" className="text-brand-blue hover:underline">calendar.google.com</a>. Find your calendar in the left sidebar, click the three dots → <strong>Settings and sharing</strong>.</li>
              <li>Scroll to <strong>Share with specific people</strong>, click <strong>Add people</strong>, and paste the service account's email (looks like <code className="text-brand-blue">london-auto-calendar@your-project.iam.gserviceaccount.com</code>). Give it <strong>Make changes to events</strong> permission.</li>
              <li>Copy the <strong>Calendar ID</strong> from the "Integrate calendar" section (looks like <code className="text-brand-blue">your-email@gmail.com</code> or a long string for a custom calendar).</li>
              <li>Send the downloaded JSON key file and the Calendar ID to your developer. They will configure the connection securely on the server.</li>
            </ol>
            <p className="text-brand-silver-dark text-xs">Once configured, every time you schedule or reschedule a job from the dashboard, it will automatically appear in your Google Calendar within seconds.</p>
          </div>
        )}
        <p className="text-xs text-brand-silver-dark">Status: <span className="text-amber-400">Pending setup</span>. Follow the setup instructions above, then send the credentials to your developer to activate the sync.</p>
      </div>
      {/* Social Media */}
      <div className="card p-6 space-y-5 bg-card-gradient">
        <h3 className="eyebrow">Social Media</h3>
        <p className="text-xs text-brand-silver-dark">Enter your page URLs and use the toggles to control what appears on the public site. Visitors will see the Facebook feed and an Instagram link wherever they're enabled.</p>

        {/* Facebook */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-[#1877F2]" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
              <span className="text-sm font-semibold text-white">Facebook</span>
            </div>
            <button
              type="button"
              onClick={() => setForm({ ...form, facebook_visible: !form.facebook_visible })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.facebook_visible ? 'bg-brand-blue' : 'bg-brand-muted'}`}
              aria-label="Toggle Facebook visibility"
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.facebook_visible ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
          <div>
            <label className="block text-sm text-brand-silver mb-2">Facebook Page URL</label>
            <input
              className="input"
              placeholder="https://www.facebook.com/YourPage"
              value={form.facebook_url || ''}
              onChange={(e) => setForm({ ...form, facebook_url: e.target.value || null })}
            />
            <p className="text-xs text-brand-silver-dark mt-1">Paste your full Facebook page address (e.g. https://www.facebook.com/CarsByLondon)</p>
          </div>
          <div className={`text-xs px-3 py-2 rounded-md ${form.facebook_visible ? 'bg-emerald-500/10 text-emerald-400' : 'bg-brand-muted/30 text-brand-silver-dark'}`}>
            {form.facebook_visible ? 'Facebook feed is visible on the public site' : 'Facebook feed is hidden from the public site'}
          </div>
        </div>

        <div className="border-t border-brand-border" />

        {/* Google Reviews */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" fill="#EA4335" /></svg>
            <span className="text-sm font-semibold text-white">Google Reviews</span>
          </div>
          <div>
            <label className="block text-sm text-brand-silver mb-2">Google Review URL</label>
            <input
              className="input"
              placeholder="https://g.page/r/XXXXXXXXX/review"
              value={form.google_review_url || ''}
              onChange={(e) => setForm({ ...form, google_review_url: e.target.value || null })}
            />
            <p className="text-xs text-brand-silver-dark mt-1">Paste your Google review link. When set, a "Review Us on Google" button appears on your public Reviews page and review request emails include a direct link to Google.</p>
          </div>
        </div>

        <div className="border-t border-brand-border" />

        {/* Instagram */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-[#E1306C]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" /></svg>
              <span className="text-sm font-semibold text-white">Instagram</span>
            </div>
            <button
              type="button"
              onClick={() => setForm({ ...form, instagram_visible: !form.instagram_visible })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.instagram_visible ? 'bg-brand-blue' : 'bg-brand-muted'}`}
              aria-label="Toggle Instagram visibility"
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.instagram_visible ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
          <div>
            <label className="block text-sm text-brand-silver mb-2">Instagram Profile URL</label>
            <input
              className="input"
              placeholder="https://www.instagram.com/yourhandle"
              value={form.instagram_url || ''}
              onChange={(e) => setForm({ ...form, instagram_url: e.target.value || null })}
            />
            <p className="text-xs text-brand-silver-dark mt-1">Paste your full Instagram profile address (e.g. https://www.instagram.com/carsbylondon)</p>
          </div>
          <div className={`text-xs px-3 py-2 rounded-md ${form.instagram_visible ? 'bg-emerald-500/10 text-emerald-400' : 'bg-brand-muted/30 text-brand-silver-dark'}`}>
            {form.instagram_visible ? 'Instagram link is visible on the public site' : 'Instagram link is hidden from the public site'}
          </div>
        </div>
      </div>

      <button onClick={save} className="btn-primary" disabled={saving}>{saving ? 'Saving…' : saved ? 'Saved!' : 'Save Settings'}</button>
    </div>
  )
}
