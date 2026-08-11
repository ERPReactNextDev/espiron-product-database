# TDS Dialog Documentation

## Overview
The `SPFGenerateTDSDialog` component is a dialog interface for generating Technical Data Sheets (TDS) PDFs for products.

## Location
`components/spf-generate-tds-dialog.tsx`

## Features
- **Brand Selection**: Choose between Lit, Lumera, or Ecoshift brands
- **Product Information**: Edit product name and view item code
- **Image Uploads**: 
  - Dimensional Drawing upload (file or URL)
  - Illuminance Level upload (file or URL)
- **PDF Generation**: Creates professional TDS PDFs with:
  - Brand-specific headers and footers
  - Product images
  - Technical specifications table
  - Dimensional and illuminance drawings
- **Cloud Integration**: Uploads generated PDFs to Cloudinary

## Usage

```tsx
import SPFGenerateTDSDialog from "@/components/spf-generate-tds-dialog";

<SPFGenerateTDSDialog
  open={isOpen}
  onClose={() => setIsOpen(false)}
  product={productData}
  onTDSGenerated={(payload) => {
    console.log('TDS generated:', payload);
  }}
/>
```

## Props

| Prop | Type | Description |
|------|------|-------------|
| `open` | `boolean` | Controls dialog visibility |
| `onClose` | `() => void` | Callback when dialog closes |
| `product` | `object` | Product data with name, images, specs |
| `onTDSGenerated` | `function` | Callback when TDS is successfully generated |

## Product Data Structure

```typescript
{
  productName?: string;
  itemCode?: string;
  __tdsBrand?: string;
  mainImage?: { url: string };
  dimensionalDrawing?: { url: string };
  illuminanceDrawing?: { url: string };
  technicalSpecifications?: TechnicalSpecification[];
}
```

## API Endpoints Used

- `/api/request/spf-request-upload-drawing-api` - Upload drawing images
- `/api/request/spf-request-upload-tds-api` - Upload generated TDS PDF
- `/api/gdrive-image` - Proxy for Google Drive images

## Dependencies

- `jspdf` - PDF generation
- `jspdf-autotable` - PDF table generation
- `lucide-react` - Icons
- `sonner` - Toast notifications
- `@/components/ui/dialog` - Dialog UI component

## Notes

- Google Drive URLs are automatically converted to thumbnail URLs
- Empty specifications can be hidden/shown via toggle
- PDF generation includes error handling for missing images
- Drawings upload failures don't block PDF generation
