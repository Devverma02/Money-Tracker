# AI Money Assistant Implementation Plan

## Phase 0: Project Foundation

### Goal

Establish the repo, environment, auth, database, and shared app shell.

### Deliverables

- Next.js app scaffold
- Tailwind setup
- Supabase client and auth wiring
- Prisma client and schema setup
- env validation
- dashboard route shell

### Target areas

- `package.json`
- `app/`
- `lib/supabase/`
- `lib/prisma/`
- `prisma/schema.prisma`
- `.env.example`

### Acceptance criteria

- app boots locally
- Google auth flow can be wired safely
- Prisma connects to Supabase Postgres
- env config is explicit and documented

### Risks

- auth and Prisma setup drift apart
- server-only secrets leak into client code

### Validation

- local app boot
- auth route smoke test
- Prisma connection smoke test

## Phase 1: Ledger Data Model

### Goal

Create canonical schema for ledger, reminders, buckets, corrections, and audit logs.

### Deliverables

- Prisma models
- initial migrations
- indexes for user/date/person queries

### Target areas

- `prisma/schema.prisma`
- `prisma/migrations/`
- `lib/ledger/types.ts`

### Acceptance criteria

- all core entry types modeled
- correction and audit tables present
- reminder state modeled

### Risks

- schema too loose for trust-sensitive flows
- schema too complex for early development

### Validation

- migration runs cleanly
- sample queries cover summaries and loans

## Phase 2: Parser Contracts and Text Entry

### Goal

Support typed input first with strict parser contracts and safe parsing flow.

### Deliverables

- parser request schema
- parser response schema
- text entry form
- parse preview
- clarification handling

### Target areas

- `lib/ai/`
- `lib/validation/`
- `app/api/parse/`
- `components/entry/`

### Acceptance criteria

- one utterance can become one or more structured actions
- malformed AI output is rejected safely
- low confidence triggers clarification instead of save

### Risks

- parser contract too loose
- UI saves before user trust is established

### Validation

- golden parser examples
- malformed output tests
- clarification behavior tests

## Phase 3: Deterministic Save Path

### Goal

Commit parsed actions into the ledger through deterministic and idempotent logic.

### Deliverables

- write service
- duplicate warning checks
- transactional mutation flow
- audit log creation

### Target areas

- `lib/ledger/`
- `app/api/entries/`
- `lib/audit/`

### Acceptance criteria

- AI cannot write directly to DB
- duplicate warnings appear before final save
- write retries do not create extra money state

### Risks

- silent duplicate creates
- partial writes on multi-step mutations

### Validation

- transactional tests
- duplicate tests
- idempotency tests

## Phase 4: Voice and Confirmation UX

### Goal

Add voice capture and trustable confirmation UX.

### Deliverables

- microphone flow
- transcript preview
- parsed preview cards
- save confirmation and undo

### Target areas

- `components/voice/`
- `components/confirmation/`
- `app/(dashboard)/`

### Acceptance criteria

- user can speak, review, and confirm before save
- wrong transcript can be edited before mutation

### Risks

- voice flow saves too early
- preview hides important parsed assumptions

### Validation

- manual UX walkthrough
- noisy transcript test cases

## Phase 5: Corrections and History

### Goal

Make post-save recovery safe and fast.

### Deliverables

- history list
- entry detail
- correction flow
- undo chain
- correction audit events

### Target areas

- `app/(dashboard)/history/`
- `components/history/`
- `lib/corrections/`

### Acceptance criteria

- user can correct recent entries easily
- correction remains traceable
- summaries reflect latest effective state

### Risks

- history and current state diverge
- correction flow targets wrong entry

### Validation

- correction matching tests
- before/after audit tests

## Phase 6: Summary Truth Layer and Ask AI

### Goal

Add trustworthy summaries and question answering from aggregates.

### Deliverables

- daily, weekly, monthly summary services
- summary widgets
- Ask AI query path
- answer prompt contract

### Target areas

- `lib/summaries/`
- `lib/ai/ask/`
- `app/api/ask/`
- `components/summary/`

### Acceptance criteria

- numbers match DB aggregates
- Ask AI answers cite structured facts
- no fabricated totals

### Risks

- Ask AI bypasses aggregate layer
- summary formulas drift from ledger rules

### Validation

- fixture-based aggregate tests
- Ask AI answer contract tests

## Phase 7: Reminders, Observability, and Hardening

### Goal

Add reminders, traces, replayable failures, and production guardrails.

### Deliverables

- reminder CRUD and due states
- parser trace logging
- replay packet format
- trust metrics events

### Target areas

- `lib/reminders/`
- `app/api/reminders/`
- `lib/observability/`
- `lib/metrics/`

### Acceptance criteria

- reminders support snooze and overdue
- parser failures are diagnosable
- trust metrics can be emitted

### Risks

- debug logs leak sensitive data
- reminder state becomes inconsistent

### Validation

- reminder lifecycle tests
- masked log checks
- replay packet smoke test
