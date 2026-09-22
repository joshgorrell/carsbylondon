/*
# Seed Catalog Data

1. Overview
   Populates services, packages, add_ons, pricing_rules, vehicle_mappings,
   gallery, and reviews with starter content for London Tint & Detail.

2. Data inserted
   - 5 services: Window Tint, Ceramic Coating, Paint Protection Film, Detailing, Request Quote
   - Packages per service with realistic prices (in cents) and durations (minutes)
   - 5 add-ons (windshield tint, tint removal, glass coating, leather protection, headlight restoration)
   - Pricing rules across 7 pricing classes for tint and detailing
   - ~20 vehicle mappings covering common enthusiast vehicles
   - 8 gallery placeholder entries (Pexels stock URLs)
   - 5 featured reviews

3. Notes
   - Prices are in cents (e.g. 49900 = $499.00)
   - Durations are in minutes
   - Uses ON CONFLICT DO NOTHING for idempotency on slug/service+pricing_class
*/

-- ---------- services ----------
INSERT INTO services (name, slug, description, active, display_order) VALUES
  ('Window Tint', 'window_tint', 'Premium ceramic window tint films engineered for heat rejection, UV protection, and clarity.', true, 1),
  ('Ceramic Coating', 'ceramic_coating', 'Advanced ceramic coatings that bond at the molecular level for years of protection.', true, 2),
  ('Paint Protection Film', 'paint_protection_film', 'Self-healing PPF that absorbs rock chips, scratches, and road debris.', true, 3),
  ('Detailing', 'detailing', 'Full interior and exterior detailing to restore and protect your vehicle.', true, 4),
  ('Request Quote', 'quote', 'Not sure what you need? Tell us about your vehicle and we''ll build a custom plan.', true, 5)
ON CONFLICT (slug) DO NOTHING;

-- ---------- packages (service_id resolved by slug) ----------
INSERT INTO packages (service_id, name, description, price, estimated_duration, warranty)
SELECT s.id, p.name, p.description, p.price, p.estimated_duration, p.warranty
FROM services s
JOIN (VALUES
  ('window_tint', 'Ceramic Carbon — Full Vehicle', 'Premium ceramic carbon film, all windows (excluding windshield). 99% UV block, 95% heat rejection.', 49900, 180, 'Lifetime'),
  ('window_tint', 'Ceramic Carbon — Windshield Add-On', 'Add windshield ceramic tint for maximum heat rejection and glare reduction.', 15000, 60, 'Lifetime'),
  ('window_tint', 'Standard Dyed — Full Vehicle', 'High-quality dyed film for privacy and UV protection at an accessible price.', 29900, 150, '5 Years'),
  ('ceramic_coating', 'Ceramic Pro Gold — 5 Year', 'Multi-layer ceramic coating with 5-year warranty. Hydrophobic, scratch-resistant.', 149900, 480, '5 Years'),
  ('ceramic_coating', 'Ceramic Pro Silver — 2 Year', 'Entry-level ceramic coating with 2-year protection and gloss enhancement.', 79900, 240, '2 Years'),
  ('ceramic_coating', 'Ceramic Pro Sport — 1 Year', 'Single-layer coating for seasonal protection and enhanced gloss.', 39900, 180, '1 Year'),
  ('paint_protection_film', 'Full Front Package', 'PPF on full hood, fenders, mirrors, and bumpers. Self-healing, 10-year warranty.', 249900, 600, '10 Years'),
  ('paint_protection_film', 'Track Package', 'PPF on hood front edge, fenders, mirrors, and A-pillars.', 149900, 360, '10 Years'),
  ('paint_protection_film', 'Custom Coverage', 'Custom PPF coverage tailored to your vehicle and driving habits.', 99900, 240, '10 Years'),
  ('detailing', 'Full Detail — Interior & Exterior', 'Complete interior shampoo, exterior decontamination, clay bar, and sealant.', 34900, 360, 'N/A'),
  ('detailing', 'Interior Detail', 'Deep clean interior: shampoo, leather conditioning, glass, and dressing.', 19900, 240, 'N/A'),
  ('detailing', 'Exterior Detail', 'Wash, decontamination, clay bar, polish, and wax/sealant.', 19900, 240, 'N/A'),
  ('quote', 'Custom Quote', 'Tell us about your vehicle and goals — we''ll build a tailored service plan.', 0, 0, 'Varies')
) AS p(slug, name, description, price, estimated_duration, warranty)
  ON s.slug = p.slug
ON CONFLICT DO NOTHING;

-- ---------- add_ons ----------
INSERT INTO add_ons (service_id, name, price, description)
SELECT s.id, a.name, a.price, a.description
FROM services s
JOIN (VALUES
  ('window_tint', 'Windshield Tint', 15000, 'Ceramic windshield tint for maximum heat rejection.'),
  ('window_tint', 'Tint Removal', 10000, 'Safe removal of existing film before new installation.'),
  ('ceramic_coating', 'Glass Coating', 12000, 'Hydrophobic coating for all glass surfaces.'),
  ('detailing', 'Leather Protection', 8000, 'Leather conditioner and protective coating.'),
  ('detailing', 'Headlight Restoration', 9000, 'Restore cloudy, oxidized headlights to like-new clarity.')
) AS a(slug, name, price, description)
  ON s.slug = a.slug
ON CONFLICT DO NOTHING;

-- ---------- pricing_rules ----------
INSERT INTO pricing_rules (service, pricing_class, base_price, deposit, duration) VALUES
  ('window_tint', 'sedan', 49900, 5000, 180),
  ('window_tint', 'coupe', 49900, 5000, 180),
  ('window_tint', 'mid_suv', 59900, 6000, 210),
  ('window_tint', 'large_suv', 69900, 7000, 240),
  ('window_tint', 'truck', 59900, 6000, 210),
  ('window_tint', 'van', 69900, 7000, 240),
  ('window_tint', 'motorcycle', 29900, 3000, 90),
  ('ceramic_coating', 'sedan', 79900, 15000, 240),
  ('ceramic_coating', 'coupe', 79900, 15000, 240),
  ('ceramic_coating', 'mid_suv', 99900, 20000, 300),
  ('ceramic_coating', 'large_suv', 119900, 25000, 360),
  ('ceramic_coating', 'truck', 99900, 20000, 300),
  ('ceramic_coating', 'van', 119900, 25000, 360),
  ('ceramic_coating', 'motorcycle', 49900, 10000, 180),
  ('paint_protection_film', 'sedan', 149900, 30000, 360),
  ('paint_protection_film', 'coupe', 149900, 30000, 360),
  ('paint_protection_film', 'mid_suv', 199900, 40000, 480),
  ('paint_protection_film', 'large_suv', 249900, 50000, 600),
  ('paint_protection_film', 'truck', 199900, 40000, 480),
  ('paint_protection_film', 'van', 249900, 50000, 600),
  ('detailing', 'sedan', 34900, 5000, 360),
  ('detailing', 'coupe', 34900, 5000, 360),
  ('detailing', 'mid_suv', 44900, 5000, 360),
  ('detailing', 'large_suv', 54900, 7500, 420),
  ('detailing', 'truck', 44900, 5000, 360),
  ('detailing', 'van', 54900, 7500, 420),
  ('detailing', 'motorcycle', 24900, 2500, 240)
ON CONFLICT (service, pricing_class) DO NOTHING;

-- ---------- vehicle_mappings ----------
INSERT INTO vehicle_mappings (make, model, trim, pricing_class, body_style) VALUES
  ('Subaru', 'WRX', NULL, 'sedan', 'Sedan'),
  ('Subaru', 'WRX STI', NULL, 'sedan', 'Sedan'),
  ('Subaru', 'Impreza', NULL, 'sedan', 'Sedan'),
  ('Ford', 'F-150', 'SuperCrew', 'truck', 'Truck'),
  ('Ford', 'F-150', NULL, 'truck', 'Truck'),
  ('Ford', 'F-250', NULL, 'truck', 'Truck'),
  ('Tesla', 'Model Y', NULL, 'mid_suv', 'SUV'),
  ('Tesla', 'Model 3', NULL, 'sedan', 'Sedan'),
  ('Tesla', 'Model X', NULL, 'large_suv', 'SUV'),
  ('Tesla', 'Model S', NULL, 'sedan', 'Sedan'),
  ('Cadillac', 'Escalade', NULL, 'large_suv', 'SUV'),
  ('Chevrolet', 'Corvette', NULL, 'coupe', 'Coupe'),
  ('Chevrolet', 'Camaro', NULL, 'coupe', 'Coupe'),
  ('Nissan', 'GT-R', NULL, 'coupe', 'Coupe'),
  ('Nissan', 'Skyline', NULL, 'coupe', 'Coupe'),
  ('Toyota', 'Supra', NULL, 'coupe', 'Coupe'),
  ('Toyota', 'GR86', NULL, 'coupe', 'Coupe'),
  ('Honda', 'Civic', 'Type R', 'sedan', 'Sedan'),
  ('Porsche', '911', NULL, 'coupe', 'Coupe'),
  ('Porsche', 'Cayenne', NULL, 'mid_suv', 'SUV'),
  ('BMW', 'M3', NULL, 'sedan', 'Sedan'),
  ('BMW', 'M4', NULL, 'coupe', 'Coupe'),
  ('BMW', 'X5', NULL, 'mid_suv', 'SUV'),
  ('Audi', 'RS6', NULL, 'sedan', 'Sedan'),
  ('Mercedes-Benz', 'C63', NULL, 'sedan', 'Sedan'),
  ('Mercedes-Benz', 'G-Wagon', NULL, 'large_suv', 'SUV'),
  ('Jeep', 'Wrangler', NULL, 'mid_suv', 'SUV'),
  ('Chevrolet', 'Silverado', NULL, 'truck', 'Truck'),
  ('RAM', '1500', NULL, 'truck', 'Truck')
ON CONFLICT DO NOTHING;

-- ---------- gallery (Pexels stock images) ----------
INSERT INTO gallery (image, category, featured, caption) VALUES
  ('https://images.pexels.com/photos/3806288/pexels-photo-3806288.jpeg', 'tint', true, 'Ceramic tint on performance sedan'),
  ('https://images.pexels.com/photos/1646347/pexels-photo-1646347.jpeg', 'detailing', true, 'Full exterior detail and ceramic coating'),
  ('https://images.pexels.com/photos/3786091/pexels-photo-3786091.jpeg', 'coating', true, 'Ceramic coating application'),
  ('https://images.pexels.com/photos/3807329/pexels-photo-3807329.jpeg', 'tint', false, 'Full vehicle window tint'),
  ('https://images.pexels.com/photos/3593922/pexels-photo-3593922.jpeg', 'detailing', false, 'Interior deep clean'),
  ('https://images.pexels.com/photos/2127733/pexels-photo-2127733.jpeg', 'ppf', true, 'Paint protection film on hood'),
  ('https://images.pexels.com/photos/116675/pexels-photo-116675.jpeg', 'detailing', false, 'Show-ready finish'),
  ('https://images.pexels.com/photos/170782/pexels-photo-170782.jpeg', 'tint', false, 'Tinted luxury SUV')
ON CONFLICT DO NOTHING;

-- ---------- reviews ----------
INSERT INTO reviews (customer_name, vehicle, rating, review, featured, created_at) VALUES
  ('Marcus T.', '2023 Tesla Model Y', 5, 'London tinted my Model Y in under two hours and the heat rejection is unreal. Booking was effortless — paid my deposit online and showed up. Zero phone calls needed.', true, now() - interval '14 days'),
  ('Sarah K.', '2021 Cadillac Escalade', 5, 'The ceramic coating on my Escalade is going on two years and water still beads like the day I picked it up. Worth every penny. The online booking made it so easy.', true, now() - interval '30 days'),
  ('David R.', '2017 Subaru WRX STI', 5, 'Got PPF on the full front of my STI after a rock chip scared me. The film is invisible and London''s attention to detail is next level. Booked online in like a minute.', true, now() - interval '45 days'),
  ('Jasmine L.', '2020 Porsche 911', 5, 'I was nervous about letting anyone touch my 911 but London treated it like their own. Full detail and ceramic coating — the gloss is insane. The booking platform showed me exactly what I was paying for.', true, now() - interval '60 days'),
  ('Tyler M.', '2019 Ford F-150', 5, 'Tinted my F-150 and added the windshield tint. Best decision for Texas summers. The deposit system made it feel professional and legit. Highly recommend.', true, now() - interval '75 days')
ON CONFLICT DO NOTHING;
