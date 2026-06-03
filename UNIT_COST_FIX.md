# Unit Cost Fix - LIGHT (Multiple) Products

## Issue
Kapag nag-create o nag-edit ng SPF request na may **LIGHT (Multiple)** type na products, ang unit cost ay nagiging **0** kahit na may value sa form.

## Root Cause
Ang issue ay nangyayari dahil sa mismatch ng data structure:

### Expected vs Actual Data Structure

**Para sa LIGHT (Single), BASIC, at POLE products:**
```javascript
product.commercialDetails.unitCost = 123.45  // ✅ Single value
```

**Para sa LIGHT (Multiple) products:**
```javascript
product.commercialDetails.multiRows = [
  { itemName: "Item 1", unitCost: 50.00, qtyPerCarton: 10, ... },
  { itemName: "Item 2", unitCost: 75.00, qtyPerCarton: 20, ... }
]
// Total unit cost = 50.00 + 75.00 = 125.00
```

### Ang Dating Code (Mali)
```typescript
// ❌ Hindi kumukuha ng unit cost mula sa multiRows
const unitCost = Number(p?.commercialDetails?.unitCost || 0);
```

Para sa LIGHT (Multiple), walang `commercialDetails.unitCost` field, kaya nagiging **0**.

## Solution
Updated ang tatlong API files para tama ang extraction ng unit cost:

### 1. `/pages/api/request/spf-request-create-api.ts`
### 2. `/pages/api/request/spf-request-edit-api.ts`  
### 3. `/pages/api/request/spf-request-save-draft-api.ts`

### Bagong Logic (Tama)
```typescript
// Extract unit cost: for LIGHT Multiple, sum all multiRows unitCost; otherwise use direct unitCost
let unitCost = 0;
const commercialType = String(p?.commercialDetails?.commercialType || "BASIC").toUpperCase();

if (commercialType === "LIGHT" && p?.commercialDetails?.useArrayInput && Array.isArray(p?.commercialDetails?.multiRows)) {
  // LIGHT (Multiple): sum all item unit costs
  unitCost = p.commercialDetails.multiRows.reduce((sum: number, row: any) => sum + (Number(row?.unitCost || 0)), 0);
} else {
  // LIGHT (Single), BASIC, or POLE: use direct unitCost
  unitCost = Number(p?.commercialDetails?.unitCost || 0);
}
```

## How It Works
1. **Check commercial type** - Tingnan kung LIGHT (Multiple) ba ang product
2. **Sum multiRows** - Kung LIGHT (Multiple), i-add lahat ng unit costs mula sa bawat item
3. **Use direct value** - Kung hindi LIGHT (Multiple), kunin ang direct `unitCost` value

## Testing
Para i-test ang fix:
1. Create/Edit SPF with LIGHT (Multiple) product
2. Enter unit costs sa bawat item sa multiRows
3. Submit/Save
4. Verify na ang unit cost sa database ay tama (sum of all items)

## Files Modified
- ✅ `pages/api/request/spf-request-create-api.ts` (Line ~278)
- ✅ `pages/api/request/spf-request-edit-api.ts` (Line ~259)
- ✅ `pages/api/request/spf-request-save-draft-api.ts` (Line ~186)

## Status
✅ **FIXED** - Unit cost ay maayos nang nase-save para sa LIGHT (Multiple) products
