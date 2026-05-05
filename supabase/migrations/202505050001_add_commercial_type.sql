-- Migration: Add commercial_type column to SPF tables
-- Date: 2025-05-05

-- Add commercial_type column to spf_creation table
ALTER TABLE spf_creation
ADD COLUMN IF NOT EXISTS commercial_type TEXT DEFAULT '-';

-- Add commercial_type column to spf_creation_history table
ALTER TABLE spf_creation_history
ADD COLUMN IF NOT EXISTS commercial_type TEXT DEFAULT '-';

-- Add commercial_type column to spf_creation_draft table
ALTER TABLE spf_creation_draft
ADD COLUMN IF NOT EXISTS commercial_type TEXT DEFAULT '-';
