-- Add verified_interpretation column to stories table
-- Stores the Verified vs. Interpretation breakdown produced by Claude during verification.
-- Shape: { verified: string[], interpretation: string[], headerNote?: string }

alter table stories
  add column if not exists verified_interpretation jsonb default null;
