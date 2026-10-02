# Complete Database Schema & SQL Guide
## Espiron Product Database - Full Documentation for PHP Migration

**Last Updated:** September 25, 2026  
**Format:** PostgreSQL / Supabase SQL  
**Target:** PHP Backend Migration  
**Table Prefix:** `espiron_`

---

## Summary Table - All Tables with espiron_ Prefix

| # | Table Name | Storage | Type | Key Field |
|---|---|---|---|---|
| 1 | espiron_fcm_tokens | Supabase | Device | id |
| 2 | espiron_email_accounts | Supabase | Config | id |
| 3 | espiron_product_usage | Supabase | Metadata | id |
| 4 | espiron_product_family | Supabase | Metadata | id |
| 5 | espiron_spf_request | Supabase | Parent | spf_number |
| 6 | espiron_spf_creation | Supabase | Detail | spf_number |
| 7 | espiron_spf_creation_history | Supabase | Audit | spf_number + version |
| 8 | espiron_spf_creation_draft | Supabase | Working | spf_number |
| 9 | espiron_spf_request_revision | Supabase | Revision | spf_number + revision |
| 10 | espiron_spf_request_revision_history | Supabase | Audit | spf_number + revision |
| 11 | espiron_add_product | Firebase | Document | productId |
| 12 | espiron_edit_product | Firebase | Audit | productId |
| 13 | espiron_add_supplier | Firebase | Document | supplierId |
| 14 | espiron_edit_supplier | Firebase | Audit | supplierId |
| 15 | espiron_filters | Firebase | Document | filterId |
| 16 | espiron_audit_logs | Firebase | Collections | entryId |
| 17 | espiron_notes | Firebase | Document | noteId |

---

## Supabase Setup Script - Copy & Paste Ready

```sql
-- ============================================================================
-- ESPIRON PRODUCT DATABASE SCHEMA
-- All tables prefixed with espiron_
-- Run this entire script to create all Supabase PostgreSQL tables
-- ============================================================================

-- 1. espiron_fcm_tokens
CREATE TABLE IF NOT EXISTS espiron_fcm_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  device_info JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_espiron_fcm_tokens_user_id ON espiron_fcm_tokens(user_id);
CREATE INDEX idx_espiron_fcm_tokens_token ON espiron_fcm_tokens(token);

-- 2. espiron_email_accounts
CREATE TABLE IF NOT EXISTS espiron_email_accounts (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  email_address TEXT NOT NULL,
  provider TEXT,
  smtp_host TEXT,
  smtp_port INT,
  smtp_encryption TEXT,
  smtp_username TEXT,
  smtp_password TEXT,
  imap_host TEXT,
  imap_port INT,
  imap_encryption TEXT,
  imap_username TEXT,
  imap_password TEXT,
  signature TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_espiron_email_accounts_user_id ON espiron_email_accounts(user_id);
CREATE INDEX idx_espiron_email_accounts_email ON espiron_email_accounts(email_address);
CREATE INDEX idx_espiron_email_accounts_is_default ON espiron_email_accounts(user_id, is_default);

-- 3. espiron_product_usage
CREATE TABLE IF NOT EXISTS espiron_product_usage (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  reference_id TEXT,
  created_by TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_espiron_product_usage_name ON espiron_product_usage(name);
CREATE INDEX idx_espiron_product_usage_is_active ON espiron_product_usage(is_active);
CREATE INDEX idx_espiron_product_usage_reference_id ON espiron_product_usage(reference_id);

-- 4. espiron_product_family
CREATE TABLE IF NOT EXISTS espiron_product_family (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  product_usage_id TEXT NOT NULL REFERENCES espiron_product_usage(id) ON DELETE CASCADE,
  description TEXT,
  reference_id TEXT,
  created_by TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_espiron_product_family_name ON espiron_product_family(name);
CREATE INDEX idx_espiron_product_family_product_usage_id ON espiron_product_family(product_usage_id);
CREATE INDEX idx_espiron_product_family_is_active ON espiron_product_family(is_active);
CREATE UNIQUE INDEX idx_espiron_product_family_unique_per_usage ON espiron_product_family(name, product_usage_id);

-- 3. espiron_spf_request
CREATE TABLE IF NOT EXISTS espiron_spf_request (
  id BIGSERIAL PRIMARY KEY,
  spf_number TEXT UNIQUE NOT NULL,
  reference_id → reference_id
  tsm → tsm (keep as is)
  manager → manager (keep as is)
  status TEXT,
  customer_name TEXT,
  item_code TEXT,
  special_instructions TEXT,
  clientName TEXT,
  date_created TIMESTAMP WITH TIME ZONE,
  date_updated TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_espiron_spf_request_spf_number ON espiron_spf_request(spf_number);
CREATE INDEX idx_espiron_spf_request_status ON espiron_spf_request(status);
CREATE INDEX idx_espiron_spf_request_reference_id ON espiron_spf_request(reference_id);
CREATE INDEX idx_espiron_spf_request_date_created ON espiron_spf_request(date_created DESC);

-- 5. espiron_spf_creation
CREATE TABLE IF NOT EXISTS espiron_spf_creation (
  id BIGSERIAL PRIMARY KEY,
  spf_number TEXT UNIQUE NOT NULL REFERENCES espiron_spf_request(spf_number) ON DELETE CASCADE,
  reference_id → reference_id
  tsm → tsm (keep as is)
  manager → manager (keep as is)
  item_added_author TEXT,
  status TEXT,
  previous_status TEXT,
  date_created TEXT,
  date_updated TEXT,
  item_code TEXT,
  company_name TEXT,
  supplier_brand TEXT,
  contact_name TEXT,
  contact_number TEXT,
  product_offer_image TEXT,
  product_offer_qty TEXT,
  product_offer_technical_specification TEXT,
  original_technical_specification TEXT,
  product_reference_id TEXT,
  supplier_branch TEXT,
  spf_remarks_pd TEXT,
  commercial_type TEXT,
  product_name TEXT,
  product_offer_unit_cost TEXT,
  product_offer_pcs_per_carton TEXT,
  product_offer_packaging_details TEXT,
  warranty TEXT,
  product_offer_factory_address TEXT,
  product_offer_port_of_discharge TEXT,
  product_offer_subtotal TEXT,
  supplier_model_code TEXT,
  final_selling_cost TEXT,
  proj_lead_time TEXT,
  price_validity TEXT,
  moq TEXT,
  quotations_validity TEXT,
  production_lead_time TEXT,
  delivery_lead_time TEXT,
  dimensional_drawing TEXT,
  illuminance_drawing TEXT,
  tds TEXT,
  spf_creation_start_time TEXT,
  spf_creation_end_time TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_espiron_spf_creation_spf_number ON espiron_spf_creation(spf_number);
CREATE INDEX idx_espiron_spf_creation_status ON espiron_spf_creation(status);
CREATE INDEX idx_espiron_spf_creation_product_reference_id ON espiron_spf_creation(product_reference_id);
CREATE INDEX idx_espiron_spf_creation_date_updated ON espiron_spf_creation(date_updated DESC);

-- 6. espiron_spf_creation_history
CREATE TABLE IF NOT EXISTS espiron_spf_creation_history (
  id BIGSERIAL PRIMARY KEY,
  spf_number TEXT NOT NULL REFERENCES espiron_spf_request(spf_number) ON DELETE CASCADE,
  version_number BIGINT NOT NULL,
  version_label TEXT,
  created_at TEXT,
  edited_by TEXT,
  item_added_author TEXT,
  date_updated TEXT,
  status TEXT,
  reference_id → reference_id
  tsm → tsm (keep as is)
  manager → manager (keep as is)
  item_code TEXT,
  company_name TEXT,
  supplier_brand TEXT,
  contact_name TEXT,
  contact_number TEXT,
  product_offer_image TEXT,
  product_offer_qty TEXT,
  product_offer_technical_specification TEXT,
  original_technical_specification TEXT,
  product_reference_id TEXT,
  supplier_branch TEXT,
  spf_remarks_pd TEXT,
  commercial_type TEXT,
  product_name TEXT,
  product_offer_unit_cost TEXT,
  product_offer_pcs_per_carton TEXT,
  product_offer_packaging_details TEXT,
  warranty TEXT,
  product_offer_factory_address TEXT,
  product_offer_port_of_discharge TEXT,
  product_offer_subtotal TEXT,
  supplier_model_code TEXT,
  final_selling_cost TEXT,
  proj_lead_time TEXT,
  price_validity TEXT,
  moq TEXT,
  quotations_validity TEXT,
  production_lead_time TEXT,
  delivery_lead_time TEXT,
  dimensional_drawing TEXT,
  illuminance_drawing TEXT,
  tds TEXT,
  spf_creation_start_time TEXT,
  spf_creation_end_time TEXT,
  history_created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_espiron_spf_creation_history_spf_number ON espiron_spf_creation_history(spf_number);
CREATE INDEX idx_espiron_spf_creation_history_version_number ON espiron_spf_creation_history(spf_number, version_number DESC);
CREATE INDEX idx_espiron_spf_creation_history_edited_by ON espiron_spf_creation_history(edited_by);

-- 7. espiron_spf_creation_draft
CREATE TABLE IF NOT EXISTS espiron_spf_creation_draft (
  id BIGSERIAL PRIMARY KEY,
  spf_number TEXT UNIQUE NOT NULL,
  reference_id → reference_id
  tsm → tsm (keep as is)
  manager → manager (keep as is)
  draft_author TEXT,
  status TEXT DEFAULT 'Draft',
  is_edit_mode BOOLEAN DEFAULT FALSE,
  original_spf_number TEXT,
  date_created TEXT,
  date_updated TEXT,
  item_code TEXT,
  company_name TEXT,
  supplier_brand TEXT,
  contact_name TEXT,
  contact_number TEXT,
  product_offer_image TEXT,
  product_offer_qty TEXT,
  product_offer_technical_specification TEXT,
  original_technical_specification TEXT,
  product_reference_id TEXT,
  supplier_branch TEXT,
  spf_remarks_pd TEXT,
  commercial_type TEXT,
  product_name TEXT,
  product_offer_unit_cost TEXT,
  product_offer_pcs_per_carton TEXT,
  product_offer_packaging_details TEXT,
  warranty TEXT,
  product_offer_factory_address TEXT,
  product_offer_port_of_discharge TEXT,
  product_offer_subtotal TEXT,
  supplier_model_code TEXT,
  final_selling_cost TEXT,
  proj_lead_time TEXT,
  price_validity TEXT,
  moq TEXT,
  quotations_validity TEXT,
  production_lead_time TEXT,
  delivery_lead_time TEXT,
  dimensional_drawing TEXT,
  illuminance_drawing TEXT,
  tds TEXT,
  tds_brand TEXT,
  is_existing TEXT,
  tds_pdf_urls TEXT,
  final_unit_cost TEXT,
  final_subtotal TEXT,
  item_added_date TEXT,
  revision_remarks TEXT,
  revision_type TEXT,
  spf_remarks_procurement TEXT,
  spf_creation_start_time TEXT,
  spf_creation_end_time TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_espiron_spf_creation_draft_spf_number ON espiron_spf_creation_draft(spf_number);
CREATE INDEX idx_espiron_spf_creation_draft_draft_author ON espiron_spf_creation_draft(draft_author);
CREATE INDEX idx_espiron_spf_creation_draft_is_edit_mode ON espiron_spf_creation_draft(is_edit_mode);

-- 8. espiron_spf_request_revision
CREATE TABLE IF NOT EXISTS espiron_spf_request_revision (
  id BIGSERIAL PRIMARY KEY,
  spf_number TEXT NOT NULL REFERENCES espiron_spf_request(spf_number) ON DELETE CASCADE,
  reference_id → reference_id
  tsm → tsm (keep as is)
  manager → manager (keep as is)
  status TEXT,
  customer_name TEXT,
  item_code TEXT,
  special_instructions TEXT,
  clientName TEXT,
  date_created TIMESTAMP WITH TIME ZONE,
  date_updated TIMESTAMP WITH TIME ZONE,
  revision_number BIGINT,
  spf_revision_approval_sales_status TEXT,
  spf_revision_approval_sales_date TIMESTAMP WITH TIME ZONE,
  revision_date TIMESTAMP WITH TIME ZONE,
  spf_revision_remarks_engineering TEXT,
  spf_revision_remarks_sales TEXT,
  latest_approver TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_espiron_spf_request_revision_spf_number ON espiron_spf_request_revision(spf_number);
CREATE INDEX idx_espiron_spf_request_revision_status ON espiron_spf_request_revision(spf_revision_approval_sales_status);
CREATE INDEX idx_espiron_spf_request_revision_number ON espiron_spf_request_revision(spf_number, revision_number DESC);

-- 9. espiron_spf_request_revision_history
CREATE TABLE IF NOT EXISTS espiron_spf_request_revision_history (
  id BIGSERIAL PRIMARY KEY,
  spf_number TEXT NOT NULL REFERENCES espiron_spf_request(spf_number) ON DELETE CASCADE,
  revision_number BIGINT NOT NULL,
  date_created TIMESTAMP WITH TIME ZONE,
  date_updated TIMESTAMP WITH TIME ZONE,
  spf_revision_approval_sales_status TEXT,
  spf_revision_approval_sales_date TIMESTAMP WITH TIME ZONE,
  revision_date TIMESTAMP WITH TIME ZONE,
  revision_result TEXT,
  spf_revision_remarks_engineering TEXT,
  spf_revision_remarks_sales TEXT,
  latest_approver TEXT,
  reference_id → reference_id
  tsm → tsm (keep as is)
  manager → manager (keep as is)
  status TEXT,
  customer_name TEXT,
  item_code TEXT,
  special_instructions TEXT,
  clientName TEXT,
  history_created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_espiron_spf_request_revision_history_spf_number ON espiron_spf_request_revision_history(spf_number);
CREATE INDEX idx_espiron_spf_request_revision_history_revision_number ON espiron_spf_request_revision_history(spf_number, revision_number);
```

---

## Firebase Collections Documentation

### espiron_add_product

**Purpose:** Product creation records with family and usage classifications  
**Storage:** Firebase Firestore (Document Collection)  
**Document ID:** Auto-generated (productId)

```json
{
  "productName": "LED Panel 600x600 36W 4000K",
  "productClass": "Classification A",
  "pricePoint": "STANDARD",
  "brandOrigin": "CHINA",
  "supplier": {
    "supplierId": "SUP-123456",
    "company": "Supplier A Co Ltd",
    "supplierBrand": "Brand X"
  },
  "countries": ["CN", "VN"],
  "categoryTypes": [
    {
      "productUsageId": "CAT-001",
      "categoryTypeName": "Lighting"
    }
  ],
  "productFamilies": [
    {
      "productFamilyId": "FAM-001",
      "productFamilyName": "LED Panels",
      "productUsageId": "CAT-001"
    }
  ],
  "technicalSpecifications": [
    {
      "id": "SPEC-001",
      "title": "BRIGHTNESS",
      "specs": [
        {
          "specId": "lm",
          "value": "3600",
          "unit": "lm"
        },
        {
          "specId": "cri",
          "value": ">90",
          "unit": "CRI"
        }
      ]
    }
  ],
  "commercialDetails": {
    "commercialType": "BASIC",
    "unitCost": 35.50,
    "pcsPerCarton": 20,
    "packaging": {
      "length": "610",
      "width": "610",
      "height": "50"
    },
    "warranty": "3 years",
    "factoryAddress": "XinRui Industrial Zone, Shenzhen",
    "portOfDischarge": "Shanghai Port"
  },
  "mainImage": {
    "url": "https://res.cloudinary.com/...",
    "publicId": "products/...",
    "name": "main_image.jpg"
  },
  "dimensionalDrawing": {
    "url": "https://res.cloudinary.com/...",
    "publicId": "products/...",
    "name": "drawing.pdf"
  },
  "illuminanceDrawing": {
    "url": "https://res.cloudinary.com/...",
    "publicId": "products/...",
    "name": "illuminance.pdf"
  },
  "createdBy": "firebase-user-id",
  "createdAt": { "_seconds": 1695235200 },
  "date_updated": { "_seconds": 1695235200 },
  "isActive": true,
  "productReferenceID": "PROD-SPF-00001",
  "whatHappened": "Product Added"
}
```

**Fields:**

| Field | Type | Notes |
|-------|------|-------|
| productName | string | Product name (required) |
| productClass | string | Classification category |
| pricePoint | string | "ECONOMY", "STANDARD", "PREMIUM" |
| brandOrigin | string | "CHINA", "NON-CHINA" |
| **categoryTypes** | array | **Product Usage - Classification** |
| categoryTypes[].productUsageId | string | Category/Usage ID (e.g., "CAT-001") |
| categoryTypes[].categoryTypeName | string | Usage name (e.g., "Lighting", "Power Supply") |
| **productFamilies** | array | **Product Family - Sub-classification** |
| productFamilies[].productFamilyId | string | Family ID (e.g., "FAM-001") |
| productFamilies[].productFamilyName | string | Family name (e.g., "LED Panels", "50W Drivers") |
| productFamilies[].productUsageId | string | Links to parent category type |
| technicalSpecifications | array | Full specs with values |
| commercialDetails | object | Pricing, packaging, warranty info |
| supplier | object | { supplierId, company, supplierBrand } |
| countries | array | Country codes like ["CN", "VN"] |
| mainImage | object | { url, publicId, name } |
| dimensionalDrawing | object | { url, publicId, name } |
| illuminanceDrawing | object | { url, publicId, name } |
| productReferenceID | string | Generated ID (PROD-SPF-XXXXX) |
| createdBy | string | User ID |
| createdAt | timestamp | Firebase Timestamp |
| isActive | boolean | Active status |

**Hierarchy:**
```
categoryTypes (Product Usage - WHAT it's used for)
  ├── Lighting
  ├── Power Supply
  └── Distribution
       └── productFamilies (Product Family - WHICH type within usage)
            ├── LED Panels
            ├── LED Drivers
            └── Power Cables
                 └── technicalSpecifications (Specs for this family)
```

### espiron_product_usage (Metadata Collection)

Stores the available product usages/categories:

```json
{
  "id": "CAT-001",
  "name": "Lighting",
  "description": "LED Lighting products",
  "createdAt": { "_seconds": 1695235200 },
  "isActive": true
}
```

### espiron_product_family (Metadata Collection)

Stores the available product families:

```json
{
  "id": "FAM-001",
  "name": "LED Panels",
  "productUsageId": "CAT-001",
  "description": "600x600 and 1200x600 LED panel series",
  "createdAt": { "_seconds": 1695235200 },
  "isActive": true
}
```

### espiron_technicalSpecifications (Template Collection)

Stores technical specification templates for each family:

```json
{
  "id": "SPEC-001",
  "categoryTypeId": "CAT-001",
  "productFamilyId": "FAM-001",
  "title": "BRIGHTNESS",
  "sortOrder": 1,
  "specs": [
    {
      "specId": "lm",
      "unit": "lm",
      "isRanging": false,
      "isSlashing": false,
      "isDimension": false,
      "isRating": false
    },
    {
      "specId": "cri",
      "unit": "CRI",
      "isRanging": false,
      "isSlashing": false,
      "isDimension": false,
      "isRating": false
    }
  ],
  "isActive": true,
  "updatedAt": { "_seconds": 1695235200 }
}
```

---

## Supabase Metadata Tables Documentation

### 3. espiron_product_usage

**Purpose:** Master list of product usage categories (classifications of what products are used for)  
**Storage:** Supabase PostgreSQL  
**Primary Key:** id (text, manually assigned)  
**Independent Table:** No external dependencies

**SQL Definition:**
```sql
CREATE TABLE IF NOT EXISTS espiron_product_usage (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  reference_id TEXT,
  created_by TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**Data Structure:**

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| id | text | NO | Primary key (e.g., "CAT-001", "USAGE-LIGHTING") |
| name | text | NO | Unique name (e.g., "Lighting", "Power Supply", "Distribution") |
| description | text | YES | Detailed description |
| reference_id | text | YES | User's reference ID who created it |
| created_by | text | YES | User ID who created it |
| is_active | boolean | NO | Active/inactive status |
| created_at | timestamp | NO | Creation date |
| updated_at | timestamp | NO | Last updated date |

**Example Data:**
```json
{
  "id": "USAGE-LIGHTING",
  "name": "Lighting",
  "description": "LED Lighting and related products",
  "reference_id": "AE-NCR-749180",
  "created_by": "user-123",
  "is_active": true,
  "created_at": "2026-01-15T10:30:00Z",
  "updated_at": "2026-01-15T10:30:00Z"
}
```

**Common Operations:**

```sql
-- List all active product usages
SELECT id, name, description FROM espiron_product_usage 
WHERE is_active = TRUE 
ORDER BY name ASC;

-- Get specific usage
SELECT * FROM espiron_product_usage WHERE id = 'USAGE-LIGHTING';

-- Create new usage
INSERT INTO espiron_product_usage (id, name, description, reference_id, created_by)
VALUES ('USAGE-OUTDOOR', 'Outdoor Lighting', 'Outdoor lighting products', 'AE-NCR-749180', 'user-123');

-- Update usage
UPDATE espiron_product_usage 
SET name = 'Indoor Lighting', description = 'Indoor lighting solutions', updated_at = NOW()
WHERE id = 'USAGE-LIGHTING';

-- Deactivate usage
UPDATE espiron_product_usage SET is_active = FALSE WHERE id = 'USAGE-LIGHTING';

-- Get usage with family count
SELECT 
  pu.id, 
  pu.name, 
  COUNT(pf.id) as family_count
FROM espiron_product_usage pu
LEFT JOIN espiron_product_family pf ON pf.product_usage_id = pu.id
WHERE pu.is_active = TRUE
GROUP BY pu.id, pu.name
ORDER BY pu.name;
```

---

### 4. espiron_product_family

**Purpose:** Product family definitions (sub-classifications within a product usage)  
**Storage:** Supabase PostgreSQL  
**Primary Key:** id (text, manually assigned)  
**Foreign Key:** product_usage_id (references espiron_product_usage)  
**Dependent On:** espiron_product_usage

**SQL Definition:**
```sql
CREATE TABLE IF NOT EXISTS espiron_product_family (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  product_usage_id TEXT NOT NULL REFERENCES espiron_product_usage(id) ON DELETE CASCADE,
  description TEXT,
  reference_id TEXT,
  created_by TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_espiron_product_family_name ON espiron_product_family(name);
CREATE INDEX idx_espiron_product_family_product_usage_id ON espiron_product_family(product_usage_id);
CREATE INDEX idx_espiron_product_family_is_active ON espiron_product_family(is_active);
CREATE UNIQUE INDEX idx_espiron_product_family_unique_per_usage ON espiron_product_family(name, product_usage_id);
```

**Data Structure:**

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| id | text | NO | Primary key (e.g., "FAM-LED-PANEL", "FAMILY-001") |
| name | text | NO | Family name (e.g., "LED Panels", "LED Drivers", "Power Cables") |
| product_usage_id | text | NO | Foreign key to espiron_product_usage |
| description | text | YES | Detailed description |
| reference_id | text | YES | User's reference ID who created it |
| created_by | text | YES | User ID who created it |
| is_active | boolean | NO | Active/inactive status |
| created_at | timestamp | NO | Creation date |
| updated_at | timestamp | NO | Last updated date |

**Example Data:**
```json
{
  "id": "FAM-LED-PANEL",
  "name": "LED Panels",
  "product_usage_id": "USAGE-LIGHTING",
  "description": "600x600 and 1200x600 LED panel series",
  "reference_id": "AE-NCR-749180",
  "created_by": "user-123",
  "is_active": true,
  "created_at": "2026-01-15T10:35:00Z",
  "updated_at": "2026-01-15T10:35:00Z"
}
```

**Common Operations:**

```sql
-- List all active families for a usage
SELECT id, name, description FROM espiron_product_family 
WHERE product_usage_id = 'USAGE-LIGHTING' AND is_active = TRUE 
ORDER BY name ASC;

-- Get specific family
SELECT * FROM espiron_product_family WHERE id = 'FAM-LED-PANEL';

-- Create new family (must reference existing usage)
INSERT INTO espiron_product_family (id, name, product_usage_id, description, reference_id, created_by)
VALUES ('FAM-LED-DRIVER', 'LED Drivers', 'USAGE-LIGHTING', 'LED driver series', 'AE-NCR-749180', 'user-123');

-- Update family
UPDATE espiron_product_family 
SET name = 'LED Panel Systems', description = 'Advanced LED panels', updated_at = NOW()
WHERE id = 'FAM-LED-PANEL';

-- Deactivate family (cascades to products using it)
UPDATE espiron_product_family SET is_active = FALSE WHERE id = 'FAM-LED-PANEL';

-- Get family with usage info
SELECT 
  pf.id, 
  pf.name as family_name,
  pu.name as usage_name,
  pf.description
FROM espiron_product_family pf
JOIN espiron_product_usage pu ON pf.product_usage_id = pu.id
WHERE pf.is_active = TRUE
ORDER BY pu.name, pf.name;

-- Get all families (with usage hierarchy)
SELECT 
  pu.id as usage_id,
  pu.name as usage_name,
  pf.id as family_id,
  pf.name as family_name,
  COUNT(DISTINCT p.id) as product_count
FROM espiron_product_usage pu
LEFT JOIN espiron_product_family pf ON pf.product_usage_id = pu.id AND pf.is_active = TRUE
LEFT JOIN espiron_add_product p ON p.productFamilies @> jsonb_build_array(jsonb_build_object('productFamilyId', pf.id))
WHERE pu.is_active = TRUE
GROUP BY pu.id, pu.name, pf.id, pf.name
ORDER BY pu.name, pf.name;
```

---

## Hierarchy & Relationships

```
espiron_product_usage (Independent)
├── Lighting
├── Power Supply
└── Distribution
    └── espiron_product_family (Dependent on usage)
         ├── LED Panels (belongs to Lighting)
         ├── LED Drivers (belongs to Lighting)
         └── Power Cables (belongs to Power Supply)
              └── espiron_add_product (includes family reference)
                   ├── Product 1 (uses LED Panel family)
                   └── Product 2 (uses LED Driver family)
```

---

## Firebase Collections - Use these names in your PHP Firebase config:

- `espiron_add_product` - Product records
- `espiron_product_usage` - Product usage/category definitions (e.g., Lighting, Power Supply)
- `espiron_product_family` - Product family definitions (e.g., LED Panels, LED Drivers)
- `espiron_technicalSpecifications` - Technical spec templates per family
- `espiron_edit_product` (audit via espiron_auditLogs_products)
- `espiron_add_supplier` - Supplier records
- `espiron_edit_supplier` (audit via espiron_auditLogs_suppliers)
- `espiron_filters` - Saved filters
- `espiron_auditLogs_products`
- `espiron_auditLogs_suppliers`
- `espiron_auditLogs_productFamilies`
- `espiron_auditLogs_productUsages`
- `espiron_auditLogs_spfVersions`
- `espiron_notes` - Notes/comments

---

## PHP PDO Connection Example

```php
<?php
// Connect to Supabase PostgreSQL (tables prefixed espiron_)
$host = $_ENV['SUPABASE_HOST'];
$port = $_ENV['SUPABASE_PORT'];
$dbname = $_ENV['SUPABASE_DB_NAME'];
$user = $_ENV['SUPABASE_DB_USER'];
$password = $_ENV['SUPABASE_DB_PASSWORD'];

$pdo = new PDO(
    "pgsql:host=$host;port=$port;dbname=$dbname",
    $user,
    $password,
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
);

// Example: Get SPF request by number
$stmt = $pdo->prepare("SELECT * FROM espiron_spf_request WHERE spf_number = ?");
$stmt->execute(['SPF-DSI-26-0239']);
$spf = $stmt->fetch(PDO::FETCH_ASSOC);

// Example: List SPF creations with pagination
$limit = 10;
$offset = 0;
$stmt = $pdo->prepare("SELECT * FROM espiron_spf_creation ORDER BY date_updated DESC LIMIT ? OFFSET ?");
$stmt->execute([$limit, $offset]);
$creations = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Example: Update SPF request status
$stmt = $pdo->prepare("UPDATE espiron_spf_request SET status = ?, date_updated = NOW() WHERE spf_number = ?");
$stmt->execute(['For Revision by TL', 'SPF-DSI-26-0239']);

// Example: Insert into espiron_spf_creation_history (versioning)
$stmt = $pdo->prepare(
    "INSERT INTO espiron_spf_creation_history 
    (spf_number, version_number, version_label, created_at, status) 
    VALUES (?, ?, ?, NOW()::text, ?)"
);
$stmt->execute(['SPF-DSI-26-0239', 1, 'SPF-DSI-26-0239_v1', 'Pending For Procurement']);

// Example: Get FCM tokens for push notification
$stmt = $pdo->prepare("SELECT token FROM espiron_fcm_tokens WHERE user_id = ?");
$stmt->execute(['user-123']);
$tokens = $stmt->fetchAll(PDO::FETCH_COLUMN);

// Example: Get email accounts for user
$stmt = $pdo->prepare("SELECT * FROM espiron_email_accounts WHERE user_id = ? AND is_active = TRUE");
$stmt->execute(['user-123']);
$accounts = $stmt->fetchAll(PDO::FETCH_ASSOC);
?>
```

---

## PHP Firebase Firestore Connection Example

```php
<?php
// Connect to Firebase Firestore
use Google\Cloud\Firestore\FirestoreClient;

$firestore = new FirestoreClient([
    'projectId' => $_ENV['FIREBASE_PROJECT_ID'],
    'keyFilePath' => $_ENV['FIREBASE_KEY_FILE'],
]);

// Collections with espiron_ prefix
$productsCollection = $firestore->collection('espiron_add_product');
$productUsageCollection = $firestore->collection('espiron_product_usage');
$productFamilyCollection = $firestore->collection('espiron_product_family');
$technicalSpecsCollection = $firestore->collection('espiron_technicalSpecifications');
$suppliersCollection = $firestore->collection('espiron_add_supplier');
$auditLogsProducts = $firestore->collection('espiron_auditLogs_products');
$auditLogsSuppliers = $firestore->collection('espiron_auditLogs_suppliers');
$notesCollection = $firestore->collection('espiron_notes');

// Example: Get all product usages
$usageQuery = $productUsageCollection->where('isActive', '=', true)->orderBy('name');
$usageDocs = $usageQuery->documents();
$usages = [];
foreach ($usageDocs as $doc) {
    if ($doc->exists()) {
        $usages[] = array_merge(['id' => $doc->id()], $doc->data());
    }
}

// Example: Get product families by usage
$familyQuery = $productFamilyCollection
    ->where('productUsageId', '=', 'CAT-001')
    ->where('isActive', '=', true)
    ->orderBy('name');
$familyDocs = $familyQuery->documents();
$families = [];
foreach ($familyDocs as $doc) {
    if ($doc->exists()) {
        $families[] = array_merge(['id' => $doc->id()], $doc->data());
    }
}

// Example: Get technical specs template for family
$specsQuery = $technicalSpecsCollection
    ->where('categoryTypeId', '=', 'CAT-001')
    ->where('productFamilyId', '=', 'FAM-001')
    ->where('isActive', '=', true)
    ->orderBy('sortOrder');
$specsDocs = $specsQuery->documents();
$specs = [];
foreach ($specsDocs as $doc) {
    if ($doc->exists()) {
        $specs[] = array_merge(['id' => $doc->id()], $doc->data());
    }
}

// Example: Create new product with family and usage
$productsCollection->document('product-id-456')->set([
    'productName' => 'LED Panel 600x600',
    'productClass' => 'Classification A',
    'pricePoint' => 'STANDARD',
    'brandOrigin' => 'CHINA',
    'categoryTypes' => [
        [
            'productUsageId' => 'CAT-001',
            'categoryTypeName' => 'Lighting'
        ]
    ],
    'productFamilies' => [
        [
            'productFamilyId' => 'FAM-001',
            'productFamilyName' => 'LED Panels',
            'productUsageId' => 'CAT-001'
        ]
    ],
    'technicalSpecifications' => [],
    'supplier' => [
        'supplierId' => 'SUP-123456',
        'company' => 'Supplier A Co Ltd',
        'supplierBrand' => 'Brand X'
    ],
    'createdAt' => new \DateTime(),
    'isActive' => true
]);

// Example: List all products with pagination
$query = $productsCollection->limit(10);
$documents = $query->documents();
$products = [];
foreach ($documents as $doc) {
    if ($doc->exists()) {
        $products[] = array_merge(['id' => $doc->id()], $doc->data());
    }
}

// Example: Create audit log entry
$auditLogsProducts->add([
    'whatHappened' => 'Product Added',
    'productId' => 'product-id-123',
    'productName' => 'LED Panel',
    'reference_id' => 'AE-NCR-749180',
    'userId' => 'user-123',
    'createdAt' => new \DateTime(),
    'date_updated' => new \DateTime()
]);

// Example: Get notes for product
$notesQuery = $notesCollection
    ->where('linkedEntity', '=', 'product-id-123')
    ->orderBy('createdAt', 'DESC');
$notes = $notesQuery->documents();

// Example: Add note
$notesCollection->add([
    'noteContent' => 'Pending technical spec confirmation',
    'noteType' => 'product',
    'linkedEntity' => 'product-id-123',
    'linkedEntityName' => 'LED Panel 600x600',
    'author' => 'AE-NCR-749180',
    'isResolved' => false,
    'createdAt' => new \DateTime()
]);
?>
```

---

## Table Naming Convention Reference

All table names follow this pattern:
- **Supabase PostgreSQL:** `espiron_{table_name}` (e.g., espiron_users, espiron_spf_request)
- **Firebase Firestore:** `espiron_{collection_name}` (e.g., espiron_add_product, espiron_auditLogs_products)

This naming convention ensures:
1. Easy identification of Espiron system tables
2. Namespace isolation if multiple apps share the database
3. Consistent naming across SQL and NoSQL stores
4. Clear separation from system tables or other projects

---

## Key Notes for PHP Migration

1. **All Supabase tables are prefixed with `espiron_`** - Update all SQL queries accordingly
2. **All Firebase collections are prefixed with `espiron_`** - Update all collection references
3. **Foreign keys reference the full espiron_ table names** (e.g., REFERENCES espiron_spf_request)
4. **Indexes are named with `idx_espiron_` prefix** for easy identification
5. **Both databases use ISO 8601 timestamps** for consistency
6. **Delimited fields (|ROW|, @@, ~~) are used in SPF tables** - Parse carefully in PHP
7. **Firebase stores JSON natively** - PDO in PostgreSQL uses JSONB
8. **Implement proper error handling** for both PDO and Firestore operations
9. **Use prepared statements** for all SQL to prevent injection
10. **Keep transaction logs** for audit trails

Done! 🎉 All tables now have the `espiron_` prefix throughout the documentation.

