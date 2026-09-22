import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { ReviewToken } from '../lib/types'

type Phase = 'loading' | 'invalid' | 'form' | 'submitting' | 'done'

export default function ReviewSubmit() {
  const [params] = useSearchParams()
  const tokenId = params.get('token')
  const [phase, setPhase] = useState<Phase>('loading')
  const [token, setToken] = useState<ReviewToken | null>(null)
  const [rating, setRating] = useState(5)
  const [hoverRating, setHoverRating] = useState(0)
  const [reviewText, setReviewText] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!tokenId) { setPhase('invalid'); return }
    supabase.from('review_tokens').select('*').eq('id', tokenId).maybeSingle()
      .then(({ data }) => {
        if (!data || data.used) { setPhase('invalid'); return }
        setToken(data as ReviewToken)
        setPhase('form')
      })
  }, [tokenId])

  const submit = async () => {
    if (!token || !reviewText.trim()) return
    setPhase('submitting')
    setError(null)

    const { error: re } = await supabase.from('reviews').insert({
      customer_name: token.customer_name,
      vehicle: token.vehicle || null,
      rating,
      review: reviewText.trim(),
      approved: false,
      featured: false,
    })

    if (re) { setError(re.message); setPhase('form'); return }

    await supabase.from('review_tokens').update({ used: true }).eq('id', token.id)

    // Notify admin
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'new_review_notification',
        payload: {
          customer_name: token.customer_name,
          rating,
          review_text: reviewText.trim(),
          vehicle: token.vehicle,
        },
      }),
    })

    setPhase('done')
  }

  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-brand-black bg-grain flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (phase === 'invalid') {
    return (
      <div className="min-h-screen bg-brand-black bg-grain flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-white mb-2">Link Not Valid</h1>
          <p className="text-brand-silver">This review link has already been used or is no longer valid. If you believe this is an error, contact us directly.</p>
        </div>
      </div>
    )
  }

  if (phase === 'done') {
    return (
      <div className="min-h-screen bg-brand-black bg-grain flex items-center justify-center px-4">
        <div className="text-center max-w-md animate-slide-up">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-brand-blue/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-brand-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-white mb-2">Thank You!</h1>
          <p className="text-brand-silver mb-6">Your review has been submitted. We truly appreciate you taking the time — it means a lot to us.</p>
          <a href="/" className="btn-primary">Back to Home</a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-black bg-grain flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg animate-slide-up">
        <div className="text-center mb-8">
          <img src="/London_Tint_and_Detail_logo.png" alt="London Tint & Detail" style={{ height: '56px', width: 'auto', margin: '0 auto 20px' }} />
          <h1 className="text-2xl font-semibold text-white mb-2">Leave a Review</h1>
          {token?.vehicle && (
            <p className="text-brand-silver">How was the work on your <span className="text-white">{token.vehicle}</span>?</p>
          )}
        </div>

        <div className="card p-8 bg-card-gradient space-y-6">
          {/* Star rating */}
          <div>
            <label className="block text-sm text-brand-silver mb-3">Your Rating</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHoverRating(n)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="transition-transform hover:scale-110"
                >
                  <svg
                    className={`w-10 h-10 transition-colors ${n <= (hoverRating || rating) ? 'text-brand-blue' : 'text-brand-muted'}`}
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 2l3 6 6 1-4.5 4.5L18 20l-6-3-6 3 1.5-6.5L3 9l6-1z" />
                  </svg>
                </button>
              ))}
            </div>
            <p className="text-brand-silver-dark text-xs mt-1">
              {rating === 5 ? 'Outstanding' : rating === 4 ? 'Great' : rating === 3 ? 'Good' : rating === 2 ? 'Fair' : 'Poor'}
            </p>
          </div>

          {/* Review text */}
          <div>
            <label className="block text-sm text-brand-silver mb-2">Your Review</label>
            <textarea
              className="input min-h-[120px] resize-none"
              placeholder="Tell us about your experience…"
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
            />
          </div>

          {error && (
            <div className="p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>
          )}

          <button
            onClick={submit}
            disabled={phase === 'submitting' || !reviewText.trim()}
            className="btn-primary w-full"
          >
            {phase === 'submitting' ? 'Submitting…' : 'Submit Review'}
          </button>
        </div>

        <p className="text-center text-brand-silver-dark text-xs mt-4">
          Submitted as <span className="text-brand-silver">{token?.customer_name}</span>
        </p>
      </div>
    </div>
  )
}
