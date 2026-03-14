# AI Money Assistant Blueprint v2

## 1. Product Definition

AI Money Assistant ek trust-first, voice-first personal money system hoga for Hindi/Hinglish users who manage cash manually. Product ka core promise:

**"Bolkar paisa likho, samjho, aur galti hone se pehle verify karo."**

Ye product chatbot-first nahi hoga. Ye **structured money system + AI assistance layer** hoga.

## 2. Non-Negotiable Product Rules

- AI kabhi bhi silently money record create, edit, ya delete nahi karega.
- Har ambiguous input confirmation ya clarification ke bina save nahi hoga.
- Structured ledger hi source of truth hoga.
- Summaries aur balances sirf computed aggregates se banenge.
- Corrections traceable hongi.
- Reminder state ledger state se alag rahegi, unless explicitly linked.

## 3. Primary User Segment

### Phase 1 launch user

- household cash users
- low-tech Hindi/Hinglish users
- users jo form-based accounting app nahi chahte

### Product tone

- simple
- local-language friendly
- non-judgmental
- trust-building

## 4. Product Scope

### V1 required

- Google login via Supabase Auth
- voice and text entry
- parser with confidence score
- clarification and confirmation flow
- expense, income, udhaar, reminder, savings-note support
- append-safe correction flow
- daily, weekly, monthly summaries
- Ask AI over structured data
- pending udhaar tracking
- home dashboard
- history
- audit-aware observability

### Later

- offline sync
- family accounts
- advanced budgeting
- multilingual expansion
- native mobile wrapper or app

## 5. System Architecture

### 5.1 Client layer

Stack:

- Next.js App Router
- React
- TypeScript
- Tailwind CSS

Responsibilities:

- voice capture
- transcript preview
- parsed preview
- confirmation UI
- dashboard
- history
- reminders
- Ask AI chat

### 5.2 Auth layer

Stack:

- Supabase Auth
- Google OAuth

Rules:

- Supabase session is auth truth
- profile row is app-level user record
- service role key is server-only

### 5.3 AI input pipeline

Input pipeline will be:

1. raw voice or text input
2. speech-to-text if needed
3. input normalization
4. parser prompt contract
5. parser structured output validation
6. ambiguity check
7. confirmation or clarification
8. deterministic write application

AI role:

- understand language
- suggest structured intents
- estimate confidence
- request clarification when needed

AI will not:

- mutate records directly
- calculate balances directly
- invent missing financial facts

### 5.4 Deterministic money engine

This module will own:

- entry type normalization
- cash effect mapping
- receivable/payable effect mapping
- bucket assignment rules
- duplicate warning rules
- net cash movement calculation
- derived loan balances

### 5.5 Correction engine

Correction model will be traceable, not blind overwrite.

Current design:

- `ledger_entries` stores latest effective row
- `entry_corrections` stores append-only correction event history
- every correction links target entry, actor, timestamp, before/after diff, and reason when available

This is simpler than full event sourcing but still audit-safe.

### 5.6 Summary truth layer

Summaries will be computed from saved records only.

Rules:

- daily, weekly, monthly windows explicit
- previous period comparison only when comparable
- numbers first, narrative second
- no guessed totals

### 5.7 Ask AI layer

Ask AI will not read raw database history blindly. Flow will be:

1. detect question intent and time period
2. run deterministic DB queries and aggregates
3. pass minimal facts to answer prompt
4. generate simple Hindi answer
5. show uncertainty if data is incomplete

### 5.8 Insight layer

Insights are advisory only.

Rules:

- fact-based
- non-judgmental
- short
- clearly separate fact from suggestion

### 5.9 Reminder intelligence

Reminders will be a separate state machine:

- pending
- done
- snoozed
- overdue
- cancelled

Reminder logic supports:

- bill reminders
- follow-up for udhaar
- reschedule
- snooze

### 5.10 Observability and privacy

Must capture:

- parser input and normalized input
- parser confidence
- clarification reason
- mutation correlation id
- reminder state changes
- masked audit logs

Must minimize:

- raw audio retention
- unnecessary transcript storage
- sensitive logs

## 6. Canonical Domain Model

### 6.1 AppProfile

- linked to Supabase auth user id
- name
- preferred language
- timezone
- default bucket

### 6.2 Bucket

- personal
- ghar
- dukaan
- kheti
- future custom buckets

### 6.3 LedgerEntry

- id
- user_id
- bucket_id
- source_mode
- source_text
- amount
- entry_type
- category
- entry_date
- person_name optional
- note optional
- parser_confidence optional
- requires_confirmation boolean
- duplicate_fingerprint optional
- created_at
- updated_at

### 6.4 EntryCorrection

- id
- entry_id
- actor_user_id
- reason optional
- source_text
- before_snapshot
- after_snapshot
- created_at

### 6.5 Reminder

- id
- user_id
- bucket_id optional
- title
- linked_person optional
- linked_entry_id optional
- due_at
- status
- snooze_until optional
- created_at
- updated_at

### 6.6 AuditLog

- id
- correlation_id
- actor_user_id
- event_type
- entity_type
- entity_id
- masked_payload
- created_at

## 7. Entry Type Rules

| Entry type | Cash effect | Receivable effect | Payable effect |
| --- | --- | --- | --- |
| expense | -amount | 0 | 0 |
| income | +amount | 0 | 0 |
| loan_given | -amount | +amount | 0 |
| loan_taken | +amount | 0 | +amount |
| loan_received_back | +amount | -amount | 0 |
| loan_repaid | -amount | 0 | -amount |
| savings_deposit | -amount | 0 | 0 |
| note | 0 | 0 | 0 |
| reminder | 0 | 0 | 0 |

### Derived metrics

- `cash_in_total` = sum of positive cash-effect entries
- `cash_out_total` = sum of negative cash-effect entries
- `net_cash_movement` = `cash_in_total - cash_out_total`
- `pending_receivable` = sum open receivable effect by person
- `pending_payable` = sum open payable effect by person

If opening balance is not captured yet, dashboard must show `Net Cash Movement`, not pretend it is exact wallet balance.

## 8. Duplicate Warning Rules

Warn before save if all are true:

- same user
- same amount
- same entry type
- same resolved date
- same person or same category
- created within short recent window

Warning should not hard-block unless duplicate is near-certain and user explicitly cancels.

## 9. Parser Contract

Parser output must be schema-validated.

### Parser input

- raw text
- normalized text
- locale
- timezone
- current date
- allowed entry types
- allowed categories
- allowed buckets

### Parser output

- `actions[]`
- `confidence`
- `needs_clarification`
- `clarification_question`

Each action contains:

- `intent_type`
- `amount`
- `entry_type`
- `date_text`
- `resolved_date`
- `category`
- `bucket`
- `person_name`
- `note`

If output is malformed, discard and route to safe fallback.

## 10. Ask AI Contract

Ask AI must receive:

- user question
- resolved time window
- computed aggregates
- relevant top records
- pending loan facts

Ask AI must return:

- `answer_text`
- `factual_points[]`
- `uncertainty_note optional`

Ask AI will not fabricate numbers not present in aggregates.

## 11. Clarification Strategy

Clarification should be minimum-needed, one-step questions.

Examples:

- `Ye kharcha tha ya udhaar?`
- `Kya aapka matlab 1500 tha?`
- `Ye Raju ko diya tha ya Raju se liya tha?`
- `Kaunsi purani entry ko theek karna hai?`

Rules:

- one unknown at a time
- simple Hindi/Hinglish
- block write until resolved

## 12. Voice Confirmation UX

Every risky save flow should show:

- transcript preview
- parsed preview
- save confirmation
- undo after save
- edit option

Home-screen save UX sequence:

1. user speaks
2. transcript shown
3. parsed cards shown
4. user confirms
5. save success shown
6. undo available briefly

## 13. Security and Privacy

- store minimal user data
- audio storage off by default
- transcript retention only for useful trust or correction workflows
- audit logs masked
- all server mutations auth-checked
- service role only on server

## 14. Suggested Repository Structure

- `app/`
- `app/api/`
- `app/(auth)/`
- `app/(dashboard)/`
- `components/`
- `lib/supabase/`
- `lib/prisma/`
- `lib/ai/`
- `lib/ledger/`
- `lib/reminders/`
- `lib/validation/`
- `prisma/schema.prisma`
- `docs/`

## 15. Environment Strategy

Required groups:

- app config
- Supabase auth config
- Prisma database config
- OpenAI config
- speech provider config

Recommended future groups:

- observability
- replay tooling
- scheduler

## 16. Build Strategy

### Track A: foundation

- Next.js scaffold
- Supabase auth
- Prisma schema
- base dashboard shell
- env validation

### Track B: safe write path

- parser contracts
- text entry
- clarification flow
- confirmation flow
- deterministic ledger write
- duplicate warning

### Track C: trust and corrections

- history
- append-safe corrections
- undo
- audit log

### Track D: truth-based intelligence

- daily weekly monthly summaries
- Ask AI from aggregates
- safe insights

### Track E: reminders and observability

- reminders
- follow-up logic
- parser traces
- bug replay packet

## 17. Quality Gates

- no silent mutation paths
- parser outputs always schema validated
- summary totals equal DB aggregates
- correction path is reversible or auditable
- wrong-save risk handled by confirmation or block
- AI answer never claims unsupported fact

## 18. Launch Definition

V1 launch is successful when:

- first-time user can create a valid entry in under 30 seconds
- ambiguous inputs trigger safe clarification
- user can fix a wrong entry quickly
- pending udhaar is clearly visible
- summaries are numerically trustworthy
- AI feels helpful without feeling risky
