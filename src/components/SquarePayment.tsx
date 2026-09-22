import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useSquarePayments } from '../hooks/useSquarePayments'
import { formatPrice } from '../lib/format'

interface Props {
  amount: number
  appointmentId: string
  onSuccess: () => void
  onError: (msg: string) => void
}

export default function SquarePayment({ amount, appointmentId, onSuccess, onError }: Props) {
  const { payments, error: initError, loading: sdkLoading } = useSquarePayments()
  const [cardReady, setCardReady] = useState(false)
  const [cardFailed, setCardFailed] = useState(false)
  const [applePayReady, setApplePayReady] = useState(false)
  const [applePayError, setApplePayError] = useState<string | null>(null)
  const [registering, setRegistering] = useState(false)
  const [registerError, setRegisterError] = useState<string | null>(null)
  const [registerSuccess, setRegisterSuccess] = useState(false)
  const [googlePayReady, setGooglePayReady] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const cardRef = useRef<HTMLDivElement>(null)
  const googlePayRef = useRef<HTMLDivElement>(null)
  const cardInstance = useRef<any>(null)
  const applePayInstance = useRef<any>(null)
  const googlePayInstance = useRef<any>(null)

  const amountStr = (amount / 100).toFixed(2)

  // Initialize Card
  useEffect(() => {
    if (!payments || !cardRef.current) return
    let destroyed = false
    setCardFailed(false)

    payments.card().then(async (card) => {
      if (destroyed) { card.destroy(); return }
      cardInstance.current = card
      await card.attach(cardRef.current!)
      if (!destroyed) setCardReady(true)
    }).catch((e) => {
      if (!destroyed) {
        setCardFailed(true)
        setLocalError(`Card form failed to load: ${e.message || 'Unknown error'}`)
      }
    })

    return () => { destroyed = true; cardInstance.current?.destroy() }
  }, [payments])

  // Initialize Apple Pay — no attach() needed, we render our own button
  const [applePayRetryKey, setApplePayRetryKey] = useState(0)
  const [domainStatus, setDomainStatus] = useState<string | null>(null)

  useEffect(() => {
    if (!payments) return
    let destroyed = false
    setApplePayReady(false)
    setApplePayError(null)

    const paymentRequest = payments.paymentRequest({
      countryCode: 'US',
      currencyCode: 'USD',
      total: { amount: amountStr, label: 'Deposit' },
    })

    payments.applePay(paymentRequest).then(async (applePay) => {
      if (destroyed) { await applePay.destroy(); return }
      applePayInstance.current = applePay
      if (!destroyed) setApplePayReady(true)
    }).catch((e) => {
      if (!destroyed) {
        const msg = e?.message || String(e)
        console.warn('[Apple Pay] Not available:', msg)
        setApplePayError(msg)
        // Check domain registration status
        checkDomainStatus()
      }
    })

    return () => { destroyed = true; applePayInstance.current?.destroy() }
  }, [payments, amountStr, applePayRetryKey])

  const checkDomainStatus = async () => {
    try {
      const domain = window.location.hostname
      const { data } = await supabase.functions.invoke('square', {
        body: { path: 'check-apple-pay-domain', domain },
      })
      if (data?.success) {
        setDomainStatus(data.status || 'UNKNOWN')
      } else if (data?.error) {
        setDomainStatus(`check failed: ${typeof data.error === 'string' ? data.error : JSON.stringify(data.error)}`)
      }
    } catch {
      setDomainStatus('unable to check')
    }
  }

  // Initialize Google Pay — attach() renders the Google Pay button
  useEffect(() => {
    if (!payments || !googlePayRef.current) return
    let destroyed = false

    const paymentRequest = payments.paymentRequest({
      countryCode: 'US',
      currencyCode: 'USD',
      total: { amount: amountStr, label: 'Deposit' },
    })

    payments.googlePay(paymentRequest).then(async (googlePay) => {
      if (destroyed) { googlePay.destroy(); return }
      googlePayInstance.current = googlePay
      await googlePay.attach(googlePayRef.current!)
      if (!destroyed) setGooglePayReady(true)
    }).catch(() => {
      // Google Pay not available — silently skip
    })

    return () => { destroyed = true; googlePayInstance.current?.destroy() }
  }, [payments, amountStr])

  const processPayment = async (token: string) => {
    setProcessing(true); setLocalError(null)
    try {
      const { data, error } = await supabase.functions.invoke('square', {
        body: { path: 'create-payment', amount, appointment_id: appointmentId, source_id: token },
      })
      if (error) throw new Error(error.message || 'Payment request failed')
      if (data?.error) {
        const errStr = typeof data.error === 'string' ? data.error
          : Array.isArray(data.error) ? data.error.map((e: any) => e.detail || e.message || '').filter(Boolean).join('; ')
          : JSON.stringify(data.error)
        throw new Error(errStr || 'Payment failed')
      }
      onSuccess()
    } catch (e: any) {
      const msg = e.message || 'Payment failed. Please try again.'
      setLocalError(msg)
      onError(msg)
    } finally {
      setProcessing(false)
    }
  }

  const handleCardSubmit = async () => {
    if (!cardInstance.current) return
    setProcessing(true); setLocalError(null)
    try {
      const result = await cardInstance.current.tokenize()
      if (result.errors?.length) {
        setLocalError(result.errors[0]?.message || 'Card validation failed')
        setProcessing(false)
        return
      }
      await processPayment(result.token)
    } catch (e: any) {
      setLocalError(e.message || 'Card tokenization failed')
      setProcessing(false)
    }
  }

  const handleGooglePayClick = async () => {
    if (!googlePayInstance.current) return
    setProcessing(true); setLocalError(null)
    try {
      const result = await googlePayInstance.current.tokenize()
      if (result.errors?.length) {
        setLocalError(result.errors[0]?.message || 'Google Pay failed')
        setProcessing(false)
        return
      }
      await processPayment(result.token)
    } catch (e: any) {
      setLocalError(e.message || 'Google Pay failed')
      setProcessing(false)
    }
  }

  const handleApplePayClick = async () => {
    if (!applePayInstance.current) return
    setProcessing(true); setLocalError(null)
    try {
      const result = await applePayInstance.current.tokenize()
      if (result.errors?.length) {
        setLocalError(result.errors[0]?.message || 'Apple Pay failed')
        setProcessing(false)
        return
      }
      await processPayment(result.token)
    } catch (e: any) {
      const msg = e?.message || 'Apple Pay failed'
      setLocalError(msg)
      setProcessing(false)
      if (msg.includes('unexpected error') || msg.includes('Apple Pay')) {
        checkDomainStatus()
      }
    }
  }

  const registerApplePayDomain = async () => {
    setRegistering(true); setRegisterError(null); setRegisterSuccess(false)
    try {
      const domain = window.location.hostname
      const { data, error } = await supabase.functions.invoke('square', {
        body: { path: 'register-apple-pay-domain', domain },
      })
      if (data?.error) {
        const errStr = typeof data.error === 'string' ? data.error
          : Array.isArray(data.error) ? data.error.map((e: any) => e.detail || e.code || e.message || '').filter(Boolean).join('; ')
          : JSON.stringify(data.error)
        throw new Error(errStr || 'Registration failed')
      }
      if (error) throw new Error(error.message || 'Registration failed')
      setRegisterSuccess(true)
      setApplePayError(null)
      setTimeout(() => {
        setRegisterSuccess(false)
        setApplePayRetryKey(k => k + 1)
      }, 2000)
    } catch (e: any) {
      setRegisterError(e.message || 'Registration failed')
    } finally {
      setRegistering(false)
    }
  }

  if (initError) {
    return (
      <div className="card p-6 bg-red-500/5 border-red-500/30">
        <p className="text-red-400 text-sm font-medium mb-2">Payment system unavailable</p>
        <p className="text-red-400/70 text-xs">{initError}</p>
      </div>
    )
  }

  const showLoading = sdkLoading || (!cardReady && !cardFailed && !localError && !initError)
  const hasWallet = applePayReady || googlePayReady

  return (
    <div className="space-y-4">
      {(localError || initError) && (
        <div className="p-4 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {localError || initError}
        </div>
      )}

      {/* Digital wallet buttons */}
      <div className="space-y-3">
        {(applePayReady || googlePayReady) && (
          <div className="flex gap-3">
            {applePayReady && (
              <button
                onClick={handleApplePayClick}
                disabled={processing}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-md bg-black text-white text-sm font-medium hover:bg-gray-900 transition-colors disabled:opacity-50"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.6 13.4c0-2.2 1.8-3.3 1.9-3.3-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.7.8-3.4.8-.7 0-1.8-.8-3-.8-1.5 0-2.9.9-3.7 2.3-1.6 2.8-.4 6.8 1.1 9.1.7 1.1 1.6 2.4 2.8 2.3 1.1 0 1.5-.7 2.8-.7 1.3 0 1.7.7 2.8.7 1.2 0 1.9-1.1 2.6-2.2.8-1.2 1.2-2.4 1.2-2.5-.1 0-2.3-.9-2.3-3.5zM15.3 7.1c.6-.7 1-1.7.9-2.7-.9 0-1.9.6-2.5 1.3-.5.6-1 1.6-.9 2.6 1 .1 1.9-.5 2.5-1.2z"/></svg>
                Apple Pay
              </button>
            )}
            <div ref={googlePayRef} className={googlePayReady ? 'flex-1' : 'hidden'} onClick={googlePayReady ? handleGooglePayClick : undefined} />
          </div>
        )}
        {hasWallet && (
          <div className="flex items-center gap-3 my-2">
            <div className="flex-1 h-px bg-brand-border" />
            <span className="text-xs text-brand-silver-dark uppercase tracking-wider">or pay with card</span>
            <div className="flex-1 h-px bg-brand-border" />
          </div>
        )}
      </div>

      {/* Apple Pay error with domain registration */}
      {((applePayError && !applePayReady) || (localError && localError.includes('Apple Pay'))) && (
        <div className="p-4 rounded-md bg-amber-500/5 border border-amber-500/20">
          <p className="text-amber-300/90 text-xs font-medium mb-1">Apple Pay unavailable</p>
          <p className="text-amber-300/60 text-xs mb-1">Your domain may not be registered with Square for Apple Pay. Click below to register it automatically.</p>
          {applePayError && <p className="text-amber-300/40 text-xs mb-2 break-all">Error: {applePayError}</p>}
          {domainStatus && (
            <p className="text-amber-300/50 text-xs mb-2">Domain status: {domainStatus}</p>
          )}
          {registerError && <p className="text-red-400 text-xs mb-2">{registerError}</p>}
          {registerSuccess && <p className="text-green-400 text-xs mb-2">Domain registered! Retrying Apple Pay…</p>}
          <button onClick={registerApplePayDomain} disabled={registering} className="text-xs text-amber-300 underline disabled:opacity-50">
            {registering ? 'Registering…' : 'Register domain for Apple Pay'}
          </button>
        </div>
      )}

      {/* Card form */}
      <div ref={cardRef} className={!cardReady ? 'min-h-[120px]' : ''} />

      {/* Loading placeholder */}
      {showLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
            <p className="text-brand-silver text-sm">Loading secure payment form…</p>
          </div>
        </div>
      )}

      {/* Card failed to load */}
      {cardFailed && !cardReady && (
        <div className="p-4 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
          <p className="font-medium mb-1">Payment form couldn't load</p>
          <p className="text-amber-400/70 text-xs mb-3">This is usually caused by a browser ad blocker or a network issue. Try refreshing the page, or use a different browser.</p>
          <button onClick={() => window.location.reload()} className="text-amber-400 underline text-sm">Refresh page</button>
        </div>
      )}

      <button
        onClick={handleCardSubmit}
        disabled={!cardReady || processing}
        className={`w-full btn-primary ${(!cardReady || processing) ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}
      >
        {processing ? 'Processing…' : `Pay ${formatPrice(amount)} Deposit`}
      </button>

      {processing && (
        <div className="flex justify-center pt-2">
          <div className="w-6 h-6 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}
