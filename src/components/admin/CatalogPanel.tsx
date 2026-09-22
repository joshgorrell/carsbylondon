import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { formatPrice, formatDuration } from '../../lib/format'
import type { Service, AddOn, AddOnVisibility, PricingRule, PricingClass } from '../../lib/types'

const PRICING_CLASSES: PricingClass[] = ['sedan', 'coupe', 'mid_suv', 'large_suv', 'truck', 'van']

// Uncontrolled-style dollar input: lets the user type freely, commits cents on blur
function DollarInput({ cents, onChange }: { cents: number; onChange: (cents: number) => void }) {
  const [raw, setRaw] = useState((cents / 100).toFixed(2))

  // Sync when the parent resets the form (editing a different record)
  useEffect(() => { setRaw((cents / 100).toFixed(2)) }, [cents])

  const commit = () => {
    const val = parseFloat(raw)
    onChange(isNaN(val) ? 0 : Math.round(val * 100))
  }

  return (
    <input
      type="number"
      step="0.01"
      className="input"
      value={raw}
      onChange={(e) => setRaw(e.target.value)}
      onBlur={commit}
    />
  )
}

export default function CatalogPanel() {
  const [services, setServices] = useState<Service[]>([])
  const [addOns, setAddOns] = useState<AddOn[]>([])
  const [rules, setRules] = useState<PricingRule[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null)
  const [section, setSection] = useState<'services' | 'addons' | 'pricing'>('services')

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: s }, { data: a }, { data: r }] = await Promise.all([
      supabase.from('services').select('*').order('display_order'),
      supabase.from('add_ons').select('*'),
      supabase.from('pricing_rules').select('*').order('service').order('pricing_class'),
    ])
    setServices(s || [])
    setAddOns(a || [])
    setRules(r || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (services.length && !selectedServiceId) setSelectedServiceId(services[0].id) }, [services, selectedServiceId])

  const selectedService = services.find((s) => s.id === selectedServiceId) || null
  const serviceAddOns = addOns.filter((a) =>
    selectedServiceId === '__always__' ? a.visibility === 'always' : a.service_id === selectedServiceId
  )

  const sections = [
    { id: 'services' as const, label: 'Services' },
    { id: 'addons' as const, label: 'Add-ons' },
    { id: 'pricing' as const, label: 'Pricing Rules' },
  ]

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {sections.map((s) => (
          <button key={s.id} onClick={() => setSection(s.id)}
            className={`px-4 py-2 rounded-md text-sm font-badge font-semibold tracking-wider uppercase transition-colors ${section === s.id ? 'bg-brand-blue text-white' : 'bg-brand-muted/50 text-brand-silver border border-brand-border hover:text-white'}`}>
            {s.label}
          </button>
        ))}
      </div>

      {section === 'services' && <ServicesManager services={services} onChange={load} />}
      {section === 'addons' && (
        <AddOnsManager
          services={services}
          selectedService={selectedService}
          selectedServiceId={selectedServiceId}
          onSelectService={setSelectedServiceId}
          addOns={serviceAddOns}
          onChange={load}
        />
      )}
      {section === 'pricing' && <PricingManager rules={rules} services={services} onChange={load} />}
    </div>
  )
}

// ---------- Services ----------
function ServicesManager({ services, onChange }: { services: Service[]; onChange: () => void }) {
  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const blank: Service = { id: '', name: '', slug: '', description: '', active: true, display_order: services.length + 1 }
  const [form, setForm] = useState<Service>(blank)

  const startEdit = (s: Service) => { setEditing(s.id); setForm(s); setAdding(false) }
  const startAdd = () => { setAdding(true); setEditing(null); setForm({ ...blank, display_order: services.length + 1 }) }
  const cancel = () => { setEditing(null); setAdding(false) }

  const save = async () => {
    if (adding) {
      const { id, ...insert } = form
      await supabase.from('services').insert(insert)
    } else if (editing) {
      const { id, ...update } = form
      await supabase.from('services').update(update).eq('id', editing)
    }
    cancel(); onChange()
  }

  const remove = async (s: Service) => {
    if (!confirm(`Delete "${s.name}"? This also removes its add-ons.`)) return
    await supabase.from('services').delete().eq('id', s.id)
    onChange()
  }

  const toggleActive = async (s: Service) => {
    await supabase.from('services').update({ active: !s.active }).eq('id', s.id)
    onChange()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl sm:text-2xl font-semibold text-white">Services</h2>
        {!adding && <button onClick={startAdd} className="btn-primary !text-sm">+ Add Service</button>}
      </div>

      {(adding || editing) && (
        <div className="card p-6 space-y-4 bg-card-gradient">
          <h3 className="eyebrow">{adding ? 'New Service' : 'Edit Service'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-sm text-brand-silver mb-2">Name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="block text-sm text-brand-silver mb-2">Slug</label><input className="input" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="window_tint" /></div>
            <div><label className="block text-sm text-brand-silver mb-2">Display Order</label><input type="number" className="input" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: Number(e.target.value) })} /></div>
            <div className="flex items-end gap-2 pb-2">
              <label className="flex items-center gap-2 text-sm text-brand-silver cursor-pointer">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="w-4 h-4 accent-brand-blue" />
                Active
              </label>
            </div>
            <div className="sm:col-span-2"><label className="block text-sm text-brand-silver mb-2">Description</label><textarea className="input min-h-[80px]" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={save} className="btn-primary">{adding ? 'Create' : 'Save'}</button>
            <button onClick={cancel} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {services.map((s) => (
          <div key={s.id} className="card p-4 sm:p-5 bg-card-gradient">
            <div className="flex flex-col gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 sm:gap-3 mb-1 flex-wrap">
                  <span className="text-white font-semibold">{s.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-badge ${s.active ? 'badge-confirmed' : 'badge-cancelled'}`}>{s.active ? 'Active' : 'Inactive'}</span>
                  <span className="text-xs text-brand-silver-dark">order: {s.display_order}</span>
                </div>
                <p className="text-sm text-brand-silver">{s.description || <span className="text-brand-silver-dark">No description</span>}</p>
                <p className="text-xs text-brand-silver-dark mt-1">/{s.slug}</p>
              </div>
              <div className="flex gap-2 shrink-0 items-center">
                <button onClick={() => toggleActive(s)} title={s.active ? 'Deactivate' : 'Activate'} className={`p-2 rounded-md transition-colors ${s.active ? 'text-brand-blue hover:bg-brand-blue/10' : 'text-brand-silver-dark hover:bg-brand-muted/50'}`}>
                  {s.active ? (
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" strokeLinecap="round" strokeLinejoin="round" /><circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  ) : (
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9.88 9.88a3 3 0 0 0 4.24 4.24M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61M2 2l20 20" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  )}
                </button>
                <button onClick={() => startEdit(s)} className="btn-secondary !text-xs !px-3 !py-2">Edit</button>
                <button onClick={() => remove(s)} className="btn-secondary !text-xs !px-3 !py-2 hover:!text-red-400">Delete</button>
              </div>
            </div>
          </div>
        ))}
        {services.length === 0 && <div className="card p-12 text-center text-brand-silver bg-card-gradient">No services yet.</div>}
      </div>
    </div>
  )
}

// ---------- Add-ons ----------
function AddOnsManager({
  services, selectedService, selectedServiceId, onSelectService, addOns, onChange,
}: {
  services: Service[]
  selectedService: Service | null
  selectedServiceId: string | null
  onSelectService: (id: string) => void
  addOns: AddOn[]
  onChange: () => void
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const isAlwaysTab = selectedServiceId === '__always__'
  const blank: AddOn = { id: '', service_id: isAlwaysTab ? null : (selectedServiceId || ''), name: '', price: 0, description: '', required: false, per_unit_label: null, visibility: isAlwaysTab ? 'always' : 'service' }
  const [form, setForm] = useState<AddOn>(blank)

  useEffect(() => { if (adding) setForm((f) => ({ ...f, service_id: isAlwaysTab ? null : (selectedServiceId || ''), visibility: isAlwaysTab ? 'always' : (f.visibility === 'always' ? 'service' : f.visibility) })) }, [selectedServiceId, adding])

  const startEdit = (a: AddOn) => { setEditing(a.id); setForm(a); setAdding(false) }
  const startAdd = () => { setAdding(true); setEditing(null); setForm({ ...blank, service_id: isAlwaysTab ? null : (selectedServiceId || ''), visibility: isAlwaysTab ? 'always' : 'service' }) }
  const cancel = () => { setEditing(null); setAdding(false) }

  const save = async () => {
    const payload = { ...form, service_id: form.visibility === 'always' ? null : form.service_id }
    if (adding) {
      const { id, ...insert } = payload
      await supabase.from('add_ons').insert(insert)
    } else if (editing) {
      const { id, ...update } = payload
      await supabase.from('add_ons').update(update).eq('id', editing)
    }
    cancel(); onChange()
  }

  const remove = async (a: AddOn) => {
    if (!confirm(`Delete add-on "${a.name}"?`)) return
    await supabase.from('add_ons').delete().eq('id', a.id)
    onChange()
  }

  const quickSavePrice = async (id: string, price: number) => {
    await supabase.from('add_ons').update({ price }).eq('id', id)
    onChange()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl sm:text-2xl font-semibold text-white">Add-ons</h2>
        {!adding && <button onClick={startAdd} className="btn-primary !text-sm">+ Add Add-on</button>}
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1 sm:flex-wrap sm:overflow-visible sm:mx-0 sm:px-0 sm:pb-0">
        {services.map((s) => (
          <button key={s.id} onClick={() => onSelectService(s.id)}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${selectedServiceId === s.id ? 'bg-brand-blue text-white' : 'bg-brand-muted/50 text-brand-silver border border-brand-border hover:text-white'}`}>
            {s.name}
          </button>
        ))}
        <button onClick={() => onSelectService('__always__')}
          className={`px-3 py-1.5 rounded-md text-sm transition-colors ${isAlwaysTab ? 'bg-brand-blue text-white' : 'bg-brand-muted/50 text-brand-silver border border-brand-border hover:text-white'}`}>
          Always
        </button>
      </div>

      {(adding || editing) && (
        <div className="card p-6 space-y-4 bg-card-gradient">
          <h3 className="eyebrow">{adding ? 'New Add-on' : 'Edit Add-on'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-sm text-brand-silver mb-2">Name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div>
              <label className="block text-sm text-brand-silver mb-2">Visibility</label>
              <select className="input" value={form.visibility} onChange={(e) => {
                const v = e.target.value as AddOnVisibility
                setForm({ ...form, visibility: v, service_id: v === 'always' ? null : (form.service_id || services[0]?.id || '') })
              }}>
                <option value="service">Service only — shown when this service is selected</option>
                <option value="qualifying">After qualifying question — hidden until customer answers yes</option>
                <option value="always">Always shown — appears for all services</option>
              </select>
            </div>
            {form.visibility !== 'always' && (
              <div>
                <label className="block text-sm text-brand-silver mb-2">Service</label>
                <select className="input" value={form.service_id || ''} onChange={(e) => setForm({ ...form, service_id: e.target.value })}>
                  {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
            <div><label className="block text-sm text-brand-silver mb-2">Price (dollars)</label><DollarInput cents={form.price} onChange={(v) => setForm({ ...form, price: v })} /><p className="text-xs text-brand-silver-dark mt-1">{formatPrice(form.price)}</p></div>
            <div>
              <label className="block text-sm text-brand-silver mb-2">Per-unit label <span className="text-brand-silver-dark">(optional)</span></label>
              <input className="input" placeholder="e.g. window" value={form.per_unit_label || ''} onChange={(e) => setForm({ ...form, per_unit_label: e.target.value || null })} />
              <p className="text-xs text-brand-silver-dark mt-1">If set, customer picks a quantity and price is multiplied. Leave blank for a flat fee.</p>
            </div>
            <div className="flex items-end gap-2 pb-2">
              <label className="flex items-center gap-2 text-sm text-brand-silver cursor-pointer">
                <input type="checkbox" checked={form.required} onChange={(e) => setForm({ ...form, required: e.target.checked })} className="w-4 h-4 accent-brand-blue" />
                Required selection
              </label>
              <p className="text-xs text-brand-silver-dark">Customer must pick at least one required option to continue.</p>
            </div>
            <div className="sm:col-span-2"><label className="block text-sm text-brand-silver mb-2">Description</label><textarea className="input min-h-[80px]" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={save} className="btn-primary">{adding ? 'Create' : 'Save'}</button>
            <button onClick={cancel} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {addOns.map((a) => (
          <div key={a.id} className="card p-4 sm:p-5 bg-card-gradient">
            <div className="flex flex-col gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 sm:gap-3 mb-1 flex-wrap">
                  <span className="text-white font-semibold">{a.name}</span>
                  <span className="text-brand-blue font-bold"><InlinePriceCell cents={a.price} onSave={(c) => quickSavePrice(a.id, c)} /></span>
                  {a.required && <span className="text-[10px] px-2 py-0.5 rounded-full font-badge font-semibold tracking-wider uppercase bg-amber-500/15 text-amber-400 border border-amber-500/30">Required</span>}
                  {a.visibility === 'qualifying' && <span className="text-[10px] px-2 py-0.5 rounded-full font-badge font-semibold tracking-wider uppercase bg-blue-500/15 text-blue-400 border border-blue-500/30">After qualifying question</span>}
                  {a.visibility === 'always' && <span className="text-[10px] px-2 py-0.5 rounded-full font-badge font-semibold tracking-wider uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">Always shown</span>}
                </div>
                <p className="text-sm text-brand-silver">{a.description || <span className="text-brand-silver-dark">No description</span>}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => startEdit(a)} className="btn-secondary !text-xs !px-3 !py-2">Edit</button>
                <button onClick={() => remove(a)} className="btn-secondary !text-xs !px-3 !py-2 hover:!text-red-400">Delete</button>
              </div>
            </div>
          </div>
        ))}
        {addOns.length === 0 && <div className="card p-12 text-center text-brand-silver bg-card-gradient">{isAlwaysTab ? 'No always-shown add-ons yet.' : 'No add-ons for this service.'}</div>}
      </div>
    </div>
  )
}

// Inline-editable dollar cell — click to edit, saves on blur or Enter
function InlinePriceCell({ cents, onSave }: { cents: number; onSave: (cents: number) => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [raw, setRaw] = useState((cents / 100).toFixed(2))
  const [saving, setSaving] = useState(false)

  const commit = async () => {
    const val = parseFloat(raw)
    const newCents = isNaN(val) ? 0 : Math.round(val * 100)
    setEditing(false)
    if (newCents === cents) { setRaw((cents / 100).toFixed(2)); return }
    setSaving(true)
    await onSave(newCents)
    setSaving(false)
  }

  if (editing) {
    return (
      <input
        type="number"
        step="0.01"
        autoFocus
        className="input !py-1 !px-2 w-24 text-right"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setRaw((cents / 100).toFixed(2)); setEditing(false) } }}
      />
    )
  }
  return (
    <button
      onClick={() => { setRaw((cents / 100).toFixed(2)); setEditing(true) }}
      disabled={saving}
      className={`font-semibold transition-colors hover:text-brand-blue ${saving ? 'text-brand-silver-dark' : 'text-white'}`}
      title="Click to edit"
    >
      {saving ? '…' : formatPrice(cents)}
    </button>
  )
}

// Inline-editable duration cell — click to edit, saves on blur or Enter
function InlineDurationCell({ hours, onSave }: { hours: number; onSave: (hours: number) => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [raw, setRaw] = useState(String(hours))
  const [saving, setSaving] = useState(false)

  const commit = async () => {
    const val = parseFloat(raw)
    const newHours = isNaN(val) ? 0 : val
    setEditing(false)
    if (newHours === hours) { setRaw(String(hours)); return }
    setSaving(true)
    await onSave(newHours)
    setSaving(false)
  }

  if (editing) {
    return (
      <input
        type="text"
        inputMode="decimal"
        autoFocus
        className="input !py-1 !px-2 w-20 text-right"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setRaw(String(hours)); setEditing(false) } }}
      />
    )
  }
  return (
    <button
      onClick={() => { setRaw(String(hours)); setEditing(true) }}
      disabled={saving}
      className={`transition-colors hover:text-brand-blue ${saving ? 'text-brand-silver-dark' : 'text-brand-silver'}`}
      title="Click to edit"
    >
      {saving ? '…' : formatDuration(hours)}
    </button>
  )
}

// ---------- Pricing Rules ----------
function PricingManager({ rules, services, onChange }: { rules: PricingRule[]; services: Service[]; onChange: () => void }) {
  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const blank: PricingRule = { id: '', service: services[0]?.slug || 'window_tint', pricing_class: 'sedan', base_price: 0, duration: 1, front_windshield_price: 0, rear_glass_price: 0, side_window_price: 0, windshield_brow_price: 0, interior_price: 0, exterior_price: 0 }
  const [form, setForm] = useState<PricingRule>(blank)

  const startEdit = (r: PricingRule) => { setEditing(r.id); setForm(r); setAdding(false) }
  const startAdd = () => { setAdding(true); setEditing(null); setForm(blank) }
  const cancel = () => { setEditing(null); setAdding(false) }

  const save = async () => {
    if (adding) {
      const { id, ...insert } = form
      await supabase.from('pricing_rules').insert(insert)
    } else if (editing) {
      const { id, ...update } = form
      await supabase.from('pricing_rules').update(update).eq('id', editing)
    }
    cancel(); onChange()
  }

  const remove = async (r: PricingRule) => {
    if (!confirm(`Delete pricing rule for ${r.service} / ${r.pricing_class}?`)) return
    await supabase.from('pricing_rules').delete().eq('id', r.id)
    onChange()
  }

  const quickSave = async (id: string, patch: Partial<PricingRule>) => {
    await supabase.from('pricing_rules').update(patch).eq('id', id)
    onChange()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl sm:text-2xl font-semibold text-white">Pricing Rules</h2>
        {!adding && <button onClick={startAdd} className="btn-primary !text-sm">+ Add Rule</button>}
      </div>

      {(adding || editing) && (
        <div className="card p-6 space-y-4 bg-card-gradient">
          <h3 className="eyebrow">{adding ? 'New Pricing Rule' : 'Edit Pricing Rule'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-brand-silver mb-2">Service</label>
              <select className="input" value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })}>
                {services.map((s) => <option key={s.id} value={s.slug}>{s.name} ({s.slug})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-brand-silver mb-2">Pricing Class</label>
              <select className="input" value={form.pricing_class} onChange={(e) => setForm({ ...form, pricing_class: e.target.value as PricingClass })}>
                {PRICING_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><label className="block text-sm text-brand-silver mb-2">Base Price (dollars)</label><DollarInput cents={form.base_price} onChange={(v) => setForm({ ...form, base_price: v })} /><p className="text-xs text-brand-silver-dark mt-1">{form.service === 'window_tint' ? <span className="text-amber-400">Not used for window tint — scope selections drive the price</span> : formatPrice(form.base_price)}</p></div>
            <div><label className="block text-sm text-brand-silver mb-2">Duration (hours)</label><input type="text" inputMode="decimal" className="input" value={form.duration || ''} onChange={(e) => setForm({ ...form, duration: parseFloat(e.target.value) || 0 })} placeholder="e.g. 3.5" /><p className="text-xs text-brand-silver-dark mt-1">{formatDuration(form.duration)}</p></div>
            {form.service === 'window_tint' && (
              <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-brand-border">
                <div>
                  <label className="block text-sm text-brand-silver mb-2">Front Windshield Tint ($)</label>
                  <DollarInput cents={form.front_windshield_price || 0} onChange={(v) => setForm({ ...form, front_windshield_price: v })} />
                  <p className="text-xs text-brand-silver-dark mt-1">{formatPrice(form.front_windshield_price || 0)}</p>
                </div>
                <div>
                  <label className="block text-sm text-brand-silver mb-2">Windshield Brow Tint ($)</label>
                  <DollarInput cents={form.windshield_brow_price || 0} onChange={(v) => setForm({ ...form, windshield_brow_price: v })} />
                  <p className="text-xs text-brand-silver-dark mt-1">{formatPrice(form.windshield_brow_price || 0)}</p>
                </div>
                <div>
                  <label className="block text-sm text-brand-silver mb-2">Rear Glass Tint ($)</label>
                  <DollarInput cents={form.rear_glass_price || 0} onChange={(v) => setForm({ ...form, rear_glass_price: v })} />
                  <p className="text-xs text-brand-silver-dark mt-1">{formatPrice(form.rear_glass_price || 0)}</p>
                </div>
                <div>
                  <label className="block text-sm text-brand-silver mb-2">Side Window Tint ($ / window)</label>
                  <DollarInput cents={form.side_window_price || 0} onChange={(v) => setForm({ ...form, side_window_price: v })} />
                  <p className="text-xs text-brand-silver-dark mt-1">{formatPrice(form.side_window_price || 0)}</p>
                </div>
              </div>
            )}
            {form.service === 'detailing' && (
              <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-brand-border">
                <div>
                  <label className="block text-sm text-brand-silver mb-2">Interior Detail ($)</label>
                  <DollarInput cents={form.interior_price || 0} onChange={(v) => setForm({ ...form, interior_price: v })} />
                  <p className="text-xs text-brand-silver-dark mt-1">{formatPrice(form.interior_price || 0)}</p>
                </div>
                <div>
                  <label className="block text-sm text-brand-silver mb-2">Exterior Detail ($)</label>
                  <DollarInput cents={form.exterior_price || 0} onChange={(v) => setForm({ ...form, exterior_price: v })} />
                  <p className="text-xs text-brand-silver-dark mt-1">{formatPrice(form.exterior_price || 0)}</p>
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={save} className="btn-primary">{adding ? 'Create' : 'Save'}</button>
            <button onClick={cancel} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-brand-silver-dark text-xs font-badge tracking-wider uppercase border-b border-brand-border">
              <th className="text-left py-3 px-2">Service</th>
              <th className="text-left py-3 px-2">Class</th>
              <th className="text-right py-3 px-2">Base Price</th>
              <th className="text-right py-3 px-2">Front WS</th>
              <th className="text-right py-3 px-2">WS Brow</th>
              <th className="text-right py-3 px-2">Rear Glass</th>
              <th className="text-right py-3 px-2">Side / Win</th>
              <th className="text-right py-3 px-2">Interior</th>
              <th className="text-right py-3 px-2">Exterior</th>
              <th className="text-right py-3 px-2">Duration</th>
              <th className="text-right py-3 px-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} className="border-b border-brand-border/50 hover:bg-brand-muted/20">
                <td className="py-3 px-2 text-brand-silver">{r.service}</td>
                <td className="py-3 px-2 text-brand-silver">{r.pricing_class}</td>
                <td className="py-3 px-2 text-right">{r.service === 'window_tint' ? <span className="text-brand-silver-dark">—</span> : <InlinePriceCell cents={r.base_price} onSave={(c) => quickSave(r.id, { base_price: c })} />}</td>
                <td className="py-3 px-2 text-right">{r.service === 'window_tint' ? <InlinePriceCell cents={r.front_windshield_price || 0} onSave={(c) => quickSave(r.id, { front_windshield_price: c })} /> : <span className="text-brand-silver-dark">—</span>}</td>
                <td className="py-3 px-2 text-right">{r.service === 'window_tint' ? <InlinePriceCell cents={r.windshield_brow_price || 0} onSave={(c) => quickSave(r.id, { windshield_brow_price: c })} /> : <span className="text-brand-silver-dark">—</span>}</td>
                <td className="py-3 px-2 text-right">{r.service === 'window_tint' ? <InlinePriceCell cents={r.rear_glass_price || 0} onSave={(c) => quickSave(r.id, { rear_glass_price: c })} /> : <span className="text-brand-silver-dark">—</span>}</td>
                <td className="py-3 px-2 text-right">{r.service === 'window_tint' ? <InlinePriceCell cents={r.side_window_price || 0} onSave={(c) => quickSave(r.id, { side_window_price: c })} /> : <span className="text-brand-silver-dark">—</span>}</td>
                <td className="py-3 px-2 text-right">{r.service === 'detailing' ? <InlinePriceCell cents={r.interior_price || 0} onSave={(c) => quickSave(r.id, { interior_price: c })} /> : <span className="text-brand-silver-dark">—</span>}</td>
                <td className="py-3 px-2 text-right">{r.service === 'detailing' ? <InlinePriceCell cents={r.exterior_price || 0} onSave={(c) => quickSave(r.id, { exterior_price: c })} /> : <span className="text-brand-silver-dark">—</span>}</td>
                <td className="py-3 px-2 text-right"><InlineDurationCell hours={r.duration} onSave={(h) => quickSave(r.id, { duration: h })} /></td>
                <td className="py-3 px-2 text-right">
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => startEdit(r)} className="btn-secondary !text-xs !px-3 !py-1.5">Edit</button>
                    <button onClick={() => remove(r)} className="btn-secondary !text-xs !px-3 !py-1.5 hover:!text-red-400">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rules.length === 0 && <div className="card p-12 text-center text-brand-silver bg-card-gradient mt-3">No pricing rules.</div>}
      </div>
    </div>
  )
}
