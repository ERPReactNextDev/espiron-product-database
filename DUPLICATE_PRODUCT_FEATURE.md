# Duplicate Product Feature Implementation

## Overview
Implemented the **Duplicate Product** feature in the espiron-product-database, matching the functionality from the old database. When a product is duplicated, it creates an exact copy with an incremented numeric suffix (e.g., "(2)", "(3)", etc.) and logs the action via audit trail.

## Changes Made

### 1. **Audit Logger Update** (`lib/auditlogger.ts`)
- Added `"Product Duplicated"` to the `ProductEventPayload` type
- Allows audit logging of product duplication events with full product snapshot

### 2. **Products Page Implementation** (`app/products/page.tsx`)

#### Added Imports
- `addDoc`, `doc`, `getDoc`, `getDocs` from Firebase for document operations
- `logProductEvent` from audit logger
- `Copy` icon from lucide-react
- `AlertDialog` components from UI library

#### New State Variables
- `duplicateTarget`: Tracks the product being duplicated
- `duplicating`: Loading state during duplication process

#### New Helper Function: `escapeRegExp()`
- Escapes special regex characters for safe pattern matching
- Used to find existing duplicates with matching base names

#### New Handler: `handleDuplicate()`
- **Naming Logic**:
  - Extracts the base name (removes any existing "(N)" suffix)
  - Queries all active products to find existing numbers
  - Uses a Set for O(1) lookup of existing numbers
  - Finds the next available number starting from 2
  - Example: "100W LED" → "100W LED (2)" → "100W LED (3)"

- **Product Creation**:
  - Clones entire product document with `...productData`
  - Updates `createdAt` and `updatedAt` to current time
  - Uses Firebase `addDoc()` to create new document

- **Audit Logging**:
  - Fetches user's referenceID for accountability
  - Logs event type: `"Product Duplicated"`
  - Captures original and new product IDs/names
  - Stores full product snapshot in audit trail

#### UI Updates
- Added **Duplicate button** to desktop hover actions (green copy icon)
- Added **Duplicate button** to mobile actions
- Inserted between View and Edit buttons in action ordering
- Added **Confirmation Dialog** before duplication

#### Duplicate Confirmation Dialog
- Asks user: "Do you want to duplicate '{productName}'?"
- Shows loading state during duplication
- Disables cancel button during operation
- Auto-closes on success

## Feature Behavior

### Desktop
1. Hover over a product card
2. Click the copy icon (Duplicate)
3. Confirm in the dialog
4. Product is duplicated with incremented name

### Mobile
1. Tap the copy icon on the product card
2. Confirm in the dialog
3. Product is duplicated with incremented name

### Naming Example
```
Original: "100W LED AC STREET LIGHT"
First duplicate: "100W LED AC STREET LIGHT (2)"
Second duplicate: "100W LED AC STREET LIGHT (3)"
If (3) exists but (2) doesn't: "100W LED AC STREET LIGHT (2)"
```

### Audit Trail
Every duplication is logged with:
- What happened: "Product Duplicated"
- New product ID
- Original product ID
- Original product name
- New product name
- User reference ID
- Full product metadata snapshot
- Timestamp

## Database Collections
- **Main**: `products` collection (new document created)
- **Audit**: `auditLogs_products` collection (duplication event logged)

## Dependencies Used
All dependencies were already in `package.json`:
- `firebase` - Firebase Firestore operations
- `lucide-react` - Icons (Copy icon added)
- `@radix-ui/react-alert-dialog` - Confirmation dialog
- Existing UI components from `/components/ui`

## Error Handling
- Try-catch blocks around Firestore queries
- Try-catch around user referenceID fetch (defaults to userId if fails)
- Try-catch around audit logging (fails gracefully if logging fails)
- Loading state prevents duplicate submissions

## Testing Checklist
- [ ] Duplicate a product and verify it appears in the product list
- [ ] Verify duplicated product has "(2)" appended to name
- [ ] Duplicate again and verify "(3)" is used
- [ ] Delete the "(2)" duplicate and duplicate original again - should create "(2)" again
- [ ] Check audit logs to see "Product Duplicated" events
- [ ] Verify audit log contains original and new product IDs
- [ ] Test on mobile - ensure copy icon appears and works
- [ ] Test on desktop - verify hover action works
- [ ] Verify dialog confirmation works and buttons respond correctly
- [ ] Test error handling - disable network and try to duplicate (should show error)

## File Changes Summary
- `lib/auditlogger.ts` - 1 line added to ProductEventPayload type
- `app/products/page.tsx` - 
  - 18 lines added to imports
  - 2 state variables added
  - 1 helper function added (escapeRegExp)
  - 80 lines added for handleDuplicate function
  - 1 line updated for duplicating state variable
  - 2 lines added for duplicate button in desktop actions
  - 4 lines added for duplicate button in mobile actions
  - 11 lines added for confirmation dialog
