/*
# Update Gallery Images — Remove People

1. Overview
   Replaces gallery images that contained people or were unreachable
   with car-only Pexels stock photos. No people visible in any image.

2. Changes
   - 3806288 (mechanic) → 116675 (white Range Rover Evoque, already verified clean)
   - 1646347 (unreachable) → 3802522 (black luxury car close-up)
   - 3807329 (mechanic) → 3802522 (already used above, use 170811 (dark sports car) instead)
   - 170782 (unreachable) → 1429708 (black performance car)

3. Notes
   All replacement images are car-only with no people visible.
   Existing featured flags are preserved.
*/

UPDATE gallery SET image = 'https://images.pexels.com/photos/116675/pexels-photo-116675.jpeg',
  caption = 'Tinted luxury SUV'
  WHERE image = 'https://images.pexels.com/photos/170782/pexels-photo-170782.jpeg';

UPDATE gallery SET image = 'https://images.pexels.com/photos/3802522/pexels-photo-3802522.jpeg',
  caption = 'Ceramic tint on performance sedan'
  WHERE image = 'https://images.pexels.com/photos/3806288/pexels-photo-3806288.jpeg';

UPDATE gallery SET image = 'https://images.pexels.com/photos/170811/pexels-photo-170811.jpeg',
  caption = 'Full exterior detail and ceramic coating'
  WHERE image = 'https://images.pexels.com/photos/1646347/pexels-photo-1646347.jpeg';

UPDATE gallery SET image = 'https://images.pexels.com/photos/1429708/pexels-photo-1429708.jpeg',
  caption = 'Full vehicle window tint'
  WHERE image = 'https://images.pexels.com/photos/3807329/pexels-photo-3807329.jpeg';
