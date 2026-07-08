# SPF Revision Approval Workflow

## Overview
This document describes the revision approval workflow for SPF (Special Product Form) requests in the espiron-product-database repository. When a revision is requested, the changes are stored in a separate table (`spf_request_revision`) for approval before being applied to the main `spf_request` table.

## Workflow

### 1. Request Revision (Taskflow Repository)
**Location:** `Taskflow/pages/api/activity/tsa/spf/request-revision.ts`

When a user clicks "Request Revision" on an SPF:

1. The API fetches the current `spf_creation.status` to save it as `previous_status`

2. The revision data is inserted into `spf_request_revision` table with:
   - `spf_revision_approval_sales_status`: "Ongoing"
   - `spf_revision_approval_sales_date`: Current timestamp
   - All other fields from the edited request data

3. The revision data is also inserted into `spf_request_revision_history` table for tracking with:
   - `revision_number`: Auto-incremented bigint (fetches the highest existing revision number for this `spf_number` and increments by 1, starting from 1 if no history exists; supports unlimited revisions up to 9,223,372,036,854,775,807)
   - `revision_result`: "Requested By {Department}" (where {Department} is fetched from the users table based on the current user's session)
   - `revision_date`: Current timestamp
   - `spf_revision_remarks_sales`: The remarks from the revision request (also saved to `spf_request.remarks`)
   - All other fields from the revision data (excluding `id` to avoid unique constraint violation)

4. The `spf_creation` table is updated with:
   - `status`: "Processing by PD"
   - `previous_status`: The original status before the revision (e.g., "For Revision", NULL, etc.)
   - `spf_revision_approval_sales_status`: "Ongoing"
   - `date_updated`: Current timestamp

5. A system message "Revision is Being Processed By PD" is sent to the collaboration hub for the specific SPF.

**Important:** The `previous_status` field stores the original status before the revision was requested. This allows the system to restore the original status if the revision is rejected.

### 2. View Revision Status (Espiron Repository)
**Location:** `espiron-product-database/components/spf-request-fetch.tsx`

When viewing an SPF in the requests page:

- A **View** button is always shown
- If `spf_creation.status` is "Processing by PD", clicking View opens the **Revision Comparison Dialog**
- The status badge displays "Processing by PD" in blue
- The **Create** button is hidden when status is "Processing by PD"

### 3. Revision Comparison Dialog
**Location:** `espiron-product-database/components/revision-comparison-dialog.tsx`

When the View button is clicked on an SPF with "Processing by PD" status:

1. The dialog fetches data from three sources:
   - **Old (Current)**: Data from `spf_request` table
   - **New (Proposed)**: Data from `spf_request_revision` table with "Ongoing" status
   - **Previous Remarks**: Fetches `spf_revision_remarks_sales` and `spf_revision_remarks_engineering` from the latest `spf_request_revision_history` record

2. The dialog displays a side-by-side comparison of all fields:
   - Field name
   - Old value
   - New value (highlighted in green if changed)

3. Special handling for image fields:
   - If the value contains comma-separated Cloudinary URLs, all images are displayed as thumbnails
   - Each image is clickable and opens in a new tab

4. Two action buttons are provided:
   - **Approve** (green): Applies the revision changes
   - **Reject** (red): Rejects the revision

5. On approve/reject, the dialog:
   - Passes the previous `spf_revision_remarks_sales` and `spf_revision_remarks_engineering` to the API
   - Calls the refresh callback to update the table data without full page reload

### 4. Approve Revision
**Location:** `espiron-product-database/pages/api/request/spf-request-revision-approve-api.ts`

When the Approve button is clicked:

1. Fetch the revision data from `spf_request_revision` where:
   - `spf_number` matches
   - `spf_revision_approval_sales_status` = "Ongoing"

2. Apply the revision data to `spf_request` table:
   - All fields from revision are copied (except revision-specific fields and status)
   - **Important:** The `status` field in `spf_request` is NOT modified - it remains unchanged
   - `date_updated` is set to current timestamp

3. Update `spf_creation` status to "For Revision":
   - `status`: "For Revision" (reverts from Processing by PD)
   - `previous_status`: NULL (cleared after approval)
   - `spf_revision_approval_sales_status`: NULL
   - `spf_revision_approval_sales_date`: NULL
   - `date_updated`: Current timestamp

4. Insert into `spf_request_revision_history` table for tracking with:
   - `revision_number`: Auto-incremented bigint (fetches the highest existing revision number for this `spf_number` and increments by 1, starting from 1 if no history exists; supports unlimited revisions up to 9,223,372,036,854,775,807)
   - `revision_result`: "Approved By {Department}" (where {Department} is fetched from the users table based on the current user's session)
   - `revision_date`: Current timestamp
   - `spf_revision_remarks_sales`: The previous sales remarks from the revision history (preserved across revisions)
   - `spf_revision_remarks_engineering`: The previous engineering remarks from the revision history (preserved across revisions)
   - All other fields from the revision data (excluding `id` to avoid unique constraint violation)

5. **Delete** the revision record from `spf_request_revision` table:
   - Deletes the specific record identified by `spf_number` and `spf_revision_approval_sales_status = "Ongoing"`
   - This ensures the revision record is removed after approval

6. **Broadcast to Collaboration Hub:**
   - Sends a system message to Firebase Firestore
   - Document path: `spf_creations/{spf_number}`
   - Message format: "REVISION APPROVED BY {DEPARTMENT}"
   - Message is marked as `isSystem: true` for special styling
   - Firebase failures are logged but don't fail the API request

### 5. Reject Revision
**Location:** `espiron-product-database/pages/api/request/spf-request-revision-reject-api.ts`

When the Reject button is clicked:

1. Fetch current `spf_creation.status` and `previous_status` to determine behavior

2. Fetch the revision data from `spf_request_revision` for history tracking

3. Handle `spf_creation` based on `previous_status`:
   - **If `previous_status` is NULL:** Delete the entire `spf_creation` record for this `spf_number`
   - **If `previous_status` exists:** Restore it to `status` and clear `previous_status`
     - `status`: Restored from `previous_status`
     - `previous_status`: NULL (cleared after restoring)
     - `spf_revision_approval_sales_status`: "Rejected"
     - `spf_revision_approval_sales_date`: Current timestamp
     - `date_updated`: Current timestamp

4. Insert into `spf_request_revision_history` table for tracking with:
   - `revision_number`: Auto-incremented bigint (fetches the highest existing revision number for this `spf_number` and increments by 1, starting from 1 if no history exists; supports unlimited revisions up to 9,223,372,036,854,775,807)
   - `revision_result`: "Rejected By {Department}" (where {Department} is fetched from the users table based on the current user's session)
   - `revision_date`: Current timestamp
   - `spf_revision_remarks_sales`: The previous sales remarks from the revision history (preserved across revisions)
   - `spf_revision_remarks_engineering`: The previous engineering remarks from the revision history (preserved across revisions)
   - All other fields from the revision data (excluding `id` to avoid unique constraint violation)

5. **Important:** The `spf_request` table is NOT modified - original data remains unchanged

6. **Delete** the revision record from `spf_request_revision` table:
   - Deletes the specific record identified by `spf_number` and `spf_revision_approval_sales_status = "Ongoing"`
   - This ensures the revision record is removed after rejection

7. **Broadcast to Collaboration Hub:**
   - Sends a system message to Firebase Firestore
   - Document path: `spf_creations/{spf_number}`
   - Message format: "REVISION REJECTED BY {DEPARTMENT}"
   - Message is marked as `isSystem: true` for special styling
   - Firebase failures are logged but don't fail the API request

### 6. Request Revision for Procurement
**Location:** `espiron-product-database/pages/api/request/spf-request-procurement-revision-api.ts`

When the "Request Revision for Procurement" button is clicked (only visible when status is "Approved By Procurement" or "Pending For Procurement"):

1. Fetch the latest `spf_request` data for the given `spf_number`

2. Get the next revision number for this `spf_number` from `spf_request_revision_history`:
   - Fetches the highest existing revision number and increments by 1
   - Starts at 1 if no history exists

3. Insert into `spf_request_revision_history` table for tracking with:
   - All fields from the latest `spf_request` record (excluding `id` to avoid unique constraint violation)
   - `date_created`: Current timestamp
   - `date_updated`: Current timestamp
   - `spf_revision_approval_sales_status`: "Ongoing"
   - `spf_revision_approval_sales_date`: Current timestamp
   - `revision_number`: Auto-incremented bigint
   - `revision_result`: "Requested By Engineering"
   - `revision_date`: Current timestamp

4. **Important:** The `spf_request` table is NOT modified - original data remains unchanged
5. **Important:** The `spf_creation` table is NOT modified - status remains unchanged

This workflow allows Engineering to request revisions for Procurement without modifying the main request data until approved.

### 7. Button State Management for Procurement Revision
**Location:** `espiron-product-database/components/spf-request-fetch.tsx`

The "Request Revision for Procurement" button has dynamic behavior based on the latest revision result:

1. **Fetch Latest Revision Result:**
   - When the dialog opens, the component fetches the latest `revision_result` from `spf_request_revision_history` for the current `spf_number`
   - Uses the highest `revision_number` to determine the latest result

2. **Button Display Logic:**
   - If the latest `revision_result` is "Requested By Engineering":
     - Button is **disabled** (cannot be clicked)
     - Button text changes to "Request Revision sent to Procurement"
   - If the latest `revision_result` is anything else or no revision exists:
     - Button is **enabled**
     - Button text shows "Request Revision for Procurement"

3. **Purpose:** This prevents duplicate revision requests and provides visual feedback that a revision request has already been sent to Procurement.

### 8. Status Column Display for "Requested By Engineering"
**Location:** `espiron-product-database/app/requests/page.tsx`

The requests page status column displays the latest revision result when applicable:

1. **Fetch Latest Revision Results:**
   - On page load, fetches all latest revision results for visible SPF numbers
   - Stores results in a map keyed by `spf_number`
   - Uses the highest `revision_number` for each SPF to determine the latest result

2. **Status Badge Logic:**
   - If the latest `revision_result` for an SPF is "Requested By Engineering":
     - Status badge displays "Requested By Engineering" in cyan color (bg-cyan-100 text-cyan-700)
   - Otherwise, displays the normal `spf_creation.status` with existing color coding

3. **Purpose:** Provides immediate visibility into which SPFs have pending revision requests from Engineering to Procurement.

### 9. Engineering Revision Approval/Rejection (Engineer-Ticketing Repository)
**Location:** `engineer-ticketing/app/request/product/[id]/page.tsx`

When viewing an SPF in the engineer-ticketing repository:

1. **Fetch Latest Revision:**
   - On page load, the component fetches the latest revision from `spf_request_revision_history` for the current SPF number
   - Uses the highest `revision_number` to determine the latest revision
   - Only sets `latestRevision` state if the `revision_result` starts with "Requested By" (indicating a pending approval)

2. **Revision Approval Banner:**
   - If a pending revision is found, a banner is displayed showing:
     - Revision result (e.g., "Requested By Procurement")
     - Revision number and date
     - Two action buttons: **Approve** (green) and **Reject** (red)

3. **Approval Dialog:**
   - Clicking Approve opens a confirmation dialog: "Approve Revision by Engineering?"
   - Dialog shows revision details and explains that this will update SPF status to "For Revision by PD"
   - User can confirm or cancel

4. **Rejection Dialog:**
   - Clicking Reject opens a confirmation dialog: "Reject Revision by Engineering?"
   - Dialog shows revision details and explains that this will revert the SPF to its previous state
   - User can confirm or cancel

5. **Purpose:** Allows Engineering department to approve or reject revision requests from other departments (e.g., Procurement) directly from the engineer-ticketing interface.

### 10. Engineering Revision Approval API
**Location:** `engineer-ticketing/pages/api/request/spf-request-engineering-revision-approve-api.ts`

When the Approve button is confirmed:

1. Fetch the latest revision history record for the given `spf_number` from `spf_request_revision_history`

2. Get the next revision number by incrementing the latest revision number

3. Prepare data for new revision history record:
   - Exclude `id`, `date_created`, `date_updated`, `spf_revision_approval_sales_status`, `spf_revision_approval_sales_date`, `revision_number`, `revision_result`, `revision_date`
   - Keep all other fields from the latest revision

4. Insert new record into `spf_request_revision_history` with:
   - All fields from the latest revision (excluding the excluded fields)
   - `date_created`: Current timestamp
   - `date_updated`: Current timestamp
   - `spf_revision_approval_sales_status`: "Ongoing"
   - `spf_revision_approval_sales_date`: Current timestamp
   - `revision_number`: Auto-incremented
   - `revision_result`: "Request Approved By {Department}" (where {Department} is fetched from the users table based on the current user's session)
   - `revision_date`: Current timestamp

5. Update `spf_creation` status to "For Revision by PD":
   - `status`: "For Revision by PD"
   - `date_updated`: Current timestamp

6. **Broadcast to Collaboration Hub:**
   - Sends a system message to Firebase Firestore
   - Document path: `spf_creations/{spf_number}`
   - Message format: "REVISION APPROVED BY {DEPARTMENT}"
   - Message is marked as `isSystem: true` for special styling
   - Firebase failures are logged but don't fail the API request

7. **Important:** The `spf_request` table is NOT modified
8. **Important:** The SQL structure is kept as-is (no modifications)

### 11. Engineering Revision Rejection API
**Location:** `engineer-ticketing/pages/api/request/spf-request-engineering-revision-reject-api.ts`

When the Reject button is confirmed:

1. Fetch current `spf_creation.status` and `previous_status` to determine behavior

2. Fetch the latest revision history record for the given `spf_number` from `spf_request_revision_history`

3. Get the next revision number by incrementing the latest revision number

4. Prepare data for new revision history record:
   - Exclude `id`, `date_created`, `date_updated`, `spf_revision_approval_sales_status`, `spf_revision_approval_sales_date`, `revision_number`, `revision_result`, `revision_date`
   - Keep all other fields from the latest revision

5. Insert new record into `spf_request_revision_history` with:
   - All fields from the latest revision (excluding the excluded fields)
   - `date_created`: Current timestamp
   - `date_updated`: Current timestamp
   - `spf_revision_approval_sales_status`: "Rejected"
   - `spf_revision_approval_sales_date`: Current timestamp
   - `revision_number`: Auto-incremented
   - `revision_result`: "Request Rejected By {Department}" (where {Department} is fetched from the users table based on the current user's session)
   - `revision_date`: Current timestamp

6. Revert `spf_creation` to previous status:
   - If `previous_status` exists: restore it to `status` and clear `previous_status`
     - `status`: Restored from `previous_status`
     - `previous_status`: NULL
     - `date_updated`: Current timestamp
   - If `previous_status` is NULL: no changes to status

7. **Broadcast to Collaboration Hub:**
   - Sends a system message to Firebase Firestore
   - Document path: `spf_creations/{spf_number}`
   - Message format: "REVISION REJECTED BY {DEPARTMENT}"
   - Message is marked as `isSystem: true` for special styling
   - Firebase failures are logged but don't fail the API request

8. **Important:** The `spf_request` table is NOT modified - original data remains unchanged
9. **Important:** The SQL structure is kept as-is (no modifications)

## Database Schema

### spf_request_revision Table
This table stores pending revision requests awaiting approval.

**Key Fields:**
- `spf_number`: Identifier linking to the SPF
- `spf_revision_approval_sales_status`: "Ongoing", "Approved", or "Rejected"
- `spf_revision_approval_sales_date`: Timestamp of approval/rejection
- All other fields mirror `spf_request` structure (customer details, contact info, etc.)

### spf_request_revision_history Table
This table stores a permanent history of all revision requests for audit and tracking purposes.

**Key Fields:**
- `spf_number`: Identifier linking to the SPF
- `revision_number`: Auto-incremented bigint revision sequence number (starts at 1, increments for each new revision action; supports unlimited revisions up to 9,223,372,036,854,775,807)
- `revision_result`: "Requested By {Department}", "Approved By {Department}", or "Rejected By {Department}" (where {Department} is fetched from the users table based on the current user's session)
- `revision_date`: Timestamp when the revision result was recorded
- `spf_revision_remarks_sales`: Sales remarks from the revision request (preserved across revision cycles)
- `spf_revision_remarks_engineering`: Engineering remarks from the revision request (preserved across revision cycles)
- All other fields mirror `spf_request` structure (customer details, contact info, etc.)

**Important:** Records are added to this table at three points:
1. When a revision is requested (`revision_result`: "Requested")
2. When a revision is approved (`revision_result`: "Approved")
3. When a revision is rejected (`revision_result`: "Rejected")

**Auto-increment Logic:** The `revision_number` (bigint type) is automatically calculated by fetching the highest existing revision number for a given `spf_number` from the history table and incrementing it by 1. If no history exists, it starts at 1. This allows multiple revision cycles for the same SPF to be tracked sequentially with unlimited capacity (up to 9,223,372,036,854,775,807).

### spf_creation Table
**Key Fields for Revision Workflow:**
- `status`: Can be "Processing by PD" during revision approval
- `previous_status`: Stores the original status before revision request (e.g., "For Revision", NULL, etc.)
- `spf_revision_approval_sales_status`: Tracks revision approval status
- `spf_revision_approval_sales_date`: Timestamp of revision approval/rejection

### spf_request Table
The main request table that receives approved revision changes.

## Status Flow

```
[Any Status]
        ↓
[Request Revision clicked]
        ↓
Processing by PD (previous_status saved, spf_revision_approval_sales_status: Ongoing)
        ↓
[View clicked] → Opens Revision Comparison Dialog
        ↓
[Approve clicked] → Applied to spf_request (status unchanged) → spf_creation: "For Revision" (previous_status cleared) → Revision record deleted
        ↓
[Reject clicked] → spf_request unchanged → spf_creation: if previous_status exists → restore status & clear previous_status; if previous_status is NULL → delete spf_creation record → Revision record deleted
```

## UI Features

### 1. Success Dialog After Request Revision (Taskflow)
**Location:** `Taskflow/components/roles/tsa/activity/spf/dialog/revision-dialog.tsx`

When a user successfully requests a revision in Taskflow:
- A success dialog appears with the message "Revision is Being Processed by PD..."
- The dialog displays a refresh icon and a close button
- This provides immediate feedback that the revision request was submitted

### 2. Latest Revision Status Column (Taskflow)
**Location:** `Taskflow/components/roles/tsa/activity/spf/request-spf.tsx`

The SPF requests table now includes a "Latest Revision Status" column that:
- Fetches the latest revision result from `spf_request_revision_history` for each SPF
- Displays the revision status with color-coded badges:
  - **Requested** (Amber): Revision has been requested and is pending
  - **Rejected** (Red): Revision was rejected
  - **Approved** (Green): Revision was approved
- Shows "—" if no revision history exists
- Uses the API endpoint `/api/activity/tsa/spf/fetch-latest-revision` to fetch data

### 3. Request Revision Button Disable Logic (Taskflow)
**Location:** `Taskflow/components/roles/tsa/activity/spf/request-spf.tsx`

The "Request Revision" button is disabled based on the latest revision result from `spf_request_revision_history`:
- The component fetches the latest revision results for all visible SPF requests every 5 seconds
- The button is disabled if the latest revision result is:
  1. "Requested By Engineering"
  2. "Request Approved By Procurement"
  3. "Request Rejected By Procurement"
- This prevents duplicate revision requests and provides visual feedback that a revision request is already in progress or has been processed
- The button remains enabled if no revision history exists or if the latest revision result is different from the above cases

### 4. Global Revision Notification Dialog (Taskflow)
**Location:** `Taskflow/components/revision-notification-dialog.tsx`

A global dialog that appears across all Taskflow pages when new revisions are detected:
- Checks for new revisions every 30 seconds
- Shows revisions with status "Requested", "Rejected", or "Approved"
- Displays SPF number, revision result, and timestamp
- Uses localStorage to persist dismissed revisions
- Dismissed revisions won't show the dialog again until a new revision occurs
- The dialog persists until the user clicks "OK" to dismiss it

**LocalStorage Key:** `dismissed_revisions`
- Stores an array of dismissed revision identifiers in format: `{spf_number}-{revision_result}-{revision_date}`
- Prevents the same revision notification from appearing multiple times

## API Endpoints

### 1. Request Revision (Taskflow)
- **Endpoint:** `PUT /api/activity/tsa/spf/request-revision`
- **Repository:** Taskflow
- **Purpose:** Initiates revision workflow and stores data for approval

### 2. Approve Revision (Espiron)
- **Endpoint:** `PUT /api/request/spf-request-revision-approve-api`
- **Repository:** espiron-product-database
- **Purpose:** Applies approved revision changes to main request and deletes revision record

### 3. Reject Revision (Espiron)
- **Endpoint:** `PUT /api/request/spf-request-revision-reject-api`
- **Repository:** espiron-product-database
- **Purpose:** Rejects revision, preserves spf_creation.status, and deletes revision record

### 4. Request Revision for Procurement (Espiron)
- **Endpoint:** `PUT /api/request/spf-request-procurement-revision-api`
- **Repository:** espiron-product-database
- **Purpose:** Creates a revision history record for Engineering to request procurement revision
- **UI:** Shows "Request Revision for Procurement" button when status is "Approved By Procurement" or "Pending For Procurement"
- **Confirmation:** Uses custom AlertDialog with message "Are you sure you want to request revision for procurement?"

### 5. Fetch Latest Revision (Taskflow)
- **Endpoint:** `GET /api/activity/tsa/spf/fetch-latest-revision`
- **Repository:** Taskflow
- **Purpose:** Fetches the latest revision status for a specific SPF from history table
- **Query Parameters:**
  - `spf_number`: The SPF number to fetch revision status for
- **Response:** Returns the latest revision record with `revision_result` and `revision_date`

### 6. Engineering Revision Approval (Engineer-Ticketing)
- **Endpoint:** `PUT /api/request/spf-request-engineering-revision-approve-api`
- **Repository:** engineer-ticketing
- **Purpose:** Approves a revision request from Engineering and updates SPF status to "For Revision by PD"
- **Request Body:**
  - `spf_number`: The SPF number to approve revision for
- **Response:** Returns success message and creates new revision history record

### 7. Engineering Revision Rejection (Engineer-Ticketing)
- **Endpoint:** `PUT /api/request/spf-request-engineering-revision-reject-api`
- **Repository:** engineer-ticketing
- **Purpose:** Rejects a revision request from Engineering and reverts SPF to previous status
- **Request Body:**
  - `spf_number`: The SPF number to reject revision for
- **Response:** Returns success message and creates new revision history record

## UI Changes

### SPFRequestFetch Component
- Conditional rendering of Approve/Reject buttons when status is "Processing by PD"
- Status badge styling for "Processing by PD" (blue color)
- Toast notifications for approval/rejection actions
- Auto-refresh after approval/rejection

## Important Notes

1. **Cross-Repository Workflow:** The revision request originates in Taskflow repository, but approval/rejection happens in espiron-product-database repository.

2. **Data Isolation:** Revision data is stored separately until approved, preventing accidental changes to production data.

3. **Status Tracking:** Both `spf_creation` and `spf_request_revision` tables track the approval status for audit purposes.

4. **Rollback Capability:** Rejected revisions leave the original `spf_request` data intact.

5. **Collaboration Hub:** System messages are sent to keep stakeholders informed of revision status.

## Testing Checklist

- [ ] Request Revision on "Approved By Sales Head" SPF creates revision record
- [ ] spf_creation status changes to "Processing by PD"
- [ ] Approve button appears when status is "Processing by PD"
- [ ] Reject button appears when status is "Processing by PD"
- [ ] Approve applies changes to spf_request correctly
- [ ] Approve clears spf_creation status to NULL
- [ ] Reject reverts spf_creation to "Approved By Sales Head"
- [ ] Reject does not modify spf_request data
- [ ] Toast notifications display correctly
- [ ] Page refreshes after approval/rejection

## Related Files

### Taskflow Repository
- `pages/api/activity/tsa/spf/request-revision.ts` - Revision request API

### Espiron Repository
- `pages/api/request/spf-request-revision-approve-api.ts` - Approval API
- `pages/api/request/spf-request-revision-reject-api.ts` - Rejection API
- `components/spf-request-fetch.tsx` - UI component that opens comparison dialog
- `components/revision-comparison-dialog.tsx` - Comparison dialog with Approve/Reject buttons
- `app/requests/page.tsx` - Requests page that displays SPF list
