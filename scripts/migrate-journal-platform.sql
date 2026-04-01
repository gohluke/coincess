-- Journal Platform Upgrade: add publishing, slugs, and linked trades
-- Run in Supabase Dashboard SQL Editor

-- Add new columns
ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS linked_trades jsonb DEFAULT '[]';

-- Unique index on slug (only for non-null slugs)
CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_slug
  ON journal_entries(slug) WHERE slug IS NOT NULL;

-- Partial index for public entries feed
CREATE INDEX IF NOT EXISTS idx_journal_public
  ON journal_entries(is_public, published_at DESC) WHERE is_public = true;
