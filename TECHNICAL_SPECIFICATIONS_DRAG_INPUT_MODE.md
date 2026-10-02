# Technical Specifications: Drag/Input Mode for Technical Specifications

## Overview
This document specifies the implementation of a drag/input mode toggle for the technical specifications section in the Add Product and Edit Product pages and components. This feature will allow users to switch between a drag-and-drop mode for reordering specifications and an input mode for editing values.

## Scope
This specification applies to:
- `/app/add-product/page.tsx`
- `/app/edit-product/page.tsx`
- `/components/add-product-component.tsx`
- `/components/edit-product-component.tsx`

## Current State
The system currently has:
- Drag-and-drop functionality for reordering technical specification groups
- Drag-and-drop functionality for reordering spec rows within groups
- Multiple spec row modes: `isRanging`, `isSlashing`, `isDimension`, `isRating`
- Basic input fields for spec values
- Unit input fields

## Proposed Feature: Drag/Input Mode Toggle

### 1. Mode Toggle Checkbox
A checkbox control will be added to each technical specification group to toggle between:
- **Drag Mode**: Enable drag-and-drop for reordering spec rows
- **Input Mode**: Disable drag-and-drop, enable full editing capabilities

### 2. UI Changes

#### 2.1. Add Mode Toggle to Spec Group Header
Each technical specification group card will have a mode toggle in its header:

```tsx
<CardHeader className="flex flex-row items-center justify-between">
  <CardTitle className="text-sm">{item.title}</CardTitle>
  <div className="flex items-center gap-2">
    <Label className="text-xs">Mode:</Label>
    <Checkbox
      checked={item.isDragMode}
      onCheckedChange={(checked) => toggleDragMode(index, checked as boolean)}
    />
    <span className="text-xs">{item.isDragMode ? "Drag" : "Input"}</span>
  </div>
</CardHeader>
```

#### 2.2. Spec Row State Update
Add `isDragMode` field to `TechnicalSpecification` type:

```tsx
type TechnicalSpecification = {
  id: string;
  title: string;
  specs: SpecRow[];
  isDragMode: boolean; // NEW: True = drag mode, False = input mode
  sortOrder?: number;
};
```

#### 2.3. Drag Mode Behavior
When `isDragMode` is `true`:
- Spec rows are draggable (current behavior)
- `draggable` attribute is set to `true`
- Drag event handlers are active: `onDragStart`, `onDragOver`, `onDrop`
- Cursor style: `cursor-move`
- Visual feedback: Border style indicates draggable
- Input fields may be disabled or read-only to prevent accidental edits during dragging

#### 2.4. Input Mode Behavior
When `isDragMode` is `false`:
- Spec rows are NOT draggable
- `draggable` attribute is set to `false`
- Drag event handlers are disabled
- Cursor style: `cursor-default`
- Input fields are fully editable
- Additional dimension-specific inputs are shown for `isDimension` rows

### 3. Dimension-Specific Input Fields

When in **Input Mode** and a spec row has `isDimension: true`, show additional dimension inputs:

```tsx
{!item.isDragMode && row.isDimension && (
  <div className="grid grid-cols-3 gap-2 mt-2">
    <div className="space-y-1">
      <Label className="text-[10px] text-green-600 font-bold uppercase">Length</Label>
      <Input
        className="border-green-300 bg-white text-sm"
        placeholder="Length"
        value={row.length}
        onChange={e => updateSpecField(index, rIndex, "length", e.target.value)}
      />
    </div>
    <div className="space-y-1">
      <Label className="text-[10px] text-green-600 font-bold uppercase">Width</Label>
      <Input
        className="border-green-300 bg-white text-sm"
        placeholder="Width"
        value={row.width}
        onChange={e => updateSpecField(index, rIndex, "width", e.target.value)}
      />
    </div>
    <div className="space-y-1">
      <Label className="text-[10px] text-green-600 font-bold uppercase">Height</Label>
      <Input
        className="border-green-300 bg-white text-sm"
        placeholder="Height"
        value={row.height}
        onChange={e => updateSpecField(index, rIndex, "height", e.target.value)}
      />
    </div>
  </div>
)}
```

### 4. Mode-Specific Fields Based on Spec Type

#### 4.1. Ranging Mode (`isRanging: true`)
When in Input Mode and `isRanging` is true:
```tsx
{!item.isDragMode && row.isRanging && (
  <div className="grid grid-cols-2 gap-2 mt-2">
    <div className="space-y-1">
      <Label className="text-[10px] text-purple-600 font-bold uppercase">Range From</Label>
      <Input
        className="border-purple-300 bg-white text-sm"
        placeholder="From"
        value={row.rangeFrom}
        onChange={e => updateSpecField(index, rIndex, "rangeFrom", e.target.value)}
      />
    </div>
    <div className="space-y-1">
      <Label className="text-[10px] text-purple-600 font-bold uppercase">Range To</Label>
      <Input
        className="border-purple-300 bg-white text-sm"
        placeholder="To"
        value={row.rangeTo}
        onChange={e => updateSpecField(index, rIndex, "rangeTo", e.target.value)}
      />
    </div>
  </div>
)}
```

#### 4.2. Slashing Mode (`isSlashing: true`)
When in Input Mode and `isSlashing` is true:
```tsx
{!item.isDragMode && row.isSlashing && (
  <div className="space-y-2 mt-2">
    <Label className="text-[10px] text-red-600 font-bold uppercase">Slash Values</Label>
    {row.slashValues.map((val, svIndex) => (
      <div key={svIndex} className="flex gap-2">
        <Input
          className="border-red-300 bg-white text-sm"
          placeholder={`Value ${svIndex + 1}`}
          value={val}
          onChange={e => {
            const newSlashValues = [...row.slashValues];
            newSlashValues[svIndex] = e.target.value;
            updateSpecField(index, rIndex, "slashValues", newSlashValues);
          }}
        />
        {row.slashValues.length > 1 && (
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8 shrink-0"
            onClick={() => {
              const newSlashValues = row.slashValues.filter((_, i) => i !== svIndex);
              updateSpecField(index, rIndex, "slashValues", newSlashValues);
            }}
          >
            <Minus className="h-3 w-3" />
          </Button>
        )}
      </div>
    ))}
    <Button
      size="sm"
      variant="outline"
      className="text-xs"
      onClick={() => {
        updateSpecField(index, rIndex, "slashValues", [...row.slashValues, ""]);
      }}
    >
      <Plus className="h-3 w-3 mr-1" /> Add Value
    </Button>
  </div>
)}
```

#### 4.3. Rating Mode (`isRating: true`)
When in Input Mode and `isRating` is true:
```tsx
{!item.isDragMode && row.isRating && (
  <div className="grid grid-cols-2 gap-2 mt-2">
    <div className="space-y-1">
      <Label className="text-[10px] text-yellow-600 font-bold uppercase">IP First</Label>
      <Input
        className="border-yellow-300 bg-white text-sm"
        placeholder="e.g. 65"
        value={row.ipFirst}
        onChange={e => updateSpecField(index, rIndex, "ipFirst", e.target.value)}
      />
    </div>
    <div className="space-y-1">
      <Label className="text-[10px] text-yellow-600 font-bold uppercase">IP Second</Label>
      <Input
        className="border-yellow-300 bg-white text-sm"
        placeholder="e.g. 67"
        value={row.ipSecond}
        onChange={e => updateSpecField(index, rIndex, "ipSecond", e.target.value)}
      />
    </div>
  </div>
)}
```

### 5. Mode Toggle Handler

Add a handler function to toggle drag mode for a spec group:

```tsx
const toggleDragMode = (specIndex: number, isDragMode: boolean) => {
  setTechnicalSpecs(prev =>
    prev.map((spec, i) =>
      i === specIndex ? { ...spec, isDragMode } : spec
    )
  );
};
```

### 6. Default Mode
- Default mode for new spec groups: `isDragMode: true` (drag mode enabled)
- When loading existing specs from database, preserve the saved `isDragMode` state
- If not present in database, default to `true`

### 7. Visual Indicators

#### 7.1. Drag Mode Visuals
- Spec row background: `bg-orange-50`
- Border: `border-orange-200`
- Drag handle icon on left side
- Cursor: `cursor-move`
- Spec row container has `draggable={true}`

#### 7.2. Input Mode Visuals
- Spec row background: `bg-white`
- Border: `border-gray-200`
- No drag handle
- Cursor: `cursor-default`
- Spec row container has `draggable={false}`
- Additional input fields shown based on spec type

### 8. Data Persistence

When saving technical specifications to the database, include the `isDragMode` field:

```tsx
batch.set(ref, {
  categoryTypeId,
  productFamilyId: selectedProductFamily.id,
  title: spec.title.trim(),
  sortOrder: i + 1,
  isDragMode: spec.isDragMode ?? true, // Include mode state
  specs: spec.specs.filter(r => r.specId.trim()).map(r => ({
    specId: r.specId.trim(),
    unit: r.unit || "",
    isRanging: r.isRanging || false,
    isSlashing: r.isSlashing || false,
    isDimension: r.isDimension || false,
    isRating: r.isRating || false,
    rangeFrom: r.rangeFrom || "",
    rangeTo: r.rangeTo || "",
    slashValues: r.slashValues || [""],
    length: r.length || "",
    width: r.width || "",
    height: r.height || "",
    ipFirst: r.ipFirst || "",
    ipSecond: r.ipSecond || "",
  })),
  isActive: true,
  updatedAt: serverTimestamp()
});
```

### 9. Implementation Checklist

#### For Add Product Page (`app/add-product/page.tsx`)
- [ ] Add `isDragMode` to `TechnicalSpecification` type
- [ ] Update `emptySpecRow` default values (no change needed)
- [ ] Add `toggleDragMode` handler function
- [ ] Update `addTechnicalSpec` to include `isDragMode: true`
- [ ] Update spec group card JSX to include mode toggle checkbox
- [ ] Update spec row JSX to conditionally render based on `isDragMode`
- [ ] Add dimension-specific inputs for `isDimension` rows in input mode
- [ ] Add ranging inputs for `isRanging` rows in input mode
- [ ] Add slash value inputs for `isSlashing` rows in input mode
- [ ] Add IP rating inputs for `isRating` rows in input mode
- [ ] Update `syncSpecsToProductType` to include `isDragMode` in database save
- [ ] Update spec loading from database to preserve `isDragMode` state

#### For Edit Product Page (`app/edit-product/page.tsx`)
- [ ] Apply all changes from Add Product Page
- [ ] Ensure `isDragMode` is loaded from existing product data
- [ ] Update product data loading useEffect to preserve `isDragMode`

#### For Add Product Component (`components/add-product-component.tsx`)
- [ ] Apply all changes from Add Product Page
- [ ] Ensure component state management includes `isDragMode`

#### For Edit Product Component (`components/edit-product-component.tsx`)
- [ ] Apply all changes from Edit Product Page
- [ ] Ensure component state management includes `isDragMode`

### 10. User Experience Flow

1. **User opens Add/Edit Product page**
   - Technical specifications section displays with default drag mode enabled
   - Each spec group has a mode toggle checkbox

2. **User in Drag Mode (default)**
   - Can drag and drop spec groups to reorder
   - Can drag and drop spec rows within groups to reorder
   - Basic value input is available but secondary
   - Cursor shows move indicator
   - Visual feedback shows draggable state

3. **User toggles to Input Mode**
   - Drag functionality is disabled
   - Full editing capabilities are enabled
   - Based on spec row type, additional inputs appear:
     - Dimension rows: Length, Width, Height inputs
     - Ranging rows: Range From, Range To inputs
     - Slashing rows: Multiple slash value inputs with add/remove
     - Rating rows: IP First, IP Second inputs
   - Cursor shows default
   - Visual feedback shows editable state

4. **User saves product**
   - Mode state is saved to database
   - On next edit, mode state is preserved

### 11. Accessibility Considerations
- Mode toggle checkbox should have proper label
- Keyboard navigation should work for mode toggle
- Screen reader should announce mode changes
- Focus management when switching modes

### 12. Edge Cases
- What happens when switching modes with unsaved changes? (Preserve state)
- What happens when all rows are deleted in a group? (Keep mode state)
- What happens when loading legacy data without `isDragMode`? (Default to true)
- What happens in mobile view? (Simplify mode toggle, maybe use switch instead of checkbox)

### 13. Future Enhancements
- Global mode toggle for all spec groups at once
- Keyboard shortcuts for mode switching
- Drag handles that only appear in drag mode
- Mode-specific validation rules
- Copy/paste functionality for dimension values in input mode
