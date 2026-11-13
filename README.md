# Espiron Product Database

> **Version:** 2.0.0-Espiron  
> **Last Updated:** April 18, 2026  
> **Purpose:** Comprehensive enterprise-grade product and supplier management system with SPF request workflows

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Quick Start](#2-quick-start)
3. [System Requirements](#3-system-requirements)
4. [Installation](#4-installation)
5. [Environment Configuration](#5-environment-configuration)
6. [Development Workflow](#6-development-workflow)
7. [Project Structure](#7-project-structure)
8. [Key Features](#8-key-features)
9. [Documentation](#9-documentation)
10. [Contributing](#10-contributing)
11. [License](#11-license)

---

## 1. Project Overview

**Espiron Product Database** is an internal operations portal designed for the Engineering and IT departments to manage product catalogs, supplier relationships, and Special Price Form (SPF) request workflows.

### Core Capabilities

- **Product Management:** Complete CRUD operations for product catalogs with technical specifications
- **Supplier Management:** Vendor relationship tracking with contact and address management
- **SPF Request System:** Special pricing workflow with approval chains
- **Role-Based Access Control:** Multi-layered security with department and role filtering
- **Audit Logging:** Complete change tracking for compliance
- **Real-time Collaboration:** Live updates and collaboration hub for SPF requests

### Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend Framework | Next.js 14+ (App Router) |
| UI Library | React 18+ with TypeScript |
| Styling | Tailwind CSS |
| UI Components | shadcn/ui |
| Database | Firebase Firestore + Supabase (PostgreSQL) |
| File Storage | Cloudinary |
| Authentication | Session-based with cookies |

---

## 2. Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn package manager
- Git

### Start Development Server

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Or use alternative package managers
yarn dev
pnpm dev
bun dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 3. System Requirements

### Browser Compatibility

- **Google Chrome:** 90+
- **Mozilla Firefox:** 90+
- **Microsoft Edge:** 90+
- **Apple Safari:** 15+

### Display Requirements

- **Desktop:** Minimum 1300px width for full interface
- **Mobile:** Responsive layouts with touch-optimized interactions

### Network Requirements

- Reliable internet connectivity for real-time features
- WebSocket support for collaboration features

---

## 4. Installation

### Clone Repository

```bash
git clone https://github.com/your-org/disruptive-product-database.git
cd disruptive-product-database
```

### Install Dependencies

```bash
npm install
```

### Build for Production

```bash
npm run build
```

---

## 5. Environment Configuration

Create a `.env.local` file with the following variables:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# MongoDB (for user authentication)
MONGODB_URI=your_mongodb_uri

# Session Security
SESSION_SECRET=your_session_secret
```

---

## 6. Development Workflow

### Code Organization

```
app/                          # Next.js App Router pages
├── page.tsx                  # Root redirect to /login
├── login/                    # Login page with splash screen
├── dashboard/                # Dashboard with metrics
├── products/                 # Product catalog
├── suppliers/                # Supplier management
├── requests/                 # SPF request handling
├── for-approval/             # Approval workflow
└── ...

components/                   # React components
├── ui/                       # shadcn/ui components
├── spf-request-create.tsx    # SPF creation dialog
├── spf-request-fetch.tsx     # SPF view/edit dialog
└── ...

contexts/                     # React Contexts
├── UserContext.tsx           # User session management
├── RoleAccessContext.tsx     # Permission checking
└── ...

lib/                          # Utility libraries
├── firebase.ts               # Firebase configuration
├── auth.ts                   # Password hashing
└── ...
```

### Key Development Commands

```bash
# Development
npm run dev              # Start development server
npm run build            # Build for production
npm run start            # Start production server

# Code Quality
npm run lint             # Run ESLint
npm run type-check       # Run TypeScript checks
```

---

## 7. Project Structure

### Database Collections (Firestore)

- `products` - Product catalog with technical specifications
- `suppliers` - Supplier company information
- `brands` - Brand master data
- `categoryTypes` - Product usage categories
- `productFamilies` - Product family classifications
- `technicalSpecifications` - Technical spec templates
- `forApprovals` - Pending approval requests
- `roleAccess` - User permission storage
- `auditLogs_*` - Various audit log collections

### Supabase Tables

- `spf_request` - SPF request headers
- `spf_creation` - SPF creation records
- `spf_item` - SPF line items

---

## 8. Key Features

### Product Management
- Grid view with card scaling (60%-160%)
- Real-time search and filtering
- Image uploads (Cloudinary)
- Technical specifications builder
- Bulk import/export (Excel)
- Approval workflow integration

### Supplier Management
- Table view with advanced filtering
- Contact and address management
- Supplier-product relationship mapping
- Bulk upload via CSV/Excel

### SPF Request System
- Real-time sync from Supabase
- Collaboration hub (chat/notes)
- Version history tracking
- TDS (Technical Data Sheet) generation
- Email notifications

### Security & Access Control
- Session-based authentication
- Role-based access control (RBAC)
- Department-based filtering
- Audit logging for all changes
- API key management for external access

---

## 9. Documentation

Comprehensive documentation is available in the following files:

| Document | Purpose |
|----------|---------|
| [DEV_CHANGELOG.md](./DEV_CHANGELOG.md) | System changelog and development timeline |
| [DEV_DOCUMENTATION.md](./DEV_DOCUMENTATION.md) | Technical implementation details |
| [USER_DOCUMENTATION.md](./USER_DOCUMENTATION.md) | End-user guide and tutorials |
| [ROLE_CAPABILITIES.md](./ROLE_CAPABILITIES.md) | Role-based permissions reference |

---

## 10. Contributing

### Branch Strategy

- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/*` - Individual feature branches

### Pull Request Process

1. Create feature branch from `develop`
2. Implement changes with appropriate tests
3. Update documentation as needed
4. Submit PR to `develop` branch
5. Code review required before merge

### Code Standards

- TypeScript for all new code
- ESLint configuration enforced
- Component-based architecture
- Responsive design patterns

---

## 11. License

This is proprietary software for internal use only.

---

## Support

For technical support or questions:
- Contact the IT/Engineering team
- Review the comprehensive documentation files
- Check the troubleshooting guide in [DEV_CHANGELOG.md](./DEV_CHANGELOG.md)

---

*Last Updated: April 18, 2026*  
*Maintained by IT/Engineering Team*
