import { useEffect, useState, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSquarePayments } from '../hooks/useSquarePayments'
import { formatPrice } from '../lib/format'

interface PayToken {
  id: string
  appointment_id: string
  amount: number
  customer_name: string
  customer_email: string
  vehicle: string
  services: string
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export default function Pay() {
  const [params] = useSearchParams()
  const tokenId = params.get('token')

  const [token, setToken] = useState<PayToken | null>(null)
  const [liveBalance, setLiveBalance] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [paid, setPaid] = useState(false)
  const [paidAmount, setPaidAmount] = useState(0)
  const [remainingAfterPay, setRemainingAfterPay] = useState(0)
  const [cardReady, setCardReady] = useState(false)
  const [cardFailed, setCardFailed] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [customMode, setCustomMode] = useState(false)
  const [customAmount, setCustomAmount] = useState('')

  const { payments, error: initError, loading: sdkLoading } = useSquarePayments()
  const cardRef = useRef<HTMLDivElement>(null)
  const cardInstance = useRef<any>(null)

  const fetchBalance = useCallback(async (apptId: string) => {
    const { data: appt } = await supabase.from('appointments')
      .select('balance_due')
      .eq('id', apptId)
      .maybeSingle()
    return appt?.balance_due ?? 0
  }, [])

  // Load token data
  useEffect(() => {
    if (!tokenId) {
      setLoading(false)
      setError('No payment link provided. Check your email for a valid payment link.')
      return
    }
    let mounted = true
    const load = async () => {
      const { data, error: qErr } = await supabase.from('payment_tokens')
        .select('id, appointment_id, amount, customer_name, customer_email, vehicle, services')
        .eq('id', tokenId)
        .maybeSingle()
      if (!mounted) return
      if (qErr || !data) {
        setError('Invalid or expired payment link.')
        setLoading(false)
        return
      }
      setToken(data)
      const balance = await fetchBalance(data.appointment_id)
      if (!mounted) return
      setLiveBalance(balance)
      setLoading(false)
    }
    load()
    return () => { mounted = false }
  }, [tokenId, fetchBalance])

  // Initialize card form
  useEffect(() => {
    if (!payments || !cardRef.current || !token) return
    let destroyed = false
    setCardFailed(false)

    payments.card().then(async (card) => {
      if (destroyed) { card.destroy(); return }
      cardInstance.current = card
      await card.attach(cardRef.current!)
      if (!destroyed) setCardReady(true)
    }).catch((e: any) => {
      if (!destroyed) {
        setCardFailed(true)
        setLocalError(`Card form failed to load: ${e.message || 'Unknown error'}`)
      }
    })

    return () => { destroyed = true; cardInstance.current?.destroy() }
  }, [payments, token])

  const getChargeAmount = (): number => {
    if (customMode) {
      const cents = Math.round(parseFloat(customAmount || '0') * 100)
      return cents
    }
    return liveBalance
  }

  const handlePay = async () => {
    if (!cardInstance.current || !token) return

    const chargeAmount = getChargeAmount()
    if (customMode && (chargeAmount <= 0 || chargeAmount > liveBalance)) {
      setLocalError(`Amount must be between $0.01 and ${(liveBalance / 100).toFixed(2)}.`)
      return
    }

    setProcessing(true)
    setLocalError(null)
    try {
      const result = await cardInstance.current.tokenize()
      if (result.errors?.length) {
        setLocalError(result.errors[0]?.message || 'Card validation failed')
        setProcessing(false)
        return
      }

      const res = await fetch(`${supabaseUrl}/functions/v1/square`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: '/link-payment',
          token_id: token.id,
          source_id: result.token,
          ...(customMode ? { amount: chargeAmount } : {}),
        }),
      })
      const data = await res.json()
      if (data.error) {
        const errStr = typeof data.error === 'string' ? data.error
          : Array.isArray(data.error) ? data.error.map((e: any) => e.detail || e.message || '').filter(Boolean).join('; ')
          : JSON.stringify(data.error)
        throw new Error(errStr || 'Payment failed')
      }

      setPaidAmount(chargeAmount)
      setRemainingAfterPay(data.remaining_balance ?? 0)
      setLiveBalance(data.remaining_balance ?? 0)
      setPaid(true)
      setCustomMode(false)
      setCustomAmount('')

      // Reset card form for next payment
      if (cardInstance.current) {
        await cardInstance.current.destroy()
        cardInstance.current = null
        setCardReady(false)
      }
    } catch (e: any) {
      setLocalError(e.message || 'Payment failed. Please try again.')
    } finally {
      setProcessing(false)
    }
  }

  const handlePayAgain = async () => {
    setPaid(false)
    setPaidAmount(0)
    setRemainingAfterPay(0)
    setLocalError(null)

    // Re-initialize card form
    if (payments && cardRef.current) {
      payments.card().then(async (card) => {
        cardInstance.current = card
        await card.attach(cardRef.current!)
        setCardReady(true)
      }).catch((e: any) => {
        setCardFailed(true)
        setLocalError(`Card form failed to load: ${e.message || 'Unknown error'}`)
      })
    }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
          <p className="text-brand-silver text-sm">Loading payment details…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="card p-8 max-w-md w-full text-center bg-card-gradient">
          <h2 className="text-xl font-semibold text-white mb-2">Payment Link Error</h2>
          <p className="text-brand-silver text-sm">{error}</p>
          <p className="text-brand-silver-dark text-xs mt-4">If you believe this is an error, please contact us and we'll help you complete your payment.</p>
        </div>
      </div>
    )
  }

  if (paid) {
    const fullyPaid = remainingAfterPay <= 0
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="card p-8 max-w-md w-full text-center bg-card-gradient">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
          </div>
          <h2 className="text-2xl font-semibold text-white mb-2">Payment Complete</h2>
          <p className="text-brand-silver text-sm mb-1">Thank you{token?.customer_name ? `, ${token.customer_name}` : ''}!</p>
          <p className="text-brand-silver text-sm">Your payment of {formatPrice(paidAmount)} has been processed successfully.</p>
          {fullyPaid ? (
            <p className="text-green-400 text-sm mt-4 font-medium">Your balance is fully paid. We'll see you at your appointment!</p>
          ) : (
            <p className="text-brand-silver text-sm mt-4">Remaining balance: <span className="text-white font-semibold">{formatPrice(remainingAfterPay)}</span></p>
          )}
          {!fullyPaid && (
            <button onClick={handlePayAgain} className="btn-primary mt-6 w-full">
              Make Another Payment
            </button>
          )}
          <p className="text-brand-silver-dark text-xs mt-6">You can save this link to make additional payments anytime. If you have any questions, just reach out!</p>
        </div>
      </div>
    )
  }

  const noBalance = liveBalance <= 0
  const displayAmount = getChargeAmount()
  const showLoading = sdkLoading || (!cardReady && !cardFailed && !localError && !initError)

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="card p-8 max-w-md w-full bg-card-gradient">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-semibold text-white mb-1">Make a Payment</h1>
          <p className="text-brand-silver-dark text-sm">Secure payment powered by Square</p>
        </div>

        {token && (
          <div className="bg-brand-muted/20 border border-brand-border rounded-lg p-4 mb-6 space-y-1">
            {token.customer_name && (
              <div className="flex justify-between text-sm">
                <span className="text-brand-silver">Name</span>
                <span className="text-white">{token.customer_name}</span>
              </div>
            )}
            {token.vehicle && (
              <div className="flex justify-between text-sm">
                <span className="text-brand-silver">Vehicle</span>
                <span className="text-white">{token.vehicle}</span>
              </div>
            )}
            {token.services && (
              <div className="flex justify-between text-sm">
                <span className="text-brand-silver">Services</span>
                <span className="text-white text-right max-w-[200px]">{token.services}</span>
              </div>
            )}
            <div className="flex justify-between text-sm pt-2 border-t border-brand-border">
              <span className="text-brand-silver font-medium">Balance Due</span>
              <span className={`font-bold text-lg ${noBalance ? 'text-green-400' : 'text-brand-blue'}`}>{formatPrice(liveBalance)}</span>
            </div>
          </div>
        )}

        {noBalance && (
          <div className="p-4 rounded-md bg-green-500/10 border border-green-500/30 text-green-400 text-sm mb-4 text-center">
            Your balance is fully paid. No payment needed.
          </div>
        )}

        {!noBalance && (
          <>
            {(localError || initError) && (
              <div className="p-4 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-sm mb-4">
                {localError || initError}
                {initError && (
                  <button onClick={() => window.location.reload()} className="block mt-2 text-red-400 underline text-sm">Refresh page</button>
                )}
              </div>
            )}

            {/* Amount selection */}
            <div className="mb-4">
              {!customMode ? (
                <button
                  onClick={() => { setCustomMode(true); setCustomAmount((liveBalance / 100).toFixed(2)) }}
                  className="text-xs text-brand-silver hover:text-brand-blue transition-colors underline"
                >
                  Want to pay a custom amount instead of the full balance?
                </button>
              ) : (
                <div className="space-y-2">
                  <label className="block text-xs text-brand-silver">Custom payment amount ($)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-silver-dark">$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="input pl-7"
                      placeholder="0.00"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                    />
                  </div>
                  <button
                    onClick={() => { setCustomMode(false); setCustomAmount('') }}
                    className="text-xs text-brand-silver hover:text-brand-blue transition-colors underline"
                  >
                    Pay full balance instead
                  </button>
                </div>
              )}
            </div>

            <div ref={cardRef} className={!cardReady ? 'min-h-[120px]' : ''} />

            {showLoading && (
              <div className="flex items-center justify-center py-8">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
                  <p className="text-brand-silver text-sm">Loading secure payment form…</p>
                </div>
              </div>
            )}

            {cardFailed && !cardReady && (
              <div className="p-4 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm mb-4">
                <p className="font-medium mb-1">Payment form couldn't load</p>
                <p className="text-amber-400/70 text-xs mb-3">This is usually caused by a browser ad blocker or a network issue. Try refreshing the page.</p>
                <button onClick={() => window.location.reload()} className="text-amber-400 underline text-sm">Refresh page</button>
              </div>
            )}

            <button
              onClick={handlePay}
              disabled={!cardReady || processing || (customMode && (!customAmount || parseFloat(customAmount) <= 0))}
              className={`w-full btn-primary mt-4 ${(!cardReady || processing) ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}
            >
              {processing ? 'Processing…' : `Pay ${displayAmount > 0 ? formatPrice(displayAmount) : ''}`}
            </button>

            {processing && (
              <div className="flex justify-center pt-2">
                <div className="w-6 h-6 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            <p className="text-center text-brand-silver-dark text-xs mt-4">
              Your card information is encrypted and processed securely by Square.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
