import { useEffect, useState, useRef } from 'react'

declare global {
  interface Window {
    Square?: {
      payments(appId: string, locationId: string): Promise<SquarePayments>
    }
  }
}

export interface SquarePayments {
  paymentRequest(options: PaymentRequestOptions): SquarePaymentRequest
  card(options?: any): Promise<SquareCard>
  applePay(paymentRequest: SquarePaymentRequest): Promise<SquareApplePay>
  googlePay(paymentRequest: SquarePaymentRequest): Promise<SquareGooglePay>
}

export interface PaymentRequestOptions {
  countryCode: string
  currencyCode: string
  total: { amount: string; label: string }
}

export interface SquarePaymentRequest {
  total: { amount: string; label: string }
}

export interface SquareCard {
  attach(selector: string | HTMLElement): Promise<void>
  tokenize(): Promise<{ token: string; details: any; status: string } | { errors: any[] }>
  destroy(): Promise<void>
}

export interface SquareApplePay {
  attach(selector: string | HTMLElement): Promise<void>
  tokenize(): Promise<{ token: string; details: any; status: string } | { errors: any[] }>
  destroy(): Promise<void>
}

export interface SquareGooglePay {
  attach(selector: string | HTMLElement): Promise<void>
  tokenize(): Promise<{ token: string; details: any; status: string } | { errors: any[] }>
  destroy(): Promise<void>
}

const appId = import.meta.env.VITE_SQUARE_APPLICATION_ID as string | undefined
const locationId = import.meta.env.VITE_SQUARE_LOCATION_ID as string | undefined

export function useSquarePayments() {
  const [payments, setPayments] = useState<SquarePayments | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const loadedRef = useRef(false)
  const doneRef = useRef(false)

  useEffect(() => {
    if (!appId || !locationId) {
      setError('Square credentials not configured')
      setLoading(false)
      return
    }

    let cancelled = false

    const init = async () => {
      const initPayments = async () => {
        try {
          const p = await window.Square!.payments(appId!, locationId!)
          if (cancelled) return
          doneRef.current = true
          setPayments(p)
        } catch (e: any) {
          if (cancelled) return
          doneRef.current = true
          setError(e.message || 'Failed to initialize Square')
        } finally {
          if (!cancelled) setLoading(false)
        }
      }

      if (window.Square) {
        await initPayments()
        return
      }

      const checkLoaded = setInterval(() => {
        if (window.Square) {
          clearInterval(checkLoaded)
          loadedRef.current = true
          initPayments()
        }
      }, 100)

      setTimeout(() => {
        clearInterval(checkLoaded)
        if (!cancelled && !doneRef.current) {
          doneRef.current = true
          setError('Square failed to load. Please refresh the page and try again.')
          setLoading(false)
        }
      }, 15000)
    }

    init()

    return () => { cancelled = true }
  }, [])

  return { payments, error, loading }
}
