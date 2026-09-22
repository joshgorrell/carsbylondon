/*
# Add Google Review URL to Business Settings

1. Modified Tables
- `business_settings`: adds `google_review_url` column (text, nullable)
  - Stores the business's Google review link (e.g. https://g.page/r/XXXXXXXXX/review)
  - When set, the public Reviews page and review request emails will include a button/link directing customers to leave a review on Google.

2. Security
- No new RLS changes needed — `business_settings` already has existing policies for anon read and admin write.
*/

ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS google_review_url text;
