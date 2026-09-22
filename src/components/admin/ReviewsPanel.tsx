import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import type { Review } from '../../lib/types'
import { formatDate } from '../../lib/format'

export default function ReviewsPanel() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ customer_name: '', vehicle: '', rating: 5, review: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('pending')

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('reviews').select('*').order('created_at', { ascending: false })
    setReviews((data || []) as Review[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const approve = async (r: Review) => {
    await supabase.from('reviews').update({ approved: true }).eq('id', r.id)
    setReviews((prev) => prev.map((x) => x.id === r.id ? { ...x, approved: true } : x))
  }

  const toggleFeatured = async (r: Review) => {
    await supabase.from('reviews').update({ featured: !r.featured }).eq('id', r.id)
    setReviews((prev) => prev.map((x) => x.id === r.id ? { ...x, featured: !r.featured } : x))
  }

  const remove = async (r: Review) => {
    if (!confirm('Delete this review permanently?')) return
    await supabase.from('reviews').delete().eq('id', r.id)
    setReviews((prev) => prev.filter((x) => x.id !== r.id))
  }

  const addManual = async () => {
    if (!form.customer_name.trim() || !form.review.trim()) return
    setSaving(true); setError(null)
    const { error: e } = await supabase.from('reviews').insert({
      customer_name: form.customer_name.trim(),
      vehicle: form.vehicle.trim() || null,
      rating: form.rating,
      review: form.review.trim(),
      approved: true,
      featured: false,
    })
    if (e) { setError(e.message); setSaving(false); return }
    setForm({ customer_name: '', vehicle: '', rating: 5, review: '' })
    setShowAdd(false)
    setSaving(false)
    await load()
  }

  const displayed = reviews.filter((r) => {
    if (filter === 'pending') return !r.approved
    if (filter === 'approved') return r.approved
    return true
  })

  const pendingCount = reviews.filter((r) => !r.approved).length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-white">Reviews</h2>
        <button onClick={() => setShowAdd(!showAdd)} className="btn-primary !text-sm !px-4 !py-2">
          {showAdd ? 'Cancel' : '+ Add Review'}
        </button>
      </div>

      {showAdd && (
        <div className="card p-6 mb-8 bg-card-gradient space-y-4 animate-slide-up">
          <h3 className="text-lg font-semibold text-white">Add Review Manually</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-brand-silver mb-2">Customer Name <span className="text-brand-blue">*</span></label>
              <input className="input" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} placeholder="John D." />
            </div>
            <div>
              <label className="block text-sm text-brand-silver mb-2">Vehicle <span className="text-brand-silver-dark">(optional)</span></label>
              <input className="input" value={form.vehicle} onChange={(e) => setForm({ ...form, vehicle: e.target.value })} placeholder="2023 Tesla Model 3" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-brand-silver mb-2">Rating</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setForm({ ...form, rating: n })} className="transition-transform hover:scale-110">
                  <svg className={`w-8 h-8 transition-colors ${n <= form.rating ? 'text-brand-blue' : 'text-brand-muted'}`} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l3 6 6 1-4.5 4.5L18 20l-6-3-6 3 1.5-6.5L3 9l6-1z" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm text-brand-silver mb-2">Review Text <span className="text-brand-blue">*</span></label>
            <textarea className="input min-h-[100px] resize-none" value={form.review} onChange={(e) => setForm({ ...form, review: e.target.value })} placeholder="Write the review text…" />
          </div>
          {error && <div className="p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>}
          <button onClick={addManual} disabled={saving || !form.customer_name.trim() || !form.review.trim()} className="btn-primary">
            {saving ? 'Saving…' : 'Add Review'}
          </button>
        </div>
      )}

      <div className="flex gap-2 mb-6">
        {(['pending', 'approved', 'all'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-md text-sm font-badge font-semibold tracking-wider uppercase transition-colors flex items-center gap-2 ${filter === f ? 'bg-brand-blue text-white' : 'bg-brand-muted/50 text-brand-silver border border-brand-border hover:text-white'}`}>
            {f === 'pending' ? 'Needs Approval' : f === 'approved' ? 'Approved' : 'All'}
            {f === 'pending' && pendingCount > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${filter === 'pending' ? 'bg-white/20' : 'bg-brand-blue/20 text-brand-blue'}`}>{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
        </div>
      ) : displayed.length === 0 ? (
        <div className="card p-12 text-center text-brand-silver bg-card-gradient">
          {filter === 'pending' ? 'No reviews waiting for approval.' : filter === 'approved' ? 'No approved reviews yet.' : 'No reviews yet.'}
        </div>
      ) : (
        <div className="space-y-4">
          {displayed.map((r) => (
            <div key={r.id} className="card p-6 bg-card-gradient">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <span className={`text-xs px-2 py-1 rounded-full font-badge font-semibold tracking-wider uppercase ${r.approved ? 'badge-confirmed' : 'badge-pending'}`}>
                      {r.approved ? 'Approved' : 'Pending'}
                    </span>
                    {r.featured && r.approved && (
                      <span className="text-xs px-2 py-1 rounded-full bg-brand-blue/20 text-brand-blue font-badge font-semibold tracking-wider uppercase">Featured</span>
                    )}
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <svg key={i} className={`w-4 h-4 ${i < r.rating ? 'text-brand-blue' : 'text-brand-muted'}`} viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2l3 6 6 1-4.5 4.5L18 20l-6-3-6 3 1.5-6.5L3 9l6-1z" />
                        </svg>
                      ))}
                    </div>
                  </div>
                  <p className="text-white font-semibold">{r.customer_name}</p>
                  {r.vehicle && <p className="text-brand-silver-dark text-sm">{r.vehicle}</p>}
                  <p className="text-brand-silver text-sm mt-2 leading-relaxed">"{r.review}"</p>
                  <p className="text-brand-silver-dark text-xs mt-2">{formatDate(r.created_at)}</p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  {!r.approved && (
                    <button onClick={() => approve(r)} className="btn-primary !text-xs !px-3 !py-1.5">Approve</button>
                  )}
                  {r.approved && (
                    <button onClick={() => toggleFeatured(r)} className={`btn-secondary !text-xs !px-3 !py-1.5 ${r.featured ? 'hover:!text-amber-400' : 'hover:!text-brand-blue'}`}>
                      {r.featured ? 'Unfeature' : 'Feature'}
                    </button>
                  )}
                  <button onClick={() => remove(r)} className="btn-secondary !text-xs !px-3 !py-1.5 hover:!text-red-400">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
