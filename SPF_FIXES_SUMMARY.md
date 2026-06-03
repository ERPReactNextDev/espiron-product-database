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

## 🔧 Fix #3: TDS Required Before Submit/Save

### Problem
Hindi required ang **TDS PDF** (View TDS link) bago mag-submit o mag-save ng SPF. Users can submit without generating TDS first.

### Solution
Added validation sa both Create SPF at Edit SPF modes para i-require ang TDS PDF URL.

**Files Fixed:**
1. ✅ `components/spf-request-create.tsx`
2. ✅ `components/spf-request-fetch.tsx`

**Validation Added:**
```typescript
// Validate TDS PDF URL
if (!prod.__tdsPdfUrl || prod.__tdsPdfUrl.trim() === "") {
  toast.error(`Row ${i + 1}, Option ${j + 1}: TDS PDF is required. Please generate TDS first.`);
  return;
}
```

**Button Disabled Condition:**
```typescript
Object.values(productOffers).flat().some(
  (p: any) => !p.__priceValidity?.trim() || !p.__tdsBrand?.trim() ||
    !p.__tdsPdfUrl?.trim() ||  // ✅ NEW: TDS PDF required
    (p.countries?.length > 1 && !p.__selectedBranch?.trim())
)
```

### Result
✅ TDS PDF is now required before submitting/saving SPF requests
✅ Submit/Save buttons are disabled kung walang TDS PDF
✅ Clear error message: "TDS PDF is required. Please generate TDS first."

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

### TDS Required Fix
- [ ] Create SPF and add product
- [ ] Try to submit without generating TDS
- [ ] Verify Submit button is disabled
- [ ] Should show error: "TDS PDF is required"
- [ ] Generate TDS for the product
- [ ] Verify Submit button is now enabled
- [ ] Submit successfully
- [ ] Repeat for Edit SPF mode

---

## Files Modified Summary

### Backend APIs (Unit Cost Fix)
- `pages/api/request/spf-request-create-api.ts` (Line ~278)
- `pages/api/request/spf-request-edit-api.ts` (Line ~259)
- `pages/api/request/spf-request-save-draft-api.ts` (Line ~186)

### Frontend Components (Price Validity & TDS Fixes)
- `components/spf-request-fetch.tsx`
  - Line ~3029: Price Validity always editable
  - Line ~1540: TDS validation in edit submit
  - Line ~2415, ~3550: TDS button disabled conditions
  
- `components/spf-request-create.tsx`
  - Line ~714: TDS validation in create submit
  - Line ~2478: TDS button disabled condition

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

### TDS Required Fix
- **Scope**: All SPF create/edit operations
- **Risk**: Medium - enforces new validation (blocks submit without TDS)
- **Breaking Changes**: None - enforces business requirement
- **User Impact**: Must generate TDS before submitting (proper workflow)

---

## Status
✅ **ALL THREE FIXES COMPLETED** - Ready for testing and deployment
