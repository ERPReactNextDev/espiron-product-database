# Product System Documentation

## Overview

This documentation explains how the product system works, with focus on the template synchronization, product usage selection, product family management, and technical specifications. This system is designed to maintain consistency across products that share similar characteristics.

## Core Concepts

### 1. Product Usage (Category Types)

**What it is:**
Product Usage (also referred to as Category Types) represents the high-level classification of how a product is used or applied. Examples might include "Lighting", "Poles", "Accessories", etc.

**How it works:**
- Stored in Firebase collection: `categoryTypes`
- Each category type has an `id` and `name`
- Must be selected FIRST before selecting a product family
- Only ONE category type can be selected at a time for technical specifications

**Code Location:**
- `app/edit-product/page.tsx` lines 515-517
- `app/add-product/page.tsx` lines 413-415

**Selection Flow:**
```typescript
// User selects a category type
setSelectedCategoryTypes([{ id: categoryId, name: categoryName }]);

// This triggers loading of product families filtered by this category type
useEffect(() => {
  if (selectedCategoryTypes.length === 0) { setProductFamilies([]); return; }
  const q = query(collection(db, "productFamilies"), 
    where("categoryTypeId", "==", selectedCategoryTypes[0].id), 
    where("isActive", "==", true));
  return onSnapshot(q, snap => setProductFamilies(...));
}, [selectedCategoryTypes]);
```

### 2. Product Family

**What it is:**
Product Family represents a group of products that share the same technical specification template. All products within the same family will have the same structure of technical specifications, though the actual values may differ.

**How it works:**
- Stored in Firebase collection: `productFamilies`
- Each product family has:
  - `id`: Unique identifier
  - `name`: Display name (e.g., "LED Downlight", "Street Light Pole")
  - `productUsageId`: Links to the category type
  - `categoryTypeId`: The category type this family belongs to
- Product families are FILTERED by the selected category type
- When a product family is selected, it automatically loads the technical specification template

**Code Location:**
- `app/edit-product/page.tsx` lines 519-523 (loading)
- `app/edit-product/page.tsx` lines 727-735 (selection function)

**Selection Flow:**
```typescript
const selectProductFamily = async (item: ProductFamily) => {
  setSelectedProductFamily(item);
  if (selectedCategoryTypes.length !== 1) return;
  
  // Load technical specifications template for this family
  const snap = await getDocs(query(
    collection(db, "technicalSpecifications"), 
    where("categoryTypeId", "==", selectedCategoryTypes[0].id), 
    where("productFamilyId", "==", item.id), 
    where("isActive", "==", true)
  ));
  
  const loaded = snap.docs
    .map(d => ({ 
      id: d.id, 
      title: d.data().title, 
      sortOrder: d.data().sortOrder ?? 999, 
      specs: (d.data().specs || []).map((r: any) => ({ ...r, value: "" })) 
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
  
  setTechnicalSpecs(loaded);
};
```

### 3. Technical Specifications

**What it is:**
Technical Specifications are the detailed technical parameters that define a product's characteristics. They are organized hierarchically and can have different field types.

**Structure:**
```
TechnicalSpecification (Group)
├── id: Unique identifier
├── title: Group title (e.g., "Electrical Specifications")
├── sortOrder: Display order
└── specs: Array of SpecRow[]
    └── SpecRow (Individual field)
        ├── specId: Unique field identifier
        ├── unit: Unit of measurement (e.g., "V", "A", "mm")
        └── value: The actual value for this product
```

**Code Location:**
- Type definitions: `app/edit-product/page.tsx` lines 69-75
- Loading: `app/edit-product/page.tsx` lines 498-504

## Template Synchronization

### Overview

The template synchronization system ensures that changes to technical specification templates are properly propagated to:
1. The product family template (stored in `technicalSpecifications` collection)
2. All products that use this product family (stored in `products` collection)

There are TWO sync operations:

### Sync 1: Sync Template Changes to Family

**Purpose:**
Saves the current technical specifications being edited to the product family template in the database. This makes the changes the "new template" for this product family.

**When to use:**
- After adding, removing, or reordering technical specification groups
- After adding, removing, or reordering spec rows within groups
- After changing field types or units

**How it works:**
```typescript
const syncTemplateChangesToFamily = async () => {
  if (!selectedProductFamily || selectedCategoryTypes.length !== 1) return;
  const categoryTypeId = selectedCategoryTypes[0].id;
  const productFamilyId = selectedProductFamily.id;
  
  // Get existing specs for this family
  const snap = await getDocs(query(
    collection(db, "technicalSpecifications"), 
    where("categoryTypeId", "==", categoryTypeId), 
    where("productFamilyId", "==", productFamilyId)
  ));
  
  const batch = writeBatch(db);
  const updatedSpecs = [...technicalSpecs];
  
  // Delete specs that no longer exist in the template
  snap.forEach(docSnap => {
    const exists = updatedSpecs.find(s => s.id === docSnap.id);
    if (!exists) batch.delete(docSnap.ref);
  });
  
  // Create or update each spec in the template
  for (let i = 0; i < updatedSpecs.length; i++) {
    const spec = updatedSpecs[i];
    if (!spec.title.trim()) continue;
    
    let ref;
    if (spec.id) {
      ref = doc(db, "technicalSpecifications", spec.id);
    } else {
      ref = doc(collection(db, "technicalSpecifications"));
      updatedSpecs[i].id = ref.id;
    }
    
    batch.set(ref, { 
      categoryTypeId, 
      productFamilyId, 
      title: spec.title, 
      specs: spec.specs, 
      sortOrder: i + 1, 
      isActive: true, 
      updatedAt: serverTimestamp() 
    });
  }
  
  await batch.commit();
  setTechnicalSpecs(updatedSpecs);
};
```

**What happens:**
1. Fetches all existing technical specifications for this product family
2. Deletes any specs that were removed from the template
3. Creates new specs for newly added groups
4. Updates existing specs with new titles, field definitions, and sort order
5. Updates the `updatedAt` timestamp

**Database Impact:**
- Collection: `technicalSpecifications`
- Documents affected: All template specs for this product family

### Sync 2: Sync Products Using This Family

**Purpose:**
Applies the current template changes to ALL products that use this product family. This ensures consistency across all products in the family.

**When to use:**
- AFTER running "Sync Template Changes to Family"
- When you want to propagate template changes to existing products
- When you've finalized template modifications and want to update all products

**How it works:**
```typescript
const syncProductsUsingThisFamily = async () => {
  if (!selectedProductFamily) return;
  
  // Find all products using this family
  const q = query(collection(db, "products"), 
    where("productFamilies", "array-contains", { 
      productFamilyId: selectedProductFamily.id, 
      productFamilyName: selectedProductFamily.name, 
      productUsageId: selectedProductFamily.productUsageId 
    }));
  
  const snapshot = await getDocs(q);
  const docs = snapshot.docs;
  const CHUNK_SIZE = 200;
  
  // Process in chunks to avoid batch size limits
  for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
    const chunk = docs.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    
    chunk.forEach(productDoc => {
      const ref = doc(db, "products", productDoc.id);
      const data: any = productDoc.data();
      const existingSpecs = data.technicalSpecifications || [];
      
      // Merge template with existing product specs
      const mergedSpecs = technicalSpecs.map((templateSpec, index) => {
        const existingSpec = existingSpecs.find((s: any) => 
          s.technicalSpecificationId === templateSpec.id
        );
        
        return {
          technicalSpecificationId: templateSpec.id,
          title: templateSpec.title,
          sortOrder: index + 1,
          specs: templateSpec.specs.map((templateRow: SpecRow) => {
            const existingRow = existingSpec?.specs?.find((r: SpecRow) => 
              r.specId === templateRow.specId
            );
            
            // Preserve existing values for other products, use template values for current product
            return { 
              specId: templateRow.specId, 
              value: productDoc.id === productId 
                ? templateRow.value || "" 
                : existingRow?.value || "" 
            };
          }),
        };
      });
      
      batch.update(ref, { 
        technicalSpecifications: mergedSpecs, 
        updatedAt: serverTimestamp() 
      });
    });
    
    await batch.commit();
  }
};
```

**What happens:**
1. Finds all products that have this product family in their `productFamilies` array
2. Processes products in chunks of 200 (to respect Firebase batch limits)
3. For each product:
   - Compares the new template with the product's existing specs
   - **Preserves existing values** for fields that still exist in the template
   - **Adds new fields** from the template (with empty values)
   - **Removes fields** that are no longer in the template
   - **Updates field order** to match the new template
4. Updates the `updatedAt` timestamp for each product

**Smart Value Preservation:**
- If a field exists in both the old template and new template, the product's existing value is preserved
- If a field is new in the template, it's added with an empty value
- If a field was removed from the template, it's removed from the product
- For the CURRENT product being edited, template values are used
- For OTHER products, their existing values are preserved

**Database Impact:**
- Collection: `products`
- Documents affected: All products using this product family
- Processing: Batched in chunks of 200 products

## Complete Workflow

### Adding a New Product with Template

1. **Select Product Usage (Category Type)**
   - Choose the high-level category (e.g., "Lighting")
   - This filters available product families

2. **Select Product Family**
   - Choose the appropriate family (e.g., "LED Downlight")
   - System automatically loads the technical specification template

3. **Review/Edit Technical Specifications**
   - Template loads with empty values
   - Fill in the actual values for this specific product
   - You can modify the template structure if needed

4. **Fill in Other Product Details**
   - Supplier information
   - Commercial details (pricing, packaging, etc.)
   - Images and drawings
   - Other product metadata

5. **Save Product**
   - Product is saved with the technical specifications
   - If you modified the template structure, consider syncing

### Modifying an Existing Product's Template

1. **Open Product for Editing**
   - Navigate to edit product page
   - Product loads with its current technical specifications

2. **Modify Template Structure**
   - Add/remove technical specification groups
   - Add/remove spec rows within groups
   - Change field types or units
   - Reorder groups or rows

3. **Sync Template Changes to Family**
   - Click "Sync Template Changes to Family" button
   - This saves your changes as the new template for this product family
   - Template is now updated in the `technicalSpecifications` collection

4. **Sync Products Using This Family** (Optional but Recommended)
   - Click "Sync Products Using This Family" button
   - This applies the template changes to ALL products using this family
   - Existing product values are preserved where possible
   - New fields are added with empty values
   - Removed fields are deleted from products

5. **Save Current Product**
   - Save the current product with the new template structure

## Important Notes

### Template vs. Product Values

- **Template**: Defines the STRUCTURE of technical specifications (what fields exist, their types, units, order)
- **Product Values**: The actual VALUES for each field in a specific product
- Templates are stored in `technicalSpecifications` collection
- Product values are stored in `products` collection within each product document

### Value Preservation

When syncing products:
- The system intelligently preserves existing product values
- Only the structure changes, not the data (unless fields are removed)
- This prevents accidental data loss during template updates

### Batch Processing

The "Sync Products Using This Family" function processes products in batches of 200 to:
- Respect Firebase's batch operation limits
- Prevent timeout issues with large product catalogs
- Ensure reliable updates even with thousands of products

### Category Type Constraint

Technical specifications require exactly ONE category type to be selected:
- If zero category types: Product families won't load
- If multiple category types: Template sync won't work
- This ensures a clear hierarchical structure

### Active Status

Both category types and product families have an `isActive` field:
- Only active items are loaded in dropdowns
- Soft delete is achieved by setting `isActive = false`
- Inactive items are preserved in database but hidden from UI

## Database Schema

### categoryTypes Collection
```javascript
{
  id: "string",
  name: "string",
  isActive: boolean,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### productFamilies Collection
```javascript
{
  id: "string",
  name: "string",
  categoryTypeId: "string",
  productUsageId: "string",
  isActive: boolean,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### technicalSpecifications Collection
```javascript
{
  id: "string",
  categoryTypeId: "string",
  productFamilyId: "string",
  title: "string",
  sortOrder: number,
  specs: [
    {
      specId: "string",
      unit: "string",
      value: "string"
    }
  ],
  isActive: boolean,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### products Collection (Technical Specs Section)
```javascript
{
  // ... other product fields
  categoryTypes: [
    {
      productUsageId: "string",
      categoryTypeName: "string"
    }
  ],
  productFamilies: [
    {
      productFamilyId: "string",
      productFamilyName: "string",
      productUsageId: "string"
    }
  ],
  technicalSpecifications: [
    {
      technicalSpecificationId: "string",
      title: "string",
      sortOrder: number,
      specs: [
        {
          specId: "string",
          value: "string"
          // ... other field-specific values
        }
      ]
    }
  ]
}
```

## Best Practices

1. **Plan Your Template Structure**
   - Think carefully about the technical specifications before creating templates
   - Group related fields together
   - Use clear, descriptive titles

2. **Test with One Product First**
   - Modify template on one product
   - Sync to family
   - Verify the structure is correct
   - Then sync to all products

3. **Backup Before Major Changes**
   - Consider exporting product data before major template restructuring
   - The sync function preserves values, but it's good practice to be safe

4. **Use Consistent Units**
   - Use consistent units across similar fields in the family
   - This makes data entry and reporting easier

5. **Document Your Templates**
   - Keep notes on what each field represents
   - This helps when training new users

6. **Regular Maintenance**
   - Periodically review templates for consistency
   - Remove obsolete fields
   - Add new fields as product lines evolve

## Troubleshooting

### Template Not Loading
- **Check**: Is exactly one category type selected?
- **Check**: Is the product family active?
- **Check**: Does the product family have the correct categoryTypeId?

### Sync Not Working
- **Check**: Is a product family selected?
- **Check**: Is exactly one category type selected?
- **Check**: Are there any validation errors in the technical specs?

### Values Not Preserved After Sync
- **Check**: Did you run "Sync Template Changes to Family" first?
- **Check**: Are the specId values matching between old and new templates?
- **Check**: Is the product actually using this product family?

### Performance Issues
- **Check**: How many products are in the family? Large families take longer to sync
- **Check**: Is the network connection stable?
- **Check**: Are there any Firebase quota limits being approached?

## Summary

The product template system is designed to:
1. **Maintain Consistency**: Ensure all products in a family have the same technical structure
2. **Enable Bulk Updates**: Change template once, apply to all products
3. **Preserve Data**: Smart value preservation prevents data loss during updates
4. **Scale Efficiently**: Batch processing handles large product catalogs

The key to success is understanding the difference between:
- **Template Structure** (what fields exist, how they're organized)
- **Product Values** (the actual data for each product)

By following this documentation, you can effectively manage product templates and ensure consistency across your product database.