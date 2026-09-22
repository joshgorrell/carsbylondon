/* Fix remaining duplicate: 3802522 used for two rows.
   Give "Tinted luxury SUV" a distinct car-only image. */
UPDATE gallery SET image = 'https://images.pexels.com/photos/170811/pexels-photo-170811.jpeg'
  WHERE caption = 'Tinted luxury SUV';
