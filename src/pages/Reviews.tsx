import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Review, BusinessSettings } from '../lib/types'

export default function Reviews() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [settings, setSettings] = useState<BusinessSettings | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('reviews').select('*').order('created_at', { ascending: false }),
      supabase.from('business_settings').select('*').eq('id', 1).maybeSingle(),
    ]).then(([revRes, setRes]) => {
      setReviews(revRes.data || [])
      setSettings(setRes.data as BusinessSettings | null)
      setLoading(false)
    })
  }, [])

  const avg = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '5.0'
  const googleUrl = settings?.google_review_url || null

  return (
    <div className="pt-20 md:pt-24">
      <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <p className="eyebrow mb-3">Client Feedback</p>
          <h1 className="section-heading mb-4">Reviews</h1>
          <div className="flex items-center justify-center gap-2 mt-4">
            <div className="flex gap-1">{Array.from({ length: 5 }).map((_, i) => (
              <svg key={i} className="w-6 h-6 text-brand-blue" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 6 6 1-4.5 4.5L18 20l-6-3-6 3 1.5-6.5L3 9l6-1z" /></svg>
            ))}</div>
            <span className="text-brand-silver text-lg">{avg} average</span>
          </div>
          {googleUrl && (
            <a href={googleUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-6 px-6 py-3 rounded-lg bg-white text-gray-900 font-semibold text-sm hover:bg-gray-100 transition-colors">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" fill="#EA4335" /><path d="M1 1h22v22H1z" fill="none" /></svg>
              Review Us on Google
            </a>
          )}
        </div>
        {loading ? <div className="text-center text-brand-silver py-20">Loading…</div>
        : reviews.length === 0 ? <div className="text-center text-brand-silver py-20">No reviews yet.</div>
        : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {reviews.map((r) => (
              <div key={r.id} className="card p-8 bg-card-gradient">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-white font-semibold">{r.customer_name}</p>
                    {r.vehicle && <p className="text-brand-silver-dark text-sm">{r.vehicle}</p>}
                  </div>
                  <div className="flex gap-1">{Array.from({ length: r.rating }).map((_, i) => (
                    <svg key={i} className="w-4 h-4 text-brand-blue" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 6 6 1-4.5 4.5L18 20l-6-3-6 3 1.5-6.5L3 9l6-1z" /></svg>
                  ))}</div>
                </div>
                <p className="text-brand-silver text-sm leading-relaxed">{r.review}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
