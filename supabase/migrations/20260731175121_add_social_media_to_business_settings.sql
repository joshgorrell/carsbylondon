/*
# Add Social Media Fields to Business Settings

1. Modified Tables
   - `business_settings`
     - `facebook_url` (text, nullable) — full Facebook page URL entered by admin
     - `instagram_url` (text, nullable) — full Instagram profile URL entered by admin
     - `facebook_visible` (boolean, default false) — controls whether Facebook embed/link shows on the site
     - `instagram_visible` (boolean, default false) — controls whether Instagram link shows on the site

2. Notes
   - Both visibility flags default to false so nothing appears on the public site until the admin explicitly enables them
   - URLs are nullable so the admin can save visibility settings independently of entering URLs
*/

ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS facebook_url text,
  ADD COLUMN IF NOT EXISTS instagram_url text,
  ADD COLUMN IF NOT EXISTS facebook_visible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS instagram_visible boolean NOT NULL DEFAULT false;
