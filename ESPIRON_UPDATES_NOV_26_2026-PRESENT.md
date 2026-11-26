# Espiron Updates: Nov 26, 2026–Present

## SPF logging status workflow

The `users.spf_logging_status` field tracks whether a user's Espiron session is online.

### Login

1. The login form sends credentials to `POST /api/login`.
2. The API validates the account, department, lock state, and password.
3. Only after successful authentication, it resets login attempts, activates the account, clears its lock, and sets `spf_logging_status` to `SPF_ONLINE`.
4. If the user update fails, login returns an error and does not issue a session cookie.

### Manual logout

1. The user selects **Log out** from the user menu.
2. The menu sends `POST /api/logout` with the current session cookie.
3. The API sets that user's `spf_logging_status` to `SPF_OFFLINE`, then expires the session cookie.
4. If updating the status fails, the API still expires the cookie and returns an error response.

### Forced logout

`GET /api/me` checks the current user's access. If the user's department is no longer allowed or the account is resigned, the API attempts to set `spf_logging_status` to `SPF_OFFLINE` and expires the session cookie. The client then redirects to login.

### Idle and active status

The app-wide status tracker watches the current authenticated session:

- After two minutes without activity in a focused, visible Espiron tab, it sets `spf_logging_status` to `SPF_IDLE`.
- Switching away from the tab, losing window focus, or hiding the page sets the status to `SPF_IDLE` immediately.
- Returning to the visible, focused tab or moving/clicking the mouse, typing, scrolling, or touching the page sets the status to `SPF_ONLINE` and restarts the two-minute timer.
- Status changes are sent to `POST /api/spf-logging-status`. The endpoint accepts only `SPF_ONLINE` and `SPF_IDLE` and uses the session cookie to identify the user.

### Active user avatars

After the splash screen, The global app shell displays an **Online Status:** badge with profile avatars in the top-right corner on desktop and in the mobile navigation drawer above the user profile. It lists users whose status is `SPF_ONLINE` or `SPF_IDLE`. Up to five avatars are shown; additional users are summarized as `+N`. Hovering the count opens a panel of the remaining avatars, and hovering an avatar shows the user's first and last name and current status. Online users appear at full opacity; idle users appear at 50% opacity. Offline users are omitted. Supabase Realtime updates the list immediately when user rows change; the authenticated `GET /api/spf-presence` endpoint refreshes the list on load and every 15 seconds as a fallback.

### Implementation

- Login: [`app/api/login/route.ts`](./app/api/login/route.ts)
- Manual logout: [`app/api/logout/route.ts`](./app/api/logout/route.ts)
- Session and forced-logout checks: [`app/api/me/route.ts`](./app/api/me/route.ts)
- Idle/active status API: [`app/api/spf-logging-status/route.ts`](./app/api/spf-logging-status/route.ts)
- App-wide activity tracker: [`components/spf-logging-status-tracker.tsx`](./components/spf-logging-status-tracker.tsx)
- Active users API: [`app/api/spf-presence/route.ts`](./app/api/spf-presence/route.ts)
- Profile presence avatars: [`components/spf-presence-avatars.tsx`](./components/spf-presence-avatars.tsx)
- User menu: [`components/nav-user.tsx`](./components/nav-user.tsx)
- Session context: [`contexts/UserContext.tsx`](./contexts/UserContext.tsx)
- Root layout: [`app/layout.tsx`](./app/layout.tsx)

**Note:** This status is stored on the user row, not per device or session. Logging out from one device sets the user's status to `SPF_OFFLINE` even if another session for that account remains active.
