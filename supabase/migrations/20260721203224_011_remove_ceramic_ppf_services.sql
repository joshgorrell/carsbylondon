-- Remove Ceramic Coating and Paint Protection Film services.
-- The business only offers tint and detailing.
-- Deleting the services cascades to packages and add_ons via FK CASCADE.
-- pricing_rules has no FK (uses slug string), so delete those rows explicitly.

BEGIN;

DELETE FROM pricing_rules
WHERE service IN ('ceramic_coating', 'paint_protection_film');

DELETE FROM services
WHERE slug IN ('ceramic_coating', 'paint_protection_film');

-- Remove gallery items in coating/ppf categories and fix captions mentioning them
DELETE FROM gallery
WHERE category IN ('coating', 'ppf');

UPDATE gallery
SET caption = 'Full exterior detail and show-ready finish'
WHERE category = 'detailing'
  AND caption LIKE '%ceramic coating%';

-- Rewrite reviews that mention ceramic coating or PPF so they focus on tint/detailing
UPDATE reviews
SET review = 'I was nervous about letting anyone touch my 911 but London treated it like their own. Full detail — the gloss is insane. The booking platform showed me exactly what I was paying for.'
WHERE customer_name = 'Jasmine L.';

UPDATE reviews
SET review = 'Got the full front of my STI protected after a rock chip scared me. London''s attention to detail is next level. Booked online in like a minute.'
WHERE customer_name = 'David R.';

UPDATE reviews
SET review = 'The detail on my Escalade is going on two years and the paint still looks like the day I picked it up. Worth every penny. The online booking made it so easy.'
WHERE customer_name = 'Sarah K.';

-- Reorder remaining services to close gaps left by removed services
UPDATE services SET display_order = 1 WHERE slug = 'window_tint';
UPDATE services SET display_order = 2 WHERE slug = 'detailing';
UPDATE services SET display_order = 3 WHERE slug = 'quote';

COMMIT;
