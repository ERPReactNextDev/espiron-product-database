# SPF Pool Feature - PD Pool Completion, Queue Removal & Collaboration Hub Updates

## Overview
This repository (disruptive-product-database) represents the Product Development (PD) side of the SPF workflow. When PD completes the pool step, the SPF must be removed from the active pool queue and all remaining queued SPFs must receive updated queue numbers in their collaboration hubs.

Because PD screens commonly follow `spf_creation`, while the queue is calculated from `spf_request`, this feature bridges the two tables using `spf_number` as the shared identifier.

## Changes Made

### 1. For Pooling Button (PD Action)
**File:** `components/for-pooling-button.tsx`

When clicked:
- Calls a PD API endpoint to mark the SPF as pool finished (by `spf_number`)
- Triggers a system message in the collaboration hub for that SPF only:
  - `PROJECT STATUS: SPF SEND BY PD`

### 2. Finish Pool API (Bridge + Broadcast)
**File:** `pages/api/request/spf-request-finish-pool-api.ts`

#### Update spf_request by spf_number
- Sets `is_pool_finished = TRUE` on the `spf_request` table using `spf_number`
- This removes the SPF from the active pool queue (`is_pool_finished = FALSE`)

#### Broadcast Updated Queue Numbers
After finishing one SPF:
- Fetches all remaining SPFs in the pool:
  - `is_pool_finished = FALSE` and `for_pool_date IS NOT NULL`
  - Ordered by `for_pool_date` ascending (oldest = queue number `[1]`)
- Appends a system message to each SPF’s collaboration hub doc (`spf_creations/{spf_number}`) containing the updated queue number:
  - `PROJECT STATUS: YOUR SPF PROJECT HAS BEEN SENT TO Product Development (PD) Department. Pool Date: {shanghaiTime} (Asia/Shanghai). You are currently on queue number [{queueNumber}].`

#### PD Completion Message Styling
The PD completion message is tagged with `systemType: "pd_sent"` and rendered as a green system pill in the collaboration hub UI.

## How It Works

### Pool Completion Flow (PD)
1. PD user clicks **For Pooling** button
2. API receives `POST` request to `/api/request/spf-request-finish-pool-api` with `{ spf_number }`
3. `spf_request` row is updated:
   - `is_pool_finished = TRUE`
4. Collaboration hub system message is sent to the specific SPF only:
   - `PROJECT STATUS: SPF SEND BY PD`
5. Remaining pool queue is recomputed and rebroadcast:
   - All remaining SPFs in the pool receive an updated queue-number system message

## Notes
- `spf_number` is the bridge key between `spf_creation` and `spf_request`.
- Collaboration hub messages are written to Firebase Firestore `spf_creations/{spf_number}` so they appear across all repositories sharing the collaboration database.

