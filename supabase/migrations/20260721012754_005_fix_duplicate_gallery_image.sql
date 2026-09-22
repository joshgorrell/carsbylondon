/* Fix duplicate gallery image — 116675 was used for two rows.
   Replace the "Tinted luxury SUV" row with a distinct car-only image. */
UPDATE gallery SET image = 'https://images.pexels.com/photos/3802522/pexels-photo-3802522.jpeg'
  WHERE image = 'https://images.pexels.com/photos/116675/pexels-photo-116675.jpeg'
    AND caption = 'Tinted luxury SUV';
