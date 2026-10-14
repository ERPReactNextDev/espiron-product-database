# SPF Quotation Tracking Feature

## Overview
This feature displays quotation records from the `history` table that include SPF-DSI products (where `product_sku` contains "SPF-DSI-") and have `type_activity` set to "Quotation Preparation". The data is displayed in a grouped table on the SPF Quotation Tracking page, where records are grouped by Activity Reference Number and Account Reference Number.

Some records contain a mix of SKUs (e.g. `PLL-12W-WW-028,SPF-DSI-26-0228-001-OPT-1,`). These records are still included, but the UI only shows the SPF-DSI SKUs and hides all other codes.

**Grouping Logic**: Quotations are grouped by the combination of `activity_reference_number` and `account_reference_number`. If multiple quotations share the same activity and account reference numbers, they are displayed in a single row with a dropdown to select between the different quotation numbers.

## Files Created/Modified

### 1. API Route: `/app/api/spf-dsi-quotations/route.ts`
**Purpose**: Fetches SPF-DSI quotations from the Supabase `history` table with pagination support.

**Key Features**:
- Filters records where `type_activity = 'Quotation Preparation'`
- Filters records where `product_sku` contains "SPF-DSI-" (case-insensitive `ilike '%SPF-DSI-%'`)
- Joins with `users` table to resolve `referenceid` to sales agent's first and last name
- Supports pagination with `limit` and `offset` query parameters
- Returns total count for pagination controls
- Orders by `date_updated` (descending) then by `id` (descending)
- Returns the raw `product_sku` value; SKU cleanup is done on the client

**Query Parameters**:
- `limit`: Number of records to return (default: 20)
- `offset`: Number of records to skip (default: 0)

**Response Format**:
```json
{
  "quotations": [
    {
      "id": "101412",
      "quotation_number": "EC-BR-2026-0121",
      "referenceid": "RB-PH-765029",
      "sales_agent": "Angie Baldugo",
      "product_sku": "SPF-DSI-26-0411-001-R,SPF-DSI-26-0411-001-H",
      "product_quantity": "1,1",
      "product_amount": "1687.5,27875",
      "quotation_amount": "29562.50",
      "status": "Quote-Done",
      "date_created": "2026-08-20",
      "date_updated": "2026-09-14T01:03:31.943Z"
    }
  ],
  "total": 123,
  "limit": 20,
  "offset": 0,
  "hasMore": true
}
```

### 2. API Route: `/app/api/activity-history/route.ts`
**Purpose**: Fetches all history records for a specific activity reference number.

**Key Features**:
- Filters records by `activity_reference_number`
- Returns all history records ordered by `date_updated` (descending)
- Used by the "View History" dialog to show complete activity timeline

**Query Parameters**:
- `activityRef`: The activity reference number to fetch history for (required)

**Response Format**:
```json
{
  "history": [
    {
      "id": "112608",
      "activity_reference_number": "OF-NCR-5891410783",
      "type_activity": "Delivered / Closed Transaction",
      "quotation_number": null,
      "status": "Delivered",
      "so_status": "Convert to SI",
      "date_updated": "2026-09-08",
      "company_name": "OUR LADY OF FATIMA",
      ...
    }
  ],
  "total": 5
}
```

### 3. Page Component: `/app/spf-quotation-tracking/page.tsx`
**Purpose**: Displays SPF-DSI quotations in a grouped table with desktop and mobile views.

**Key Features**:
- Desktop table view with grouped rows
- Mobile card view for responsive design
- Infinite scroll pagination
- Refresh button to reload data
- Loading and error states
- SPF-DSI-only SKU display (non SPF-DSI codes are hidden)
- Excludes quotations from users in the IT department
- **Grouped Display**: Quotations are grouped by Activity Reference Number and Account Reference Number
- **Quotation Dropdown**: When multiple quotations share the same activity/account refs, a dropdown allows selection between quotation numbers
- **View History Button**: A "View History" button below each Activity Ref # opens a dialog showing all history records for that activity, including quotations, sales orders, deliveries, and other activity types
- Displays key information:
  - Activity Reference Number (grouping key)
  - Account Reference Number (grouping key)
  - Sales Agent (resolved from `referenceid` using `users` table)
  - Quotation Number (dropdown when multiple, single value when one)
  - Product SKU (SPF-DSI only with quantity and unit price in parentheses)
  - Quotation Amount (SPF) (total quotation amount)
  - Status
  - SO Status
  - Date Created
  - Date Updated

**Product SKU Display (`getSpfDsiSkusWithQtyAndAmount`)**:
A helper extracts only the `SPF-DSI-...` SKUs from the raw `product_sku` string using the regex `/SPF-DSI-[^\s,&()]+/gi` and pairs them with their corresponding quantities and unit prices from the `product_quantity` and `product_amount` fields. Duplicates are removed and multiple SKUs are joined with `, `. If no SPF-DSI SKU is found, `-` is shown.

**Clickable SKU Navigation**:
- Each SPF-DSI SKU displayed in the Product SKU column is now clickable
- When a user clicks on a SKU (e.g., `SPF-DSI-26-0438-002`), they are redirected to the Requests page (`/requests`)
- The SKU is automatically searched in the Requests page using the first 4 hyphen-separated parts (e.g., `SPF-DSI-26-0438`)
- The search query is stored in sessionStorage and applied to the search bar without modifying the URL
- This allows users to quickly find related SPF request records from the quotation tracking page
- The SKU is displayed in blue text with underline on hover to indicate it's clickable

| Raw `product_sku` | Raw `product_quantity` | Raw `product_amount` | Displayed |
|---|---|---|---|
| `PLL-12W-WW-028,SPF-DSI-26-0228-001-OPT-1,` | `10,5` | `1000,5000` | `SPF-DSI-26-0228-001-OPT-1 (Qty: 5) (P 5,000.00)` |
| `ASB-42W-DL-1159 (LPL42DL01 & SPF-DSI-26-0438-002)` | `2,3` | `2000,3000` | `SPF-DSI-26-0438-002 (Qty: 3) (P 3,000.00)` |
| `SPF-DSI-26-0454-001-A,ITL18DL01,TBL18DL01` | `1,5,10` | `1500,2000,2500` | `SPF-DSI-26-0454-001-A (Qty: 1) (P 1,500.00)` |

**Total Calculation (`calculateSpfDsiTotal`)**:
A helper function calculates the total value for SPF-DSI items by multiplying quantity × unit price for each SPF-DSI SKU and summing the results. This provides the total cost for all SPF-DSI products in a quotation.

|| Raw `product_sku` | Raw `product_quantity` | Raw `product_amount` | Total Displayed |
||---|---|---|---|
|| `PLL-12W-WW-028,SPF-DSI-26-0228-001-OPT-1,` | `10,5` | `1000,5000` | `₱35,000.00` (10×1000 + 5×5000) |
|| `ASB-42W-DL-1159 (LPL42DL01 & SPF-DSI-26-0438-002)` | `2,3` | `2000,3000` | `₱9,000.00` (2×2000 + 3×3000) |
|| `SPF-DSI-26-0454-001-A,ITL18DL01,TBL18DL01` | `1,5,10` | `1500,2000,2500` | `₱1,500.00` (1×1500 only SPF-DSI item) |

**Pagination**:
- Default page size: 30 records per page
- Infinite scroll with "load more" functionality
- KPI dashboard calculated from latest 1000 records
- Shows total count of quotation groups and individual quotations

**Data Fields Displayed**:
- `activity_reference_number`: Activity reference number (grouping key, with View History button)
- `account_reference_number`: Account reference number (grouping key)
- `sales_agent`: Sales agent name (resolved from `referenceid` by joining with `users` table)
- `quotation_number`: Unique quotation identifier (dropdown when multiple per group)
- `product_sku`: SPF-DSI product SKU (filtered for display with quantity and unit price)
- `product_quantity`: Comma-separated quantities for each product
- `product_amount`: Comma-separated unit prices for each product
- `quotation_amount`: Total quotation amount
- `status`: Current quotation status
- `so_status`: Sales order status
- `date_created`: Creation date (Asia/Manila timezone)
- `date_updated`: Last update date (Asia/Manila timezone)

**View History Dialog**:
When clicking "View History" on an activity reference number, a dialog opens showing all history records for that activity, including:
- Activity type (e.g., "Quotation Preparation", "Sales Order Preparation", "Delivered / Closed Transaction")
- Status
- Quotation number (if applicable)
- SO status (displayed in bold, uppercase, green)
- Date updated
- Company name (displayed in the dialog header)

**Filter Feature**:
The dialog includes a checkbox filter "Show only 'Convert to SI' records" that filters the displayed history to show only records where `so_status` equals "Convert to SI". This is useful for tracking which activities have sales orders that need to be converted to sales invoices.

## Database Schema

The feature queries the `history` table and joins with the `users` table. The following columns are relevant:

**history table (main query)**:
- `type_activity`: Must be 'Quotation Preparation'
- `product_sku`: Must contain 'SPF-DSI-'
- `product_quantity`: Comma-separated quantities for each product
- `product_amount`: Comma-separated unit prices for each product
- `referenceid`: Reference ID to resolve sales agent from users table
- `quotation_number`: Unique quotation identifier
- `quotation_amount`: Total quotation amount
- `status`: Current quotation status
- `date_created`: Creation date
- `date_updated`: Last update date

**users table (joined for sales agent name)**:
- `ReferenceID`: Matches history.referenceid
- `Firstname`: Sales agent first name
- `Lastname`: Sales agent last name

**Sales Agent Resolution**:
The API resolves the sales agent name by:
1. Extracting unique `referenceid` values from the fetched quotation records
2. Querying the `users` table for matching `ReferenceID` values
3. Combining `Firstname` and `Lastname` into a full name (e.g., "Angie Baldugo")
4. Adding the resolved name as `sales_agent` field in the response
5. If no match is found, displays "-"

## Usage

### Accessing the Page
Navigate to `/spf-quotation-tracking` in the application.

### API Endpoint
`GET /api/spf-dsi-quotations?limit=20&offset=0`

### Example Usage in Code
```typescript
const res = await fetch('/api/spf-dsi-quotations?limit=20&offset=0');
const data = await res.json();
console.log(data.quotations); // Array of quotation records
console.log(data.total);      // Total number of records
```

## Notes

- The API uses case-insensitive pattern matching (`ilike`) to find records containing SPF-DSI product SKUs
- Records with mixed SKUs are kept in the results; only the SPF-DSI SKUs are shown in the UI
- SPF-DSI SKUs are displayed with their corresponding quantities and unit prices in parentheses (e.g., "SPF-DSI-26-0468-001 (Qty: 5) (P 24,000.00)")
- Quantities and unit prices are extracted from the `product_quantity` and `product_amount` fields and matched by index to the SKU position in `product_sku`
- Sales agent names are resolved by joining with the `users` table using the `referenceid` field
- **IT department exclusion**: Quotations from users where `Department = 'IT'` are excluded from the results
- **Special case exclusions**: Specific ReferenceIDs may be excluded from the results (e.g., AE-NCR-555756, JC-NCR-245823)
- The `total` count and pagination are computed in the database, so they match the rows shown
- All dates are formatted in Asia/Manila timezone for display
- The page requires the "page:requests" access key (AccessGuard component)
- Monetary values are formatted as Philippine Peso (₱) with 2 decimal places
- The feature uses the existing Supabase client configuration from `@/utils/supabase`
- **Clickable SKU navigation**: Clicking on a Product SKU (e.g., `SPF-DSI-26-0438-002`) redirects to the Requests page and automatically searches for the base SKU (first 4 parts: `SPF-DSI-26-0438`)
- **Grouping behavior**: Quotations are grouped on the client side by `activity_reference_number` and `account_reference_number`. When multiple quotations share the same combination, they appear in a single row with a dropdown to select the quotation number. The first quotation's details (SKU, amount, status, dates) are displayed by default.
- **View History feature**: Clicking "View History" on an activity reference number fetches all history records for that activity from the `history` table and displays them in a dialog. This provides a complete timeline of the activity, including all quotations, sales orders, deliveries, and other interactions.

## Future Enhancements

Potential improvements for future iterations:
- Add search/filter functionality
- Add sorting by column
- Add export to Excel feature
- Add detailed view modal for each quotation
- Add real-time updates via Supabase subscriptions
- Add bulk actions (e.g., bulk status update)