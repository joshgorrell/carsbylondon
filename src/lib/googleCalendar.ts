const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar`

const headers = () => ({
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
})

export interface GCalEventInput {
  appointment_id: string
  summary: string
  description: string
  start: string
  end: string
  google_event_id?: string | null
}

export async function syncToGoogleCalendar(
  action: 'create' | 'update' | 'delete',
  payload: GCalEventInput | { appointment_id: string; google_event_id: string },
): Promise<{ google_event_id?: string; error?: string }> {
  try {
    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ action, ...payload }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return { error: err.error || `Request failed (${res.status})` }
    }
    const data = await res.json()
    if (data.error) return { error: data.error }
    return { google_event_id: data.google_event_id }
  } catch (e: any) {
    return { error: e.message || 'Network error' }
  }
}
