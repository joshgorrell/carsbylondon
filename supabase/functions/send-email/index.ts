import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) {
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { type, payload } = await req.json()

    // Fetch admin email from business_settings
    const { data: settings } = await supabase
      .from('business_settings')
      .select('email, business_name')
      .eq('id', 1)
      .maybeSingle()

    const adminEmail = settings?.email || ''
    const businessName = settings?.business_name || 'London Auto Studio'

    if (type === 'new_review_notification') {
      // Email to admin: a new review was submitted
      const { customer_name, rating, review_text, vehicle, review_id } = payload

      if (!adminEmail) {
        return new Response(
          JSON.stringify({ error: 'No admin email configured in business settings' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating)
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #e5e5e5; padding: 32px; border-radius: 8px;">
          <h2 style="color: #2563eb; margin-bottom: 4px;">New Review Submitted</h2>
          <p style="color: #888; margin-top: 0;">Someone left a review on ${businessName}</p>
          <div style="background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <p style="margin: 0 0 8px;"><strong style="color: #888;">From:</strong> <span style="color: #fff;">${customer_name}</span></p>
            ${vehicle ? `<p style="margin: 0 0 8px;"><strong style="color: #888;">Vehicle:</strong> <span style="color: #fff;">${vehicle}</span></p>` : ''}
            <p style="margin: 0 0 12px;"><strong style="color: #888;">Rating:</strong> <span style="color: #2563eb; font-size: 18px;">${stars}</span></p>
            <p style="margin: 0; color: #ccc; font-style: italic;">"${review_text}"</p>
          </div>
          <p style="color: #888; font-size: 14px;">This review is pending your approval. Log in to your admin dashboard to approve or delete it.</p>
        </div>
      `

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `${businessName} <notifications@londonauto.studio>`,
          to: [adminEmail],
          subject: `New ${rating}-star review from ${customer_name}`,
          html,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        return new Response(
          JSON.stringify({ error: err.message || 'Failed to send email' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (type === 'review_request') {
      // Email to customer: please leave a review
      const { customer_email, customer_name, vehicle, token_id, site_url, google_review_url } = payload

      if (!customer_email) {
        return new Response(
          JSON.stringify({ error: 'No customer email provided' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      const reviewUrl = `${site_url}/review?token=${token_id}`
      const googleButton = google_review_url
        ? `<a href="${google_review_url}" target="_blank" rel="noopener noreferrer" style="background:#fff;color:#1a1a1a;text-decoration:none;padding:14px 32px;border-radius:6px;font-weight:bold;font-size:16px;display:inline-block;margin-left:8px;">Review on Google</a>`
        : ''
      const googleParagraph = google_review_url
        ? `<p style="color:#ccc;margin-top:24px;">Prefer to leave a review on Google? We'd appreciate that too.</p>`
        : ''

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #e5e5e5; padding: 32px; border-radius: 8px;">
          <h2 style="color: #2563eb; margin-bottom: 4px;">How Was Your Experience?</h2>
          <p style="color: #888; margin-top: 0;">Thanks for choosing ${businessName}, ${customer_name}.</p>
          ${vehicle ? `<p style="color: #ccc;">We hope your <strong>${vehicle}</strong> is looking great.</p>` : ''}
          <p style="color: #ccc;">We'd love to hear your thoughts — it only takes a minute and means a lot to a small business like ours.</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${reviewUrl}"
              style="background: #2563eb; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block;">
              Leave a Review
            </a>
            ${googleButton}
          </div>
          ${googleParagraph}
          <p style="color: #555; font-size: 12px; text-align: center;">This link is for one-time use only. If you have any questions, reply to this email.</p>
        </div>
      `

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `${businessName} <notifications@londonauto.studio>`,
          to: [customer_email],
          subject: `How was your experience at ${businessName}?`,
          html,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        return new Response(
          JSON.stringify({ error: err.message || 'Failed to send email' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (type === 'new_booking_notification') {
      const { customer_name, customer_phone, customer_email, vehicle, services, deposit_amount, appointment_id, site_url } = payload

      if (!adminEmail) {
        return new Response(
          JSON.stringify({ error: 'No admin email configured in business settings' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      const dashboardUrl = `${site_url}/admin?tab=deposits`
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #e5e5e5; padding: 32px; border-radius: 8px;">
          <h2 style="color: #2563eb; margin-bottom: 4px;">New Booking Request</h2>
          <p style="color: #888; margin-top: 0;">${customer_name} just submitted a booking request and paid their deposit.</p>
          <div style="background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <p style="margin: 0 0 8px;"><strong style="color: #888;">Customer:</strong> <span style="color: #fff;">${customer_name}</span></p>
            <p style="margin: 0 0 8px;"><strong style="color: #888;">Phone:</strong> <span style="color: #fff;">${customer_phone}</span></p>
            ${customer_email ? `<p style="margin: 0 0 8px;"><strong style="color: #888;">Email:</strong> <span style="color: #fff;">${customer_email}</span></p>` : ''}
            <p style="margin: 0 0 8px;"><strong style="color: #888;">Vehicle:</strong> <span style="color: #fff;">${vehicle}</span></p>
            <p style="margin: 0 0 8px;"><strong style="color: #888;">Services:</strong> <span style="color: #fff;">${services}</span></p>
            <p style="margin: 0;"><strong style="color: #888;">Deposit Paid:</strong> <span style="color: #2563eb; font-weight: bold;">${deposit_amount}</span></p>
          </div>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${dashboardUrl}"
              style="background: #2563eb; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block;">
              View in Dashboard
            </a>
          </div>
          <p style="color: #555; font-size: 12px; text-align: center;">You can schedule their appointment from the Waiting on Deposits tab.</p>
        </div>
      `

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `${businessName} <notifications@londonauto.studio>`,
          to: [adminEmail],
          subject: `New booking from ${customer_name} — ${services}`,
          html,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        return new Response(
          JSON.stringify({ error: err.message || 'Failed to send email' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (type === 'new_quote_notification') {
      const { customer_name, customer_phone, customer_email, vehicle, description, site_url } = payload

      if (!adminEmail) {
        return new Response(
          JSON.stringify({ error: 'No admin email configured in business settings' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      const dashboardUrl = `${site_url}/admin?tab=quotes`
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #e5e5e5; padding: 32px; border-radius: 8px;">
          <h2 style="color: #2563eb; margin-bottom: 4px;">New Quote Request</h2>
          <p style="color: #888; margin-top: 0;">${customer_name} is looking for a custom quote.</p>
          <div style="background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <p style="margin: 0 0 8px;"><strong style="color: #888;">Customer:</strong> <span style="color: #fff;">${customer_name}</span></p>
            <p style="margin: 0 0 8px;"><strong style="color: #888;">Phone:</strong> <span style="color: #fff;">${customer_phone}</span></p>
            ${customer_email ? `<p style="margin: 0 0 8px;"><strong style="color: #888;">Email:</strong> <span style="color: #fff;">${customer_email}</span></p>` : ''}
            <p style="margin: 0 0 8px;"><strong style="color: #888;">Vehicle:</strong> <span style="color: #fff;">${vehicle}</span></p>
            <p style="margin: 0; border-top: 1px solid #2a2a2a; padding-top: 12px;"><strong style="color: #888;">What they're looking for:</strong></p>
            <p style="margin: 8px 0 0; color: #ccc; font-style: italic;">"${description}"</p>
          </div>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${dashboardUrl}"
              style="background: #2563eb; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block;">
              View in Dashboard
            </a>
          </div>
          <p style="color: #555; font-size: 12px; text-align: center;">Reply to their email or give them a call to follow up with a quote.</p>
        </div>
      `

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `${businessName} <notifications@londonauto.studio>`,
          to: [adminEmail],
          subject: `New quote request from ${customer_name} — ${vehicle}`,
          html,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        return new Response(
          JSON.stringify({ error: err.message || 'Failed to send email' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (type === 'booking_confirmation') {
      const { customer_name, customer_email, vehicle, services, deposit_amount, balance_due, appointment_id, site_url } = payload

      if (!customer_email) {
        return new Response(
          JSON.stringify({ error: 'No customer email provided' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #e5e5e5; padding: 32px; border-radius: 8px;">
          <h2 style="color: #2563eb; margin-bottom: 4px;">Booking Received, ${customer_name}!</h2>
          <p style="color: #888; margin-top: 0;">Thanks for booking with ${businessName}.</p>
          <div style="background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <p style="margin: 0 0 8px;"><strong style="color: #888;">Vehicle:</strong> <span style="color: #fff;">${vehicle}</span></p>
            <p style="margin: 0 0 8px;"><strong style="color: #888;">Services:</strong> <span style="color: #fff;">${services}</span></p>
            <p style="margin: 0 0 8px;"><strong style="color: #888;">Deposit Paid:</strong> <span style="color: #2563eb; font-weight: bold;">${deposit_amount}</span></p>
            <p style="margin: 0;"><strong style="color: #888;">Balance Due at Appointment:</strong> <span style="color: #fff;">${balance_due}</span></p>
          </div>
          <p style="color: #ccc;">We've received your deposit and your appointment request. London will reach out personally within 1 business day to confirm your scheduled time.</p>
          <p style="color: #555; font-size: 12px; text-align: center; margin-top: 32px;">If you have any questions, just reply to this email.</p>
        </div>
      `

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `${businessName} <notifications@londonauto.studio>`,
          to: [customer_email],
          subject: `Your booking confirmation — ${businessName}`,
          html,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        return new Response(
          JSON.stringify({ error: err.message || 'Failed to send email' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (type === 'payment_receipt') {
      const { customer_name, customer_email, vehicle, services, deposit_amount, balance_paid, discount_amount, total_paid, payment_date, receipt_id } = payload

      if (!customer_email) {
        return new Response(
          JSON.stringify({ error: 'No customer email provided' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      const fmtMoney = (cents: number) => `${(cents / 100).toFixed(2)}`
      const dateStr = payment_date ? new Date(payment_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

      const rows: string[] = []
      if (deposit_amount > 0) rows.push(`<tr><td style="padding:8px 0;color:#888;">Deposit Paid</td><td style="padding:8px 0;text-align:right;color:#fff;">${fmtMoney(deposit_amount)}</td></tr>`)
      if (balance_paid > 0) rows.push(`<tr><td style="padding:8px 0;color:#888;">Balance Paid</td><td style="padding:8px 0;text-align:right;color:#fff;">${fmtMoney(balance_paid)}</td></tr>`)
      if (discount_amount > 0) rows.push(`<tr><td style="padding:8px 0;color:#888;">Discount Applied</td><td style="padding:8px 0;text-align:right;color:#22c55e;">-${fmtMoney(discount_amount)}</td></tr>`)
      rows.push(`<tr style="border-top:1px solid #2a2a2a;"><td style="padding:12px 0;font-weight:bold;color:#fff;">Total Paid</td><td style="padding:12px 0;text-align:right;font-weight:bold;color:#2563eb;font-size:18px;">${fmtMoney(total_paid)}</td></tr>`)

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #e5e5e5; padding: 32px; border-radius: 8px;">
          <h2 style="color: #2563eb; margin-bottom: 4px;">Payment Receipt</h2>
          <p style="color: #888; margin-top: 0;">${dateStr}</p>
          <p style="color: #ccc;">Thanks for choosing ${businessName}, ${customer_name}.</p>
          <div style="background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px; padding: 20px; margin: 24px 0;">
            ${vehicle ? `<p style="margin: 0 0 8px;"><strong style="color: #888;">Vehicle:</strong> <span style="color: #fff;">${vehicle}</span></p>` : ''}
            <p style="margin: 0 0 12px;"><strong style="color: #888;">Services:</strong> <span style="color: #fff;">${services}</span></p>
            <table style="width:100%;border-collapse:collapse;">${rows.join('')}</table>
          </div>
          <p style="color: #ccc;">Your vehicle has been serviced and your payment has been processed. We appreciate your business!</p>
          <p style="color: #555; font-size: 12px; text-align: center; margin-top: 32px;">Receipt #${receipt_id}. If you have any questions, just reply to this email.</p>
        </div>
      `

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `${businessName} <notifications@londonauto.studio>`,
          to: [customer_email],
          subject: `Payment receipt from ${businessName}`,
          html,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        return new Response(
          JSON.stringify({ error: err.message || 'Failed to send email' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (type === 'payment_link') {
      const { customer_name, customer_email, vehicle, services, balance_due, pay_url } = payload

      if (!customer_email) {
        return new Response(
          JSON.stringify({ error: 'No customer email provided' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      const fmtMoney = (cents: number) => `${(cents / 100).toFixed(2)}`
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #e5e5e5; padding: 32px; border-radius: 8px;">
          <h2 style="color: #2563eb; margin-bottom: 4px;">Payment Request from ${businessName}</h2>
          <p style="color: #888; margin-top: 0;">Hi ${customer_name},</p>
          <p style="color: #ccc;">You have a balance due of <strong style="color: #fff;">${fmtMoney(balance_due)}</strong> for your upcoming service.</p>
          <div style="background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px; padding: 20px; margin: 24px 0;">
            ${vehicle ? `<p style="margin: 0 0 8px;"><strong style="color: #888;">Vehicle:</strong> <span style="color: #fff;">${vehicle}</span></p>` : ''}
            ${services ? `<p style="margin: 0 0 8px;"><strong style="color: #888;">Services:</strong> <span style="color: #fff;">${services}</span></p>` : ''}
            <p style="margin: 0;"><strong style="color: #888;">Balance Due:</strong> <span style="color: #2563eb; font-weight: bold; font-size: 18px;">${fmtMoney(balance_due)}</span></p>
          </div>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${pay_url}"
              style="background: #2563eb; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block;">
              Pay Online Now
            </a>
          </div>
          <p style="color: #555; font-size: 12px; text-align: center;">This link is for one-time use only. If you have any questions, just reply to this email.</p>
        </div>
      `

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `${businessName} <notifications@londonauto.studio>`,
          to: [customer_email],
          subject: `Payment request from ${businessName}`,
          html,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        return new Response(
          JSON.stringify({ error: err.message || 'Failed to send email' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (type === 'quote_confirmation') {
      const { customer_name, customer_email, vehicle, description } = payload

      if (!customer_email) {
        return new Response(
          JSON.stringify({ error: 'No customer email provided' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #e5e5e5; padding: 32px; border-radius: 8px;">
          <h2 style="color: #2563eb; margin-bottom: 4px;">Quote Request Received, ${customer_name}!</h2>
          <p style="color: #888; margin-top: 0;">Thanks for reaching out to ${businessName}.</p>
          <div style="background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px; padding: 20px; margin: 24px 0;">
            ${vehicle ? `<p style="margin: 0 0 8px;"><strong style="color: #888;">Vehicle:</strong> <span style="color: #fff;">${vehicle}</span></p>` : ''}
            <p style="margin: 0; border-top: 1px solid #2a2a2a; padding-top: 12px;"><strong style="color: #888;">Your Request:</strong></p>
            <p style="margin: 8px 0 0; color: #ccc; font-style: italic;">"${description}"</p>
          </div>
          <p style="color: #ccc;">We'll review your request and reach out personally with your custom quote — usually within 1 business day.</p>
          <p style="color: #555; font-size: 12px; text-align: center; margin-top: 32px;">If you have any questions, just reply to this email.</p>
        </div>
      `

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `${businessName} <notifications@londonauto.studio>`,
          to: [customer_email],
          subject: `Your quote request — ${businessName}`,
          html,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        return new Response(
          JSON.stringify({ error: err.message || 'Failed to send email' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (type === 'work_order') {
      const { customer_name, customer_email, customer_phone, vehicle, order_id, line_items, total_price, deposit_amount, balance_due, notes, appointment_date } = payload

      if (!customer_email) {
        return new Response(
          JSON.stringify({ error: 'No customer email provided' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      const fmtMoney = (cents: number) => `${(cents / 100).toFixed(2)}`
      const apptDate = appointment_date
        ? new Date(appointment_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
        : ''

      const itemRows = (line_items || []).map((item: any) =>
        `<tr><td style="padding:8px 0;color:#e5e5e5;border-bottom:1px solid #2a2a2a;">${item.label}</td><td style="padding:8px 0;text-align:right;color:#fff;border-bottom:1px solid #2a2a2a;">${fmtMoney(item.price)}</td></tr>`
      ).join('')

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #e5e5e5; padding: 32px; border-radius: 8px;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid #2a2a2a;">
            <h2 style="color: #2563eb; margin: 0;">Work Order #${order_id}</h2>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:24px;">
            <div>
              <p style="margin:0 0 4px;color:#888;font-size:12px;">Customer</p>
              <p style="margin:0;color:#fff;font-weight:bold;">${customer_name}</p>
              <p style="margin:2px 0 0;color:#ccc;font-size:13px;">${customer_phone || ''}</p>
              <p style="margin:2px 0 0;color:#ccc;font-size:13px;">${customer_email}</p>
            </div>
            <div style="text-align:right;">
              <p style="margin:0 0 4px;color:#888;font-size:12px;">Vehicle</p>
              <p style="margin:0;color:#fff;font-weight:bold;">${vehicle || ''}</p>
              ${apptDate ? `<p style="margin:2px 0 0;color:#ccc;font-size:13px;">${apptDate}</p>` : ''}
            </div>
          </div>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr style="background:#1a1a1a;"><td style="padding:10px;color:#888;font-size:12px;font-weight:bold;text-transform:uppercase;">Item</td><td style="padding:10px;color:#888;font-size:12px;font-weight:bold;text-transform:uppercase;text-align:right;">Price</td></tr>
            ${itemRows}
          </table>
          <div style="margin-top:16px;">
            <div style="display:flex;justify-content:space-between;padding:8px 0;"><span style="color:#888;">Total Price</span><span style="color:#fff;font-weight:bold;">${fmtMoney(total_price)}</span></div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;"><span style="color:#888;">Deposit Paid</span><span style="color:#2563eb;">${fmtMoney(deposit_amount)}</span></div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid #2a2a2a;"><span style="color:#888;font-weight:bold;">Balance Due</span><span style="color:#2563eb;font-weight:bold;font-size:18px;">${fmtMoney(balance_due)}</span></div>
          </div>
          ${notes ? `<div style="margin-top:24px;padding:16px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;"><p style="margin:0 0 4px;color:#888;font-size:12px;">Notes</p><p style="margin:0;color:#ccc;font-size:13px;">${notes}</p></div>` : ''}
          <p style="color: #555; font-size: 12px; text-align: center; margin-top: 32px;">Work Order #${order_id} · Generated ${new Date().toLocaleDateString()}</p>
        </div>
      `

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `${businessName} <notifications@londonauto.studio>`,
          to: [customer_email],
          subject: `Work Order #${order_id} — ${businessName}`,
          html,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        return new Response(
          JSON.stringify({ error: err.message || 'Failed to send email' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({ error: 'Unknown email type' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
