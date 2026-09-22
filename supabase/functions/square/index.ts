import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
}

async function getSquareCreds() {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const [{ data: vaultAccessToken }, { data: vaultLocationId }] = await Promise.all([
    supabase.rpc('get_vault_secret', { secret_name: 'SQUARE_ACCESS_TOKEN' }),
    supabase.rpc('get_vault_secret', { secret_name: 'SQUARE_LOCATION_ID' }),
  ])

  return {
    accessToken: vaultAccessToken || Deno.env.get('SQUARE_ACCESS_TOKEN'),
    locationId: vaultLocationId || Deno.env.get('SQUARE_LOCATION_ID'),
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const url = new URL(req.url)
    const urlPath = url.pathname.replace('/square', '')

    let action = urlPath
    let body: any = null
    if (req.method === 'POST') {
      try { body = await req.json() } catch { body = {} }
      action = body.path || urlPath
    }
    if (action && !action.startsWith('/')) action = '/' + action

    if (action === '/create-payment' && req.method === 'POST') {
      const { amount, appointment_id, source_id, customer_id, save_card } = body

      const { accessToken: squareAccessToken, locationId: squareLocationId } = await getSquareCreds()

      if (!squareAccessToken || !squareLocationId) {
        return new Response(
          JSON.stringify({ error: 'Square credentials not configured' }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // If save_card is requested, first create a Square customer + card on file
      let squareCustomerId: string | null = null
      let cardId: string | null = null

      if (save_card && customer_id) {
        // Fetch customer from DB to get their info
        const { data: customer } = await supabase.from('customers')
          .select('first_name, last_name, email, square_customer_id')
          .eq('id', customer_id)
          .maybeSingle()

        if (customer) {
          // Reuse existing Square customer or create one
          if (customer.square_customer_id) {
            squareCustomerId = customer.square_customer_id
          } else {
            const custRes = await fetch('https://connect.squareup.com/v2/customers', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${squareAccessToken}`,
                'Content-Type': 'application/json',
                'Square-Version': '2024-08-21',
              },
              body: JSON.stringify({
                idempotency_key: crypto.randomUUID(),
                given_name: customer.first_name,
                family_name: customer.last_name || '',
                email_address: customer.email || undefined,
              }),
            })
            const custData = await custRes.json()
            if (custRes.ok && custData.customer) {
              squareCustomerId = custData.customer.id
              await supabase.from('customers')
                .update({ square_customer_id: squareCustomerId })
                .eq('id', customer_id)
            }
          }

          // Save the card on file using the card nonce (source_id)
          if (squareCustomerId && source_id && !source_id.startsWith('ccof:')) {
            const cardRes = await fetch('https://connect.squareup.com/v2/cards', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${squareAccessToken}`,
                'Content-Type': 'application/json',
                'Square-Version': '2024-08-21',
              },
              body: JSON.stringify({
                idempotency_key: crypto.randomUUID(),
                source_id,
                card: { customer_id: squareCustomerId },
              }),
            })
            const cardData = await cardRes.json()
            if (cardRes.ok && cardData.card) {
              cardId = cardData.card.id
              await supabase.from('appointments')
                .update({ square_card_id: cardId })
                .eq('id', appointment_id)
            }
          }
        }
      }

      // Use card_id as source for the payment if we saved one, otherwise use original source_id
      const paymentSourceId = cardId || source_id

      const squareRes = await fetch('https://connect.squareup.com/v2/payments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${squareAccessToken}`,
          'Content-Type': 'application/json',
          'Square-Version': '2024-08-21',
        },
        body: JSON.stringify({
          source_id: paymentSourceId,
          idempotency_key: crypto.randomUUID(),
          amount_money: { amount, currency: 'USD' },
          location_id: squareLocationId,
          ...(squareCustomerId ? { customer_id: squareCustomerId } : {}),
        }),
      })

      const squareData = await squareRes.json()

      if (!squareRes.ok) {
        return new Response(
          JSON.stringify({ error: squareData.errors || 'Payment failed' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Update the existing pending payment record instead of inserting a duplicate
      const { error: updatePayErr } = await supabase.from('payments')
        .update({
          square_payment_id: squareData.payment.id,
          status: 'completed',
        })
        .eq('appointment_id', appointment_id)
        .eq('status', 'pending')

      // If no pending record was found, insert one as a fallback
      if (!updatePayErr) {
        const { data: updated } = await supabase.from('payments')
          .select('id')
          .eq('appointment_id', appointment_id)
          .eq('square_payment_id', squareData.payment.id)
          .maybeSingle()

        if (!updated) {
          await supabase.from('payments').insert({
            appointment_id,
            square_payment_id: squareData.payment.id,
            amount,
            status: 'completed',
            payment_type: 'deposit',
            payment_method: 'square',
          })
        }
      }

      await supabase.from('appointments')
        .update({ deposit_paid: true, status: 'confirmed' })
        .eq('id', appointment_id)

      // Internal booking push. This is deliberately non-blocking: a notification
      // failure must never turn a successful Square payment into a failed checkout.
      try {
        const { data: booking } = await supabase.from('appointments')
          .select('id, deposit_amount, customer:customers(first_name), vehicle:vehicles(year, make, model), services(name)')
          .eq('id', appointment_id)
          .maybeSingle()

        const vehicle = booking?.vehicle
          ? `${booking.vehicle.year} ${booking.vehicle.make} ${booking.vehicle.model}`
          : 'Vehicle'
        const services = (booking?.services || []).map((service: any) => service.name).join(', ') || 'Service'
        const deposit = ((booking?.deposit_amount ?? amount) / 100).toFixed(2)
        const adminUrl = `${Deno.env.get('SITE_URL') || 'https://carsbylondon.com'}/admin?booking=${encodeURIComponent(appointment_id)}`

        const ntfyRes = await fetch('https://ntfy.sh/london-tint-bookings-site', {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Title': 'New London Booking',
            'Priority': 'high',
            'Tags': 'car',
            'Click': adminUrl,
          },
          body: `${vehicle}\n${services}\nDeposit: ${deposit} PAID ✓\nTap to view booking`,
        })

        if (!ntfyRes.ok) {
          console.error('ntfy booking notification failed', ntfyRes.status, await ntfyRes.text())
        }
      } catch (notifyError) {
        console.error('ntfy booking notification error', notifyError)
      }

      return new Response(
        JSON.stringify({ success: true, payment_id: squareData.payment.id, card_id: cardId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === '/charge-card-on-file' && req.method === 'POST') {
      const { amount, appointment_id } = body

      const { accessToken: squareAccessToken, locationId: squareLocationId } = await getSquareCreds()

      if (!squareAccessToken || !squareLocationId) {
        return new Response(
          JSON.stringify({ error: 'Square credentials not configured' }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get the appointment's saved card and customer's Square ID
      const { data: appt } = await supabase.from('appointments')
        .select('square_card_id, customer_id')
        .eq('id', appointment_id)
        .maybeSingle()

      if (!appt || !appt.square_card_id) {
        return new Response(
          JSON.stringify({ error: 'No card on file for this appointment' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data: customer } = await supabase.from('customers')
        .select('square_customer_id')
        .eq('id', appt.customer_id)
        .maybeSingle()

      if (!customer || !customer.square_customer_id) {
        return new Response(
          JSON.stringify({ error: 'No Square customer profile found' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const squareRes = await fetch('https://connect.squareup.com/v2/payments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${squareAccessToken}`,
          'Content-Type': 'application/json',
          'Square-Version': '2024-08-21',
        },
        body: JSON.stringify({
          source_id: appt.square_card_id,
          customer_id: customer.square_customer_id,
          idempotency_key: crypto.randomUUID(),
          amount_money: { amount, currency: 'USD' },
          location_id: squareLocationId,
        }),
      })

      const squareData = await squareRes.json()

      if (!squareRes.ok) {
        return new Response(
          JSON.stringify({ error: squareData.errors || 'Card on file charge failed' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Record the balance payment
      await supabase.from('payments').insert({
        appointment_id,
        square_payment_id: squareData.payment.id,
        amount,
        status: 'completed',
        payment_type: 'balance',
        payment_method: 'card_on_file',
      })

      // Update balance due
      const { data: appt2 } = await supabase.from('appointments')
        .select('balance_due')
        .eq('id', appointment_id)
        .maybeSingle()

      if (appt2) {
        const newBalance = Math.max(0, appt2.balance_due - amount)
        await supabase.from('appointments')
          .update({ balance_due: newBalance })
          .eq('id', appointment_id)
      }

      return new Response(
        JSON.stringify({ success: true, payment_id: squareData.payment.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === '/create-balance-payment' && req.method === 'POST') {
      const { amount, appointment_id, source_id } = body

      const { accessToken: squareAccessToken, locationId: squareLocationId } = await getSquareCreds()

      if (!squareAccessToken || !squareLocationId) {
        return new Response(
          JSON.stringify({ error: 'Square credentials not configured' }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const squareRes = await fetch('https://connect.squareup.com/v2/payments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${squareAccessToken}`,
          'Content-Type': 'application/json',
          'Square-Version': '2024-08-21',
        },
        body: JSON.stringify({
          source_id,
          idempotency_key: crypto.randomUUID(),
          amount_money: { amount, currency: 'USD' },
          location_id: squareLocationId,
        }),
      })

      const squareData = await squareRes.json()

      if (!squareRes.ok) {
        return new Response(
          JSON.stringify({ error: squareData.errors || 'Payment failed' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Record the balance payment
      await supabase.from('payments').insert({
        appointment_id,
        square_payment_id: squareData.payment.id,
        amount,
        status: 'completed',
        payment_type: 'balance',
        payment_method: 'square',
      })

      // Update balance due
      const { data: appt } = await supabase.from('appointments')
        .select('balance_due')
        .eq('id', appointment_id)
        .maybeSingle()

      if (appt) {
        const newBalance = Math.max(0, appt.balance_due - amount)
        await supabase.from('appointments')
          .update({ balance_due: newBalance })
          .eq('id', appointment_id)
      }

      return new Response(
        JSON.stringify({ success: true, payment_id: squareData.payment.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === '/record-cash-payment' && req.method === 'POST') {
      const { amount, appointment_id } = body

      // Record the cash balance payment
      await supabase.from('payments').insert({
        appointment_id,
        amount,
        status: 'completed',
        payment_type: 'balance',
        payment_method: 'cash',
      })

      // Update balance due
      const { data: appt } = await supabase.from('appointments')
        .select('balance_due')
        .eq('id', appointment_id)
        .maybeSingle()

      if (appt) {
        const newBalance = Math.max(0, appt.balance_due - amount)
        await supabase.from('appointments')
          .update({ balance_due: newBalance })
          .eq('id', appointment_id)
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === '/record-discount' && req.method === 'POST') {
      const { amount, appointment_id, reason } = body

      // Record the discount as a payment entry
      await supabase.from('payments').insert({
        appointment_id,
        amount,
        status: 'completed',
        payment_type: 'discount',
        payment_method: 'discount',
      })

      // Update balance due
      const { data: appt } = await supabase.from('appointments')
        .select('balance_due')
        .eq('id', appointment_id)
        .maybeSingle()

      if (appt) {
        const newBalance = Math.max(0, appt.balance_due - amount)
        await supabase.from('appointments')
          .update({ balance_due: newBalance })
          .eq('id', appointment_id)
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === '/void-payment' && req.method === 'POST') {
      const { payment_id, appointment_id } = body

      // Fetch the payment to get its amount and verify it's voidable
      const { data: payment } = await supabase.from('payments')
        .select('id, amount, status, payment_method')
        .eq('id', payment_id)
        .maybeSingle()

      if (!payment) {
        return new Response(
          JSON.stringify({ error: 'Payment not found' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (payment.status !== 'completed') {
        return new Response(
          JSON.stringify({ error: 'Only completed payments can be voided' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Only cash and discount payments can be voided (card payments need real refunds)
      if (payment.payment_method !== 'cash' && payment.payment_method !== 'discount') {
        return new Response(
          JSON.stringify({ error: 'Card payments cannot be voided — use refund instead' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Mark the payment as voided
      await supabase.from('payments')
        .update({ status: 'voided' })
        .eq('id', payment_id)

      // Restore the balance due on the appointment
      const { data: appt } = await supabase.from('appointments')
        .select('balance_due, total_price, deposit_amount')
        .eq('id', appointment_id)
        .maybeSingle()

      if (appt) {
        const restoredBalance = Math.min(appt.total_price - appt.deposit_amount, appt.balance_due + payment.amount)
        await supabase.from('appointments')
          .update({ balance_due: restoredBalance })
          .eq('id', appointment_id)
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === '/link-payment' && req.method === 'POST') {
      const { token_id, source_id, amount: customAmount } = body

      const { accessToken: squareAccessToken, locationId: squareLocationId } = await getSquareCreds()

      if (!squareAccessToken || !squareLocationId) {
        return new Response(
          JSON.stringify({ error: 'Square credentials not configured' }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Look up the payment token and the live appointment balance
      const { data: payToken } = await supabase.from('payment_tokens')
        .select('id, appointment_id, amount, used')
        .eq('id', token_id)
        .maybeSingle()

      if (!payToken) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired payment link' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Fetch the current live balance from the appointment
      const { data: appt } = await supabase.from('appointments')
        .select('balance_due')
        .eq('id', payToken.appointment_id)
        .maybeSingle()

      const liveBalance = appt?.balance_due ?? 0

      // Determine charge amount: custom amount if provided and valid, otherwise the live balance
      let chargeAmount: number
      if (customAmount && customAmount > 0 && customAmount <= liveBalance) {
        chargeAmount = customAmount
      } else if (liveBalance > 0) {
        chargeAmount = liveBalance
      } else {
        return new Response(
          JSON.stringify({ error: 'No balance remaining on this booking.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Charge the card via Square
      const squareRes = await fetch('https://connect.squareup.com/v2/payments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${squareAccessToken}`,
          'Content-Type': 'application/json',
          'Square-Version': '2024-08-21',
        },
        body: JSON.stringify({
          source_id,
          idempotency_key: crypto.randomUUID(),
          amount_money: { amount: chargeAmount, currency: 'USD' },
          location_id: squareLocationId,
        }),
      })

      const squareData = await squareRes.json()

      if (!squareRes.ok) {
        return new Response(
          JSON.stringify({ error: squareData.errors || 'Payment failed' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Record the payment against the appointment
      await supabase.from('payments').insert({
        appointment_id: payToken.appointment_id,
        square_payment_id: squareData.payment.id,
        amount: chargeAmount,
        status: 'completed',
        payment_type: 'balance',
        payment_method: 'square',
      })

      // Update balance due
      const newBalance = Math.max(0, liveBalance - chargeAmount)
      await supabase.from('appointments')
        .update({ balance_due: newBalance })
        .eq('id', payToken.appointment_id)

      // Record usage timestamp but keep the link reusable
      await supabase.from('payment_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('id', token_id)

      return new Response(
        JSON.stringify({ success: true, payment_id: squareData.payment.id, remaining_balance: newBalance }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === '/register-apple-pay-domain' && req.method === 'POST') {
      const { accessToken: squareAccessToken } = await getSquareCreds()
      const headers = { ...corsHeaders, 'Content-Type': 'application/json' }

      if (!squareAccessToken) {
        return new Response(
          JSON.stringify({ error: 'Square credentials not configured' }),
          { status: 200, headers }
        )
      }

      const { domain } = body || {}
      if (!domain || typeof domain !== 'string') {
        return new Response(
          JSON.stringify({ error: 'Domain is required' }),
          { status: 200, headers }
        )
      }

      try {
        const squareRes = await fetch('https://connect.squareup.com/v2/apple-pay/domains', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${squareAccessToken}`,
            'Content-Type': 'application/json',
            'Square-Version': '2024-08-21',
          },
          body: JSON.stringify({ domain_name: domain }),
        })

        const squareData = await squareRes.json()

        if (!squareRes.ok) {
          const errStr = squareData.errors
            ? (Array.isArray(squareData.errors)
                ? squareData.errors.map((e: any) => e.detail || e.code || e.message || '').filter(Boolean).join('; ')
                : JSON.stringify(squareData.errors))
            : 'Domain registration failed'
          return new Response(
            JSON.stringify({ error: errStr, squareStatus: squareRes.status, squareRaw: squareData }),
            { status: 200, headers }
          )
        }

        return new Response(
          JSON.stringify({ success: true, domain }),
          { status: 200, headers }
        )
      } catch (err: any) {
        return new Response(
          JSON.stringify({ error: err.message || 'Network error contacting Square' }),
          { status: 200, headers }
        )
      }
    }

    if (action === '/check-apple-pay-domain' && req.method === 'POST') {
      const { accessToken: squareAccessToken } = await getSquareCreds()
      const headers = { ...corsHeaders, 'Content-Type': 'application/json' }

      if (!squareAccessToken) {
        return new Response(
          JSON.stringify({ error: 'Square credentials not configured' }),
          { status: 200, headers }
        )
      }

      const domain = body?.domain
      if (!domain) {
        return new Response(
          JSON.stringify({ error: 'Domain is required' }),
          { status: 200, headers }
        )
      }

      try {
        const squareRes = await fetch('https://connect.squareup.com/v2/apple-pay/domains', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${squareAccessToken}`,
            'Content-Type': 'application/json',
            'Square-Version': '2024-08-21',
          },
          body: JSON.stringify({ domain_name: domain }),
        })

        const squareData = await squareRes.json()

        if (!squareRes.ok) {
          const errStr = squareData.errors
            ? (Array.isArray(squareData.errors)
                ? squareData.errors.map((e: any) => e.detail || e.code || e.message || '').filter(Boolean).join('; ')
                : JSON.stringify(squareData.errors))
            : 'Domain check failed'
          return new Response(
            JSON.stringify({ error: errStr, status: squareData.status || 'UNKNOWN', squareStatus: squareRes.status }),
            { status: 200, headers }
          )
        }

        return new Response(
          JSON.stringify({ success: true, status: squareData.status, domain }),
          { status: 200, headers }
        )
      } catch (err: any) {
        return new Response(
          JSON.stringify({ error: err.message || 'Network error contacting Square' }),
          { status: 200, headers }
        )
      }
    }

    if (action === '/webhook' && req.method === 'POST') {
      const event = body || await req.json()

      if (event.type === 'payment.updated' && event.data.object.payment.status === 'COMPLETED') {
        const paymentId = event.data.object.payment.id
        await supabase.from('payments')
          .update({ status: 'completed' })
          .eq('square_payment_id', paymentId)
      }

      return new Response(
        JSON.stringify({ received: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === '/refund' && req.method === 'POST') {
      const { payment_id, appointment_id, amount } = body || await req.json()

      const { accessToken: squareAccessToken } = await getSquareCreds()

      if (!squareAccessToken) {
        return new Response(
          JSON.stringify({ error: 'Square credentials not configured' }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const refundBody: any = {
        payment_id,
        idempotency_key: crypto.randomUUID(),
      }

      // Square requires amount_money for partial refunds; for full refunds it can be omitted
      // but we include it when the amount is provided to support partial refunds
      if (amount) {
        refundBody.amount_money = { amount, currency: 'USD' }
      }

      const squareRes = await fetch('https://connect.squareup.com/v2/refunds', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${squareAccessToken}`,
          'Content-Type': 'application/json',
          'Square-Version': '2024-08-21',
        },
        body: JSON.stringify(refundBody),
      })

      const squareData = await squareRes.json()

      if (!squareRes.ok) {
        return new Response(
          JSON.stringify({ error: squareData.errors || 'Refund failed' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      await supabase.from('payments')
        .update({ status: 'refunded' })
        .eq('square_payment_id', payment_id)

      await supabase.from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', appointment_id)

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === '/send-booking-notification' && req.method === 'POST') {
      const { appointment_id } = body

      if (!appointment_id) {
        return new Response(
          JSON.stringify({ error: 'Appointment ID is required' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      try {
        const { data: booking } = await supabase.from('appointments')
          .select('id, deposit_amount, vehicle:vehicles(year, make, model), services(name)')
          .eq('id', appointment_id)
          .maybeSingle()

        if (!booking) {
          return new Response(
            JSON.stringify({ error: 'Booking not found' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const vehicle = booking.vehicle
          ? `${booking.vehicle.year} ${booking.vehicle.make} ${booking.vehicle.model}`
          : 'Vehicle'
        const services = (booking.services || []).map((service: any) => service.name).join(', ') || 'Service'
        const deposit = ((booking.deposit_amount ?? 0) / 100).toFixed(2)
        const adminUrl = `${Deno.env.get('SITE_URL') || 'https://carsbylondon.com'}/admin?booking=${encodeURIComponent(appointment_id)}`

        const ntfyRes = await fetch('https://ntfy.sh/london-tint-bookings-site', {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Title': 'New London Booking',
            'Priority': 'high',
            'Tags': 'car',
            'Click': adminUrl,
          },
          body: `${vehicle}\n${services}\nDeposit: ${deposit} PAID ✓\nTap to view booking`,
        })

        if (!ntfyRes.ok) {
          return new Response(
            JSON.stringify({ error: 'ntfy notification failed', status: ntfyRes.status }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } catch (notifyError: any) {
        return new Response(
          JSON.stringify({ error: notifyError.message || 'Failed to send notification' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
