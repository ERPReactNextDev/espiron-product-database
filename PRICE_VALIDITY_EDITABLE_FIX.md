# Price Validity Editable Fix

## Issue
Kapag nag-edit (revise) ng SPF, ang **Price Validity** field ay **disabled/read-only** para sa existing products. Hindi pwedeng i-update ang date.

## Root Cause
Sa `components/spf-request-fetch.tsx`, ang Price Validity input field ay naka-disable based sa `__isExisting` flag:

### Dating Code (Mali)
```typescript
<input
  type="datetime-local"
  className={`border px-1 py-0.5 text-xs w-full ${prod.__isExisting ? "bg-gray-100 cursor-not-allowed" : ""}`}
  value={prod.__priceValidity ?? ""}
  disabled={prod.__isExisting}  // ❌ Disabled for existing products
  title={prod.__isExisting ? "Price validity cannot be edited for existing products" : "Price validity"}
  onChange={prod.__isExisting ? undefined : (e) => {
    // ... update logic
  }}
/>
```

**Behavior:**
- ✅ **New products** - Price Validity editable
- ❌ **Existing products** - Price Validity disabled (read-only)

## Solution
Tinanggal ang `disabled` attribute at ang conditional onChange handler para laging editable ang Price Validity field.

### Bagong Code (Tama)
```typescript
<input
  type="datetime-local"
  className="border px-1 py-0.5 text-xs w-full"
  value={prod.__priceValidity ?? ""}
  title="Price validity"
  onChange={(e) => {
    setProductOffers((prev) => {
      const copy = { ...prev };
      const row = [...(copy[index] || [])];
      row[i] = { ...row[i], __priceValidity: e.target.value, price_validity: e.target.value };
      copy[index] = row;
      return copy;
    });
  }}
/>
```

**Behavior:**
- ✅ **New products** - Price Validity editable
- ✅ **Existing products** - Price Validity editable

## Changes Made
1. Removed `disabled={prod.__isExisting}` attribute
2. Removed conditional gray background styling
3. Removed conditional onChange handler
4. Simplified title to always show "Price validity"

## Files Modified
- ✅ `components/spf-request-fetch.tsx` (Line ~3029-3041)

## Testing
Para i-test ang fix:
1. Open existing SPF for editing (Edit/Revise mode)
2. Click on Price Validity field ng existing product
3. Verify na editable na ang field at pwede nang mag-select ng bagong date/time
4. Save changes
5. Verify na ang bagong Price Validity date ay naka-save sa database

## Impact
- **Scope**: Edit SPF mode only (desktop view)
- **User benefit**: Users can now update price validity dates for existing products during SPF revision
- **Breaking changes**: None - only enables previously disabled functionality

## Status
✅ **FIXED** - Price Validity field is now always editable in Edit SPF mode
