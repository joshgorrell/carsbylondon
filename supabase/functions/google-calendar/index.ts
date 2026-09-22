import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
}

interface GCalPayload {
  action: 'create' | 'update' | 'delete'
  appointment_id: string
  summary?: string
  description?: string
  start?: string
  end?: string
  google_event_id?: string | null
}

async function getAccessToken(): Promise<string | null> {
  const clientEmail = Deno.env.get('GOOGLE_CLIENT_EMAIL')
  const privateKeyRaw = Deno.env.get('GOOGLE_PRIVATE_KEY')
  if (!clientEmail || !privateKeyRaw) return null

  const privateKey = privateKeyRaw.replace(/\\n/g, '\n')

  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/calendar',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }

  const enc = (obj: object) => btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const unsigned = `${enc(header)}.${enc(payload)}`

  const keyData = privateKey
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '')
  const keyBytes = Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0))

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBytes.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(unsigned))
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  const jwt = `${unsigned}.${sigB64}`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  if (!tokenRes.ok) return null
  const tokenData = await tokenRes.json()
  return tokenData.access_token
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const body: GCalPayload = await req.json()
    const { action, appointment_id } = body

    const calendarId = Deno.env.get('GOOGLE_CALENDAR_ID')
    const accessToken = await getAccessToken()

    if (!calendarId || !accessToken) {
      return new Response(
        JSON.stringify({ error: 'Google Calendar not configured' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const gcalUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
    const gcalHeaders = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    }

    if (action === 'create' || action === 'update') {
      const eventData = {
        summary: body.summary || 'Appointment',
        description: body.description || '',
        start: { dateTime: body.start, timeZone: 'America/New_York' },
        end: { dateTime: body.end, timeZone: 'America/New_York' },
      }

      let res: Response
      if (action === 'update' && body.google_event_id) {
        res = await fetch(`${gcalUrl}/${body.google_event_id}`, {
          method: 'PUT',
          headers: gcalHeaders,
          body: JSON.stringify(eventData),
        })
      } else {
        res = await fetch(gcalUrl, {
          method: 'POST',
          headers: gcalHeaders,
          body: JSON.stringify(eventData),
        })
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        return new Response(
          JSON.stringify({ error: err.error?.message || 'Google Calendar API error' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      const event = await res.json()

      await supabase.from('appointments')
        .update({ google_event_id: event.id })
        .eq('id', appointment_id)

      return new Response(
        JSON.stringify({ success: true, google_event_id: event.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (action === 'delete') {
      if (body.google_event_id) {
        await fetch(`${gcalUrl}/${body.google_event_id}`, {
          method: 'DELETE',
          headers: gcalHeaders,
        })
      }

      await supabase.from('appointments')
        .update({ google_event_id: null })
        .eq('id', appointment_id)

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
