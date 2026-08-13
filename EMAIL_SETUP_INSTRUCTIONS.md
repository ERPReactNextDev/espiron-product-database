# Email Module Setup Instructions

## Status
✅ **Complete Structure**: All email components, pages, types, and basic API routes created.
⏳ **Remaining Tasks**: 
1. Copy complex API routes from taskflow
2. Add missing UI library imports
3. Update sidebar navigation
4. Add email page to navigation menu

## What's Been Created

### ✅ Components (`/components/email/`)
- `email-shell.tsx` - Main orchestrator (3-column layout)
- `add-account-form.tsx` - Email account setup with autodiscover
- `email-compose.tsx` - Compose window
- `email-folders-pane.tsx` - Folder/account switcher
- `email-message-list.tsx` - Message list with filters
- `email-reading-pane.tsx` - Message reader
- `manage-accounts.tsx` - Account management

### ✅ Page
- `/app/email/page.tsx` - Main email page with layout

### ✅ Types
- `/types/email.ts` - All TypeScript interfaces and error codes

### ✅ Utilities
- `/lib/email-imap.ts` - IMAP/SMTP helpers and autodiscover logic

### ✅ API Routes (Basic)
- `/app/api/email/accounts/route.ts` - CRUD operations for email accounts

### ⏳ API Routes (Needed from Taskflow)
Copy these from `taskflow-ai-demo/app/api/email/` to `espiron-product-database/app/api/email/`:

1. **proxy/route.ts** - Main email proxy (handles IMAP/SMTP operations)
   - Path: `/app/api/email/proxy/route.ts`
   - This is the largest file and handles all email operations

2. **company-search/route.ts** (optional - for CRM integration)
   - Path: `/app/api/email/company-search/route.ts`
   - Required if you want company linking features

3. **linked-activity/route.ts** (optional - for activity tracking)
   - Path: `/app/api/email/linked-activity/route.ts`
   - Required if you want email-to-activity linking

## Required Dependencies

Add to `package.json`:
```json
{
  "dependencies": {
    "imapflow": "^1.1.1",
    "nodemailer": "^6.9.7",
    "mailparser": "^3.6.8",
    "uuid": "^9.0.1",
    "date-fns": "^2.30.0",
    "date-fns-tz": "^2.0.0"
  }
}
```

## Database Schema

Ensure your Supabase has these tables:

### `email_accounts` table
```sql
CREATE TABLE email_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  email_address TEXT NOT NULL,
  password TEXT NOT NULL,
  provider TEXT,
  smtp_host TEXT,
  smtp_port INTEGER,
  smtp_encryption TEXT,
  smtp_username TEXT,
  imap_host TEXT,
  imap_port INTEGER,
  imap_encryption TEXT,
  imap_username TEXT,
  signature TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
```

## UI Library Requirements

Ensure you have these UI components from your design system:
- `Dialog` / `DialogContent` / `DialogHeader` / `DialogTitle`
- `Button`
- `Input`
- `Badge`

These are referenced in `email-quotation-dialog.tsx` (optional CRM feature).

## Next Steps

1. **Copy API Routes**
   - Copy `proxy/route.ts` from taskflow to handle all email operations
   - Optionally copy `company-search/route.ts` and `linked-activity/route.ts` for CRM features

2. **Update Navigation**
   - Add email link to sidebar (`/components/sidebar-left.tsx`)
   - Add to navigation menu

3. **Install Dependencies**
   ```bash
   npm install imapflow nodemailer mailparser uuid date-fns date-fns-tz
   ```

4. **Test**
   - Navigate to `/email`
   - Add an email account
   - Verify IMAP/SMTP connection
   - Load folders and messages

## Architecture Notes

### 3-Column Outlook-style Layout
- **Column 1 (260px)**: Folder pane with account switcher
- **Column 2 (380px)**: Message list with filters
- **Column 3 (flex)**: Reading pane (messages/empty state)
- **Mobile**: Sliding panels that replace each other

### Email Operations
All email operations go through `/api/email/proxy` which handles:
- Autodiscover (IMAP + SMTP)
- List folders
- List messages with filters (all, unread, flagged, attachments)
- Get full message with HTML parsing
- Send email
- Update flags (read, flag, delete, move)
- Download attachments

### Error Handling
- Auth failures → suggest cPanel password check
- Connection timeouts → suggest firewall/port issues
- SSL errors → suggest AutoSSL
- Port blocked → suggest IT contact

### Keyboard Shortcuts
- `N` - New email
- `R` - Reply
- `A` - Reply all
- `F` - Forward
- `Delete` - Delete message
- `/` - Search (focuses search input)

## Customization

### Styling
All components use Tailwind CSS classes. Adjust colors/spacing as needed.

### Time Zone
Default is "Asia/Manila" in email date formatting. Change in:
- `email-reading-pane.tsx` line: `const TZ = "Asia/Manila";`
- `email-message-list.tsx` line: `const TZ = "Asia/Manila";`

### CRM Integration (Optional)
If you have the CRM-related tables, uncomment/enable:
- `email-quotation-dialog.tsx` - Creates activities from emails
- `email-reading-pane.tsx` - Shows linked activities and quotations

## Troubleshooting

### "Cannot find module 'imapflow'"
- Run: `npm install imapflow nodemailer mailparser date-fns date-fns-tz`

### "account_id and user_id required"
- Ensure EmailShell properly loads accounts before trying operations

### Empty inbox
- Check IMAP connection in Manage Accounts
- Verify email password is correct
- Check if IMAP is enabled in cPanel

### Attachments not downloading
- Verify `get-attachment` proxy function is working
- Check browser console for errors
- Ensure temp file permissions on server

---

**Last updated**: August 13, 2026
**Source**: Ported from taskflow-ai-demo email module
