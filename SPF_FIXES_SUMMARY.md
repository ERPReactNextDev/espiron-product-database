# SPF Fixes Summary

## 🔧 Fix #1: Unit Cost nagiging 0 (LIGHT Multiple Products)

### Problem
Kapag nag-create o nag-edit ng SPF na may **LIGHT (Multiple)** type products, ang unit cost ay nagiging **0** sa database kahit may value sa form.

### Root Cause
- LIGHT (Multiple) products store unit cost sa `multiRows[]` array
- Pero ang API ay kumukuha lang sa `commercialDetails.unitCost` (single field)
- Result: 0 value kasi walang laman ang single field

### Solution
Updated ang logic sa 3 API files para i-sum ang unit costs mula sa multiRows:

**Files Fixed:**
1. ✅ `pages/api/request/spf-request-create-api.ts`
2. ✅ `pages/api/request/spf-request-edit-api.ts`
3. ✅ `pages/api/request/spf-request-save-draft-api.ts`

**New Logic:**
```typescript
// Extract unit cost based on commercial type
let unitCost = 0;
const commercialType = String(p?.commercialDetails?.commercialType || "BASIC").toUpperCase();

if (commercialType === "LIGHT" && p?.commercialDetails?.useArrayInput && Array.isArray(p?.commercialDetails?.multiRows)) {
  // LIGHT (Multiple): sum all item unit costs
  unitCost = p.commercialDetails.multiRows.reduce((sum: number, row: any) => 
    sum + (Number(row?.unitCost || 0)), 0
  );
} else {
  // LIGHT (Single), BASIC, or POLE: use direct unitCost
  unitCost = Number(p?.commercialDetails?.unitCost || 0);
}
```

### Result
✅ Unit cost ng LIGHT (Multiple) products ay tama na ang nase-save sa database

---

## 🔧 Fix #2: Price Validity Hindi Editable sa Edit Mode

### Problem
Kapag nag-edit (revise) ng SPF, ang **Price Validity** field ay disabled/read-only para sa existing products. Hindi pwedeng i-update ang date.

### Root Cause
- Price Validity input field ay naka-disable based sa `__isExisting` flag
- Existing products = disabled field
- Only new products = editable field

### Solution
Tinanggal ang `disabled` attribute at conditional handlers para laging editable.

**File Fixed:**
1. ✅ `components/spf-request-fetch.tsx`

**Changes:**
- Removed `disabled={prod.__isExisting}`
- Removed gray background conditional styling
- Removed conditional onChange handler
- Simplified to always editable

### Result
✅ Price Validity field ay laging editable na, kahit existing products pa

---

## Testing Checklist

### Unit Cost Fix
- [ ] Create SPF with LIGHT (Multiple) product
- [ ] Enter unit costs sa bawat item
- [ ] Submit SPF
- [ ] Check database - unit cost should be sum of all items
- [ ] Edit SPF with LIGHT (Multiple) product
- [ ] Update unit costs
- [ ] Save changes
- [ ] Verify updated values in database

### Price Validity Fix
- [ ] Open existing SPF for editing
- [ ] Locate existing product sa table
- [ ] Click Price Validity field
- [ ] Field should be editable (not grayed out)
- [ ] Select new date/time
- [ ] Save changes
- [ ] Verify new price validity saved in database

---

## Files Modified Summary

### Backend APIs (Unit Cost Fix)
- `pages/api/request/spf-request-create-api.ts` (Line ~278)
- `pages/api/request/spf-request-edit-api.ts` (Line ~259)
- `pages/api/request/spf-request-save-draft-api.ts` (Line ~186)

### Frontend Components (Price Validity Fix)
- `components/spf-request-fetch.tsx` (Line ~3029)

---

## Impact Assessment

### Unit Cost Fix
- **Scope**: All SPF create/edit/draft operations with LIGHT Multiple products
- **Risk**: Low - only fixes incorrect 0 values
- **Breaking Changes**: None - improves existing functionality

### Price Validity Fix
- **Scope**: SPF edit mode only
- **Risk**: Low - enables previously disabled field
- **Breaking Changes**: None - only enables functionality

---

## Status
✅ **BOTH FIXES COMPLETED** - Ready for testing and deployment
