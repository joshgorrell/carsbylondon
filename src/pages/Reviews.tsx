import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Review } from '../lib/types'

export default function Reviews() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('reviews').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setReviews(data || []); setLoading(false) })
  }, [])

  const avg = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '5.0'

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
