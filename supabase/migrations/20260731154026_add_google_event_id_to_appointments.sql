/*
# Add Google Calendar event ID column to appointments

1. Overview
   Adds a nullable `google_event_id` text column to the `appointments` table.
   This stores the Google Calendar event ID created by the one-way sync edge
   function, so that reschedules and cancellations can update or delete the
   corresponding Google Calendar event.

2. Modified Tables
   - `appointments`
     - New column: `google_event_id` (text, nullable). Null means the
       appointment has not yet been synced to Google Calendar.

3. Security
   - No changes to RLS. The existing admin_update_appointments policy
     already allows authenticated users to update all columns, which
     covers the new column.
*/

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS google_event_id text;
