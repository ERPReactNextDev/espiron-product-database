-- Add missing columns to spf_creation_draft to match spf_creation structure
-- This ensures proper data sync when finalizing drafts

ALTER TABLE spf_creation_draft 
ADD COLUMN IF NOT EXISTS final_unit_cost TEXT,
ADD COLUMN IF NOT EXISTS final_subtotal TEXT,
ADD COLUMN IF NOT EXISTS item_added_date TEXT,
ADD COLUMN IF NOT EXISTS item_added_author TEXT,
ADD COLUMN IF NOT EXISTS revision_remarks TEXT,
ADD COLUMN IF NOT EXISTS revision_type TEXT,
ADD COLUMN IF NOT EXISTS spf_remarks_procurement TEXT,
ADD COLUMN IF NOT EXISTS tds_pdf_urls TEXT;
