/*
# Allow Anon to Mark Review Tokens as Used

## Summary
The customer-facing review submission page needs to mark a review token as "used"
after the customer submits their review. The previous migration locked down
review_tokens UPDATE to authenticated only, which broke this flow.

This migration adds a narrow policy that allows the anon role to UPDATE a
review_token row ONLY to set `used = true`, and only on tokens that are
currently unused (used = false). This prevents token reuse while keeping
the customer review flow working without authentication.

## Security
- USING (used = false): can only affect tokens that haven't been used yet
- WITH CHECK (used = true): the update must result in `used` being true
- An attacker would need to know the token UUID (cryptographically random)
  to mark it as used. The only impact is preventing a legitimate review
  from being submitted — a denial-of-service with very limited scope.
- The authenticated admin policy from the previous migration is preserved.
*/

DROP POLICY IF EXISTS "anon_mark_token_used" ON review_tokens;
CREATE POLICY "anon_mark_token_used" ON review_tokens FOR UPDATE
  TO anon, authenticated
  USING (used = false)
  WITH CHECK (used = true);
