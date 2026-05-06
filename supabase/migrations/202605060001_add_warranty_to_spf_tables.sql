-- Migration: Add warranty column to SPF tables
-- Date: 2026-05-06

-- Add warranty column to spf_creation table
ALTER TABLE spf_creation
ADD COLUMN IF NOT EXISTS warranty TEXT DEFAULT '-';

-- Add warranty column to spf_creation_history table
ALTER TABLE spf_creation_history
ADD COLUMN IF NOT EXISTS warranty TEXT DEFAULT '-';

-- Add warranty column to spf_creation_draft table
ALTER TABLE spf_creation_draft
ADD COLUMN IF NOT EXISTS warranty TEXT DEFAULT '-';
