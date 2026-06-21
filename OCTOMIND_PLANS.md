# Octomind Implementation Plan

## Current Baseline

- Supabase PostgreSQL and the initial Prisma migration are configured.
- Auth.js Google login and Google Classroom OAuth scopes are implemented.
- The developer account has been added as a Google OAuth test user.
- Authenticated event and task persistence, Gemini estimation, task scheduling,
  and manual Google Classroom synchronization have initial implementations.
- The remaining work below is required before the application is production-ready.

## Initial Two-Developer Sprint

### Developer 1: Authenticated Application Boundary

**State:** Integrated

**Ownership:**

- `src/app/page.tsx`
- New authenticated calendar route under `src/app/calendar`
- `src/modules/auth/auth-controls.tsx`
- `src/modules/components/calendar/calendar.tsx`
- Focused tests for signed-out, signed-in, and empty-calendar rendering

**Deliverables:**

1. Signed-out users see the Octomind hero and Google sign-in action only.
2. Signed-in users are redirected to the protected calendar route.
3. The protected calendar route redirects unauthenticated users to `/`.
4. Authenticated calendar rendering always uses persisted Prisma data.
5. New users see a genuinely empty calendar, never mock events or tasks.

**Merge gate:** Focused tests, full test suite, type check, production build, and
proof that no authenticated runtime path imports mock calendar data.

### Developer 2: Persistence and API Security

**State:** Integrated

**Ownership:**

- `src/modules/persistence/calendar-repository.ts`
- `src/modules/api/calendar-schemas.ts`
- Event and task API routes under `src/app/api`
- `src/modules/api/auth.ts`
- Focused API and repository security tests

**Deliverables:**

1. POST routes ignore client IDs and generate UUIDs server-side.
2. Route IDs are validated before repository access.
3. Every update and delete verifies record ownership.
4. Task upserts cannot update another user's record by UUID.
5. API errors are typed, sanitized, and mapped to appropriate status codes.
6. Failed scheduling remains transactional and persists no partial task data.

**Merge gate:** Cross-user denial tests, unauthenticated tests, failed-schedule
rollback evidence, full test suite, type check, production build, and security
review of every changed write path.

### Chief of Staff Integration Gate

1. Keep both write sets disjoint and track any requested cross-lane changes.
2. Review Developer 1 first because it defines the runtime auth boundary.
3. Review Developer 2's ownership and error behavior before integration.
4. Run the combined test suite, type check, and production build after both
   handoffs.
5. Browser-check the signed-out hero, authenticated empty calendar, task/event
   creation, rejection behavior, and logout.
6. Move the sprint to complete only after both merge gates pass together.

### Initial Sprint Integration Result

- Developer 1 and Developer 2 changes are integrated in the shared workspace.
- The default `pnpm test` command now includes core, auth-boundary, and security
  suites: 49 tests pass.
- Type checking and the production build pass.
- Browser QA confirms the signed-out hero, protected `/calendar` redirect, and
  Google OAuth entry with the expected callback and Classroom scopes.
- Authenticated calendar CRUD still requires a completed interactive Google
  sign-in smoke test; browser automation stopped when control of the Google flow
  passed back to the user.

## Phase 1: Authenticated Application Boundary

### Files

- `src/app/page.tsx`
- New `src/app/calendar/page.tsx`
- `src/modules/auth/auth-controls.tsx`
- `src/modules/components/calendar/calendar.tsx`

### Changes

1. Make `/` the signed-out Octomind hero with a Google sign-in action.
2. Redirect signed-in users from `/` to `/calendar`.
3. Protect `/calendar` with a server-side session check.
4. Set the Google login callback to `/calendar`.
5. Remove the mock fallback from the production `Calendar` component.
6. Load authenticated calendar data exclusively from Prisma.
7. Show an empty persisted calendar for newly created users.
8. Keep mock data available only to tests, stories, or an explicitly enabled
   development demo.

### Acceptance Criteria

- Signed-out users never receive or render calendar data.
- Signed-in users never import mock calendar data or mock request helpers.
- A newly created account has zero events and tasks.

## Phase 2: Persistence and API Security

### Files

- `src/modules/persistence/calendar-repository.ts`
- `src/modules/api/calendar-schemas.ts`
- Event and task API routes under `src/app/api`
- `src/modules/api/auth.ts`

### Changes

1. Generate IDs server-side for all create requests.
2. Ignore client-provided IDs on POST requests.
3. Validate route IDs as UUIDs.
4. Verify ownership before every event or task update and deletion.
5. Replace task ID-only upserts with ownership-scoped operations.
6. Add typed unauthorized, not-found, validation, and scheduling errors.
7. Return sanitized `400`, `401`, `404`, `409`, and `500` responses.
8. Preserve transactional task and task-block persistence.

### Acceptance Criteria

- User A cannot read, modify, or delete User B's records.
- Failed scheduling leaves tasks and task blocks unchanged.
- Database details and stack traces are never returned to the browser.

## Phase 3: Google Classroom Lifecycle

### Database Changes

- Add `stale` and `staleSince` fields to `ExternalItemMapping`.
- Add any connection or disconnection metadata required by the UI.
- Create and apply a forward-only Prisma migration.

### UI Changes

- Replace the single sync button with a Classroom settings panel.
- Display the connected account, connection health, last sync, and errors.
- Add Sync, Reconnect, and Disconnect controls.

### Backend Changes

1. Add `DELETE /api/integrations/google-classroom`.
2. Reconnect through Google OAuth with `prompt=consent`.
3. Mark the connection unhealthy whenever token refresh fails.
4. Record a timestamp at the beginning of each sync.
5. Mark observed mappings active and update `lastSeenAt`.
6. Mark unobserved mappings stale without deleting their local tasks.
7. Continue processing other assignments when one assignment cannot be
   scheduled.
8. Return imported, updated, skipped, stale, and failed counts.

### Acceptance Criteria

- Repeated syncs do not create duplicate tasks.
- Revoked Google access produces a clear reconnect action.
- Coursework removed from Classroom remains local but is marked stale.

## Phase 4: Shared Rate Limiting

### Changes

1. Add a database-backed rate-limit bucket model.
2. Implement atomic per-user and per-IP limits.
3. Apply independent limits to Classroom synchronization and Gemini estimates.
4. Add cleanup for expired rate-limit buckets.
5. Trust forwarded IP headers only when requests come through the configured
   deployment proxy.

### Acceptance Criteria

- Limits work across multiple Next.js processes or serverless instances.
- Changing IP addresses does not bypass the per-user limit.
- Users sharing an IP address do not share a single user quota.

## Phase 5: Test Suite

### Unit Tests

- Signed-out hero and authenticated-route rendering.
- Empty persisted calendar behavior.
- API error mapping and ownership checks.
- Stale Classroom mappings and revoked-token handling.
- Scheduler correctness and feasibility-oracle comparisons.

### API Tests

- Unauthenticated request rejection.
- Invalid UUID rejection.
- Cross-user access denial.
- Classroom status, synchronization, reconnect, and disconnect behavior.

### Database Integration Tests

- A task and all of its blocks commit together.
- An impossible schedule rolls back completely.
- Duplicate Classroom synchronization remains idempotent.
- Concurrent requests cannot reserve overlapping task slots.

Use an isolated `TEST_DATABASE_URL`. Destructive tests must never run against
the development or production Supabase database.

### End-to-End Tests

1. A signed-out user sees the Octomind hero and no calendar.
2. An authenticated new user sees an empty calendar.
3. The user creates and deletes an event.
4. The user creates and deletes a task.
5. The user synchronizes Classroom assignments.
6. The UI presents a reconnect state after simulated token revocation.

Add coverage reporting and enforce a minimum of 80 percent coverage.

## Task Scheduling Correctness Gate

A task may be blocked only when no policy-compliant schedule exists between
the current time and its deadline. A policy-compliant schedule is within the
configured working hours, uses supported scheduling units, and does not overlap
events, locked blocks, or other tasks.

### Independent Feasibility Oracle

Create a test-only oracle that does not reuse production scheduling logic:

1. Generate every available 30-minute slot from the later of the current time
   and scheduling start through the deadline.
2. Remove slots that overlap events or locked task blocks.
3. Use backtracking or maximum-flow assignment to determine whether every
   required task slot can be assigned.
4. Whenever production scheduling returns `INSUFFICIENT_CAPACITY`, assert that
   the oracle also reports that the schedule is infeasible.
5. Whenever scheduling succeeds, verify total duration, deadlines, overlap,
   working hours, and earliest-start constraints.

### Legitimate Blocking Scenarios

- The deadline is already in the past.
- The deadline is less than one 30-minute slot away.
- A five-hour task is added at 9 PM with a midnight deadline.
- Events occupy every slot before the deadline.
- Some capacity exists, but total capacity is below the estimated duration.
- Capacity exists before the current time but not after it.
- Existing tasks plus the new task exceed total capacity.
- Available time exists only outside configured working hours.
- Free time ends exactly as the task begins or starts at its deadline.
- The due date occurs during a daylight-saving transition.

Invalid dates and malformed input must produce validation errors rather than
`INSUFFICIENT_CAPACITY`.

### Potential False-Rejection Scenarios

- **Fragmented availability:** A two-hour task has four separate 30-minute
  openings, but the scheduler insists on one-hour chunks.
- **Fourteen-day horizon:** A task due more than 14 days away has valid time
  outside the current search window.
- **Unaligned openings:** A valid 30-minute opening starts at `10:15`, while
  candidates are restricted to `:00` and `:30`.
- **Flexible existing tasks:** The new task fits only if an existing task moves
  to another valid slot.
- **Greedy placement:** An early chunk consumes a scarce slot required by a
  tighter task or later chunk.
- **Deadline precision:** A task due at `5:15 PM` loses usable time through slot
  rounding.
- **Duration mismatch:** Gemini can estimate up to 12 hours while the scheduler
  currently clamps durations to 8 hours.
- **Concurrent creation:** Two requests inspect the same availability and both
  reserve overlapping blocks.

### Property-Based Scheduler Tests

Use `fast-check` with reproducible seeds:

1. Generate random deadlines, durations, events, existing tasks, and working
   hours.
2. Keep generated windows small enough for exhaustive oracle evaluation.
3. Run at least 500 generated scenarios.
4. Assert that every production rejection is also rejected by the oracle.
5. Assert that successful schedules contain the exact required duration and no
   overlaps.
6. Print the random seed and minimized counterexample when a test fails.

### Persistence and UI Scheduling Tests

- A rejected task creates no `Task` or `TaskBlock` rows.
- Existing task blocks remain unchanged after rejection.
- The task dialog remains open and displays the capacity warning.
- Changing the deadline or duration allows the corrected task to be submitted.
- Two concurrent task requests cannot reserve the same slots.

### Expected Scheduler Corrections

If the tests expose false rejections:

1. Permit chunks from 30 to 60 minutes rather than requiring full one-hour
   chunks.
2. Search from the current time through the actual deadline, using a 14-day
   value only as a placement preference.
3. Add backtracking when greedy placement fails but feasible capacity exists.
4. Align the scheduler maximum with Gemini's 12-hour maximum.
5. Use serializable persistence or explicit slot-conflict protection for
   concurrent task requests.

## Phase 6: Production Readiness

1. Run a security review and dependency audit.
2. Verify that secrets and OAuth tokens never reach browser bundles or logs.
3. Configure production Supabase and Google OAuth credentials.
4. Add the production Google callback URI.
5. Add a privacy policy, terms, and account/token deletion behavior.
6. Complete Google verification for public Classroom access.
7. Run tests, coverage, type checking, build, migration deployment, and a
   production smoke test.

## Implementation Order

Implement the phases in order. Phase 1 is the first independently deployable
slice. The scheduling correctness gate belongs to Phase 5, but any scheduler
defects it exposes must be fixed before persistence and end-to-end testing can
be considered complete.
