# Espiron Product Database - System Documentation & Changelog

> **Version:** 2.0.0-Espiron  
> **Last Updated:** April 18, 2026  
> **Purpose:** Comprehensive documentation for Espiron Product Database system architecture, features, RBAC, and development history

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture & Tech Stack](#2-architecture--tech-stack)
3. [Core Modules & Features](#3-core-modules--features)
4. [Role-Based Access Control (RBAC)](#4-role-based-access-control-rbac)
5. [Data Flow & APIs](#5-data-flow--apis)
6. [Security & Authentication](#6-security--authentication)
7. [Audit Logging](#7-audit-logging)
8. [Development Timeline](#8-development-timeline)
9. [Troubleshooting Guide](#9-troubleshooting-guide)

---

## 1. System Overview

### 1.1 Application Identity
- **Name:** Espiron Product Database
- **Type:** Internal Operations Portal
- **Primary Users:** Engineering Department, IT Department, Procurement
- **Purpose:** Centralized product and supplier management with SPF (Special Price Form) request workflow

### 1.2 Core Philosophy
The Espiron system implements **multi-layered security** with three primary access control mechanisms:

1. **Department-Based Access** - Determines which modules are visible (Engineering/IT only for admin functions)
2. **Role-Based Filtering** - Controls data visibility within accessible modules
3. **Approval Workflow** - Non-manager Engineering staff require approval for data modifications

---

## 2. Architecture & Tech Stack

### 2.1 Technology Stack
| Layer | Technology |
|-------|------------|
| Frontend Framework | Next.js 14+ (App Router) |
| UI Library | React 18+ with TypeScript |
| Styling | Tailwind CSS |
| UI Components | shadcn/ui |
| State Management | React Context API |
| Backend | Next.js API Routes |
| Database Primary | Firebase Firestore |
| Database Secondary | Supabase (PostgreSQL) |
| File Storage | Cloudinary |
| Authentication | Session-based with cookies |

### 2.2 Project Structure
```
app/                          # Next.js App Router pages
├── page.tsx                  # Root redirect to /login
├── layout.tsx                # Root layout with providers
├── login/                    # Login page with splash screen
├── dashboard/                # Dashboard with metrics
├── products/                 # Product catalog (grid view)
├── suppliers/                # Supplier management
├── requests/                 # SPF request handling
├── for-approval/             # Approval workflow
├── roles/                    # User access management
├── api-management/           # API key management (IT only)
├── add-product/              # Add product form
├── edit-product/             # Edit product form
├── api/                      # API routes
│   ├── gdrive-image/         # Google Drive image proxy
│   └── send-push/            # Push notification service

components/                   # React components
├── ui/                       # shadcn/ui components
├── spf/                      # SPF-related components
│   └── dialog/
├── sidebar-left.tsx          # Main navigation
├── spf-request-create.tsx    # SPF creation dialog
├── spf-request-fetch.tsx     # SPF view/edit dialog
├── add-product-component.tsx # Reusable product form
├── edit-product-component.tsx# Edit product logic
├── filtering-component-v2.tsx# Product filters
├── collaboration-hub.tsx     # Chat/notes for SPF
└── ...

contexts/                     # React Contexts
├── UserContext.tsx           # User session management
├── RoleAccessContext.tsx     # Permission checking
├── NotificationContext.tsx   # SPF notifications
├── ThemeContext.tsx          # Theme switching
└── WallpaperContext.tsx      # Custom wallpapers

lib/                          # Utility libraries
├── firebase.ts               # Firebase configuration
├── auth.ts                   # Password hashing
├── auditlogger.ts            # Audit logging
├── for-approval.ts           # Approval workflow logic
├── product-bulk-insert-runner.ts
├── supplier-bulk-insert-runner.ts
└── generateTDSPdf.ts         # PDF generation

pages/api/                    # API endpoints
├── login.ts                  # Authentication
├── logout.ts                 # Session cleanup
├── me.ts                     # Current user
├── users.ts                  # User management
├── api-keys.ts               # API key management
├── profile-update.ts         # Profile updates
├── public-api.ts             # Public API access
├── upload-product.ts         # Cloudinary upload
└── request/                  # SPF API routes
    ├── spf-request-create-api.ts
    ├── spf-request-edit-api.ts
    ├── spf-request-fetch-api.ts
    └── sync-product-to-spf-api.ts

utils/                        # Utilities
├── supabase.js               # Supabase client
├── supabase-admin.ts         # Admin Supabase client
└── supabase-ticket.ts        # Ticket system
```

### 2.3 Database Collections (Firestore)
- `products` - Product catalog with technical specifications
- `suppliers` - Supplier company information
- `brands` - Brand master data
- `categoryTypes` - Product usage categories
- `productFamilies` - Product family classifications
- `technicalSpecifications` - Technical spec templates
- `forApprovals` - Pending approval requests
- `roleAccess` - User permission storage
- `auditLogs_*` - Various audit log collections

### 2.4 Supabase Tables
- `spf_request` - SPF request headers
- `spf_creation` - SPF creation records
- `spf_item` - SPF line items

---

## 3. Core Modules & Features

### 3.1 Dashboard (`/dashboard`)
**Last Updated:** April 17, 2026

- Real-time metric cards showing:
  - Total Products (from Firestore)
  - Total Suppliers (from Firestore)
  - SPF Requests (from Supabase)
- Click-to-navigate metric cards
- Customizable wallpaper with opacity control
- Theme toggle (Formal/Comic)

**Key Components:**
- `Dashboard` - Main page component
- `WallpaperModal` - Wallpaper customization

### 3.2 Products Module (`/products`)
**Last Updated:** April 17, 2026

- Grid view with card scaling (60%-160%)
- Real-time search across:
  - Product name
  - Supplier brand
  - Category type
  - Product type
- Advanced filtering sidebar:
  - Price point
  - Brand origin
  - Product class
  - Supplier
  - Product usage
  - Product family
- Pagination (responsive items per page)
- Quick actions (View, Edit, Delete)
- Mobile-responsive with slide-out filters

**Key Components:**
- `ProductsPage` - Main product grid
- `FilteringComponentV2` - Filter panel
- `ViewProduct` - Product detail modal
- `AddProductDeleteProductItem` - Delete confirmation

### 3.3 Add/Edit Product (`/add-product`, `/edit-product`)
**Last Updated:** April 17, 2026

Comprehensive product form with:
- Image uploads (main, dimensional, illuminance)
- Google Drive link support with thumbnail conversion
- Supplier selection with brand
- Price point & brand origin selection
- Product classification dropdown
- Product family selection
- Technical specifications builder:
  - Drag-and-drop spec groups
  - Multiple spec types (text, ranging, slashing, dimension, IP rating)
  - Sync to product family template
- Packaging dimensions (single or multiple)
- Factory address & port of discharge
- Unit cost input

**Key Features:**
- Approval workflow integration (non-managers)
- Audit logging on save
- Cloudinary media upload
- Real-time family template sync

### 3.4 Suppliers Module (`/suppliers`)
**Last Updated:** April 17, 2026

- Table view with 10 data columns
- Search across all fields
- Advanced filtering:
  - Company name
  - Email
  - Has contacts (yes/no)
  - Phone country code
  - Address country
  - Alphabetical sort
- Pagination (10 desktop / 5 mobile)
- Quick actions (Edit, Delete)
- View supplier products button
- Upload suppliers via CSV/Excel

**Key Components:**
- `Suppliers` - Main supplier table
- `AddSupplier` - Add dialog
- `EditSupplier` - Edit dialog
- `FilterSupplier` - Filter panel
- `SupplierProducts` - Supplier's products view

### 3.5 SPF Requests (`/requests`)
**Last Updated:** April 17, 2026

SPF (Special Price Form) request management:
- Real-time sync from Supabase
- Shows requests with status "Approved By TSM" or "Approved By Sales Head"
- Integration with SPF creation workflow
- Status mapping:
  - "Pending For Procurement" → "For Procurement Costing"
  - "Approved By Procurement" → "Ready For Quotation"
- Notification badges for unread items
- Collaboration hub (chat/notes) per SPF

**Key Components:**
- `RequestsPage` - SPF list
- `SPFRequestFetch` - View SPF dialog
- `SPFRequestCreate` - Create SPF dialog
- `CollaborationHubRowTrigger` - Chat trigger
- `SPFRequestFetchVersionHistory` - Version tracking

### 3.6 For Approval (`/for-approval`)
**Last Updated:** April 17, 2026

Approval workflow for data modifications:
- **Restricted to:** Engineering Managers and IT only
- Approval types supported:
  - `product_add` - New product creation
  - `product_edit` - Product modification
  - `product_delete` - Product removal
  - `supplier_add` - New supplier creation
  - `supplier_edit` - Supplier modification
  - `supplier_delete` - Supplier removal
  - `product_upload` - Bulk product upload
  - `supplier_upload` - Bulk supplier upload
- Diff comparison views for all changes
- Approve/Reject with remarks
- Real-time notification sounds

### 3.7 Roles Management (`/roles`)
**Last Updated:** April 17, 2026

User access control management:
- **Restricted to:** Engineering Managers and IT only
- Manages Engineering department staff (non-managers)
- Toggle access permissions per user:
  - `page:requests` - Access SPF requests
  - `page:products` - Access products catalog
  - `page:suppliers` - Access suppliers
  - `page:roles` - Access roles (self-managed)
  - `page:add-product` - Can add products
  - `page:edit-product` - Can edit products
  - `feature:approval-bypass` - Skip approval workflow
- Stores permissions in Firestore `roleAccess` collection

### 3.8 API Management (`/api-management`)
**Last Updated:** April 17, 2026

API key management for external integrations:
- **Restricted to:** IT Department only
- Generate API keys with permissions:
  - `products:read` - Read product data
  - `suppliers:read` - Read supplier data
- Revoke keys
- Copy to clipboard
- View usage statistics

---

## 4. Role-Based Access Control (RBAC)

### 4.1 User Hierarchy

```
┌─────────────────────────────────────────────────────────┐
│  FULL ACCESS (All Permissions)                           │
├─────────────────────────────────────────────────────────┤
│  • Engineering Department + Manager Role                │
│  • IT Department (any role)                           │
│                                                         │
│  Access: All pages, no approval required,              │
│          can review approvals, manage roles             │
└─────────────────────────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
┌─────────────────┐ ┌─────────────┐ ┌─────────────┐
│ Engineering     │ │ Engineering │ │ Other       │
│ Non-Manager     │ │ + Approval  │ │ Departments │
│ (Standard)      │ │ Bypass      │ │ (Limited)   │
├─────────────────┤ ├─────────────┤ ├─────────────┤
│ Requires        │ │ No approval │ │ Public API  │
│ approval for    │ │ needed      │ │ only        │
│ changes         │ │ Can modify  │ │             │
│                 │ │ directly    │ │             │
└─────────────────┘ └─────────────┘ └─────────────┘
```

### 4.2 Access Matrix

| Page/Feature | Engineering Manager | IT Staff | Engineering Staff | Other Depts |
|-------------|---------------------|----------|-------------------|-------------|
| Dashboard | ✅ | ✅ | ✅ | ✅ |
| Products | ✅ | ✅ | ✅* | Public API |
| Suppliers | ✅ | ✅ | ✅* | Public API |
| SPF Requests | ✅ | ✅ | ✅* | ❌ |
| For Approval | ✅ | ✅ | ❌ | ❌ |
| Roles | ✅ | ✅ | ❌ | ❌ |
| API Management | ❌ | ✅ | ❌ | ❌ |
| Add Product | ✅ | ✅ | ✅** | ❌ |
| Edit Product | ✅ | ✅ | ✅** | ❌ |
| Delete Product | ✅ | ✅ | ✅** | ❌ |
| Upload Products | ✅ | ✅ | ✅** | ❌ |
| Upload Suppliers | ✅ | ✅ | ✅** | ❌ |

*Requires `page:*` permission in roleAccess  
**Requires approval unless `feature:approval-bypass` enabled

### 4.3 Access Keys (RoleAccessContext)

```typescript
export type AccessKey = 
  | "page:requests"
  | "page:products" 
  | "page:suppliers"
  | "page:roles"
  | "page:add-product"
  | "page:edit-product"
  | "feature:approval-bypass"
  | "component:spf-request-create"
  | "component:spf-request-fetch"
  | "component:upload-product"
  | "component:upload-supplier"
  | "component:add-product-btn"
  | "component:edit-product";
```

### 4.4 Access Guard Component
All protected pages use `AccessGuard` component:

```tsx
<AccessGuard accessKey="page:products">
  <ProductsPage />
</AccessGuard>
```

Redirects to dashboard if access denied.

---

## 5. Data Flow & APIs

### 5.1 Authentication Flow
1. User submits credentials to `/api/login`
2. Server validates against MongoDB user collection
3. Session cookie created with `userId`
4. Middleware checks session on all routes
5. `UserContext` fetches current user from `/api/me`

### 5.2 Product Data Flow
```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│   Client    │───▶│  Firestore   │◀───│  Cloudinary │
│             │◀───│  (products)  │    │   (images)  │
└─────────────┘    └──────────────┘    └─────────────┘
       │
       ▼
┌─────────────┐
│ Audit Logs  │
│ (Firestore) │
└─────────────┘
```

### 5.3 SPF Data Flow
```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│   Client    │───▶│   Supabase   │◀───│   Old SPF   │
│             │◀───│  (PostgreSQL)│    │   System    │
└─────────────┘    └──────────────┘    └─────────────┘
                          │
                          ▼
                   ┌─────────────┐
                   │ Collaboration│
                   │   Hub (chat) │
                   └─────────────┘
```

### 5.4 API Endpoints

| Endpoint | Method | Description | Access |
|----------|--------|-------------|--------|
| `/api/login` | POST | Authenticate user | Public |
| `/api/logout` | POST | Clear session | Authenticated |
| `/api/me` | GET | Current user info | Authenticated |
| `/api/users` | GET/PUT | User management | Authenticated |
| `/api/api-keys` | GET/POST | API key management | IT only |
| `/api/upload-product` | POST | Upload to Cloudinary | Authenticated |
| `/api/public/products` | GET | Public product API | API Key |
| `/api/public/suppliers` | GET | Public supplier API | API Key |
| `/api/request/spf-request-create-api` | POST | Create SPF | Authenticated |
| `/api/request/spf-request-edit-api` | POST | Edit SPF | Authenticated |
| `/api/request/spf-request-fetch-api` | GET | Fetch SPF list | Authenticated |

---

## 6. Security & Authentication

### 6.1 Session Management
- Session stored in HTTP-only cookie
- Cookie name: `session`
- Middleware validates session on every request
- Auto-redirect to login if expired

### 6.2 Password Security
```typescript
// lib/auth.ts
import bcrypt from "bcrypt";

const saltRounds = 10;
const hashedPassword = await bcrypt.hash(password, saltRounds);
```

### 6.3 Middleware Protection
```typescript
// middleware.ts
export function middleware(req: NextRequest) {
  const session = req.cookies.get("session")?.value;
  
  if (!session && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  
  if (session && isLoginPage) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
}
```

### 6.4 API Key Authentication
Public API uses header-based authentication:
```
Authorization: Bearer <api-key>
X-API-Key: <api-key>
```

---

## 7. Audit Logging

### 7.1 Audit Collections
All data modifications are logged to:

| Collection | Purpose |
|------------|---------|
| `auditLogs_products` | Product CRUD operations |
| `auditLogs_suppliers` | Supplier CRUD operations |
| `auditLogs_productFamilies` | Family modifications |
| `auditLogs_productUsages` | Category type changes |

### 7.2 Logged Events

**Products:**
- Product Added
- Product Edited
- Product Deleted
- Product Bulk Upload
- Product For Approval Requested
- Product For Approval Approved
- Product For Approval Rejected

**Suppliers:**
- Supplier Added
- Supplier Edited
- Supplier Deleted
- Supplier Reactivated
- Supplier Bulk Upload
- Supplier For Approval Requested
- Supplier For Approval Approved
- Supplier For Approval Rejected

### 7.3 Audit Entry Structure
```typescript
{
  whatHappened: "Product Added",
  productId: "abc123",
  productReferenceID: "PROD-SPF-00001",
  productClass: "LED Bulb",
  pricePoint: "PREMIUM",
  brandOrigin: "JAPAN",
  supplier: { supplierId, company, supplierBrand },
  categoryTypes: [...],
  productFamilies: [...],
  technicalSpecifications: [...],
  referenceID: "EMP001",
  userId: "firebase_uid",
  date_updated: Timestamp,
  createdAt: Timestamp
}
```

---

## 8. Development Timeline

### October 9, 2026 - SPF Quotation Tracking Enhancements
- **Updated:** SPF Quotation Tracking page
- **Added:** Clickable Product SKU entries for navigation
  - SKUs displayed in blue with underline on hover
  - Clicking a SKU (e.g., `SPF-DSI-26-0438-002`) redirects to Requests page
  - Automatically searches for base SKU (first 4 hyphen-separated parts: `SPF-DSI-26-0438`)
  - Excludes the 4th hyphen and subsequent parts from search query
  - Uses sessionStorage to pass search query (URL remains clean: `/requests`)
  - Search query is automatically typed into the search bar on page load
- **Updated:** Requests page
  - Added sessionStorage check on page load to auto-fill search bar
  - Clears sessionStorage after applying search query
- **Updated:** API exclusion list for SPF DSI quotations
  - Added `JC-NCR-245823` to excluded ReferenceIDs
  - Excluded ReferenceIDs: `AE-NCR-555756`, `JC-NCR-245823`
- **Updated:** Sidebar navigation
  - Renamed menu item from "SPF Quotations" to "SPF Quotation Tracking"
  - Moved position below Analytics in navigation order
- **Updated:** SPF_QUOTATION_TRACKING.md documentation
  - Added clickable SKU navigation feature description
  - Updated exclusion list documentation

### April 18, 2026 - Documentation Synchronization
- **Updated:** All documentation files synchronized to latest date
- **Files Updated:** DEV_DOCUMENTATION.md, DEV_CHANGELOG.md, README.md, USER_DOCUMENTATION.md, ROLE_CAPABILITIES.md
- **Purpose:** Maintain consistent version tracking across all system documentation

### April 17, 2026 - System Documentation Update
- **Created:** Comprehensive system documentation
- **Documented:** All modules, RBAC, APIs, data flows
- **Purpose:** End-of-day report for system architecture

### April 2026 - API Management Module
- **Added:** API key generation for third-party access
- **Added:** IT-only access control
- **Added:** Public API endpoints for products/suppliers
- **Features:** Generate, revoke, copy API keys with permissions

### April 2026 - Roles & Permissions System
- **Added:** `RoleAccessContext` for permission management
- **Added:** `roles` page for Engineering Managers/IT
- **Features:**
  - Toggle access per user
  - Page-level permissions
  - Feature-level permissions (approval bypass)
  - Firestore persistence

### April 2026 - For Approval Workflow
- **Added:** `for-approval` page
- **Added:** `for-approval.ts` library
- **Features:**
  - 8 approval action types
  - Diff comparison tables
  - Approve/reject with remarks
  - Notification sounds
  - Audit trail integration

### April 2026 - SPF Request Integration
- **Added:** Supabase integration for SPF data
- **Added:** Real-time SPF sync
- **Added:** Collaboration hub (chat)
- **Added:** Version history tracking
- **Features:**
  - SPF list with status filtering
  - Create from approved requests
  - TDS generation
  - Email notifications

### April 2026 - Product Module Enhancements
- **Added:** Multiple packaging dimensions support
- **Added:** Product family template sync
- **Added:** Technical specification drag-and-drop
- **Added:** Google Drive image thumbnail conversion
- **Added:** Card scaling (60%-160%)
- **Added:** Responsive filtering

### April 2026 - Theme System
- **Added:** `ThemeContext` and `ThemeProvider`
- **Added:** Formal/Comic theme toggle
- **Features:**
  - Comic theme with animations
  - Formal theme for professional use
  - Wallpaper customization
  - Opacity control

### March-April 2026 - Mobile Responsiveness
- **Updated:** All pages mobile-optimized
- **Added:** Bottom navigation for mobile
- **Added:** Slide-out filters
- **Added:** Card-based mobile layouts
- **Added:** Touch-friendly interactions

### March 2026 - Initial Release
- **Core modules:** Dashboard, Products, Suppliers
- **Authentication:** Session-based login
- **Database:** Firestore integration
- **File storage:** Cloudinary setup

---

## 9. Troubleshooting Guide

### 9.1 Common Issues

**Issue:** "Access Denied" on roles/for-approval pages  
**Cause:** User is not Engineering Manager or IT  
**Solution:** Contact Engineering Manager for access upgrade

**Issue:** Approval required for all changes  
**Cause:** Standard Engineering staff without bypass permission  
**Solution:** Engineering Manager can enable `feature:approval-bypass`

**Issue:** SPF requests not loading  
**Cause:** Supabase connection issue  
**Solution:** Check Supabase credentials in environment variables

**Issue:** Images not displaying  
**Cause:** Cloudinary configuration or Google Drive link format  
**Solution:** Verify Cloudinary env vars; use direct share links for Drive

### 9.2 Environment Variables Required
```env
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# MongoDB (for user auth)
MONGODB_URI=

# Session
SESSION_SECRET=
```

---

## 10. Future Enhancements (Planned)

- [ ] Advanced analytics dashboard
- [ ] Supplier performance metrics
- [ ] Product comparison tool
- [ ] Bulk editing capabilities
- [ ] Integration with procurement system
- [ ] Mobile app (React Native)
- [ ] AI-powered product recommendations
- [ ] Advanced search with filters
- [ ] Data export (PDF, Excel)
- [ ] Multi-language support

---

*Document maintained by IT/Engineering Team*  
*For questions or updates, contact system administrator*
