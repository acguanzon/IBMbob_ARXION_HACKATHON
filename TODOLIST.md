# Arxion TODO List

Last audited: 2026-09-26

This checklist reconciles the repository source, migrations, handoff documents, Git history, and local verification. A checked item means the capability exists in source. It does not imply that every path is fully authorized or covered by end-to-end tests unless stated.

## Current verification snapshot

- [x] Workspace builds pass when run recursively after generating the Prisma client.
- [x] Workspace typechecks pass after shared packages and the Prisma client are rebuilt.
- [x] API unit tests pass: 77 tests across the Phase 4 and Phase 5 suites.
- [x] Root `pnpm build` reliably builds every workspace on Windows.
- [x] Root `pnpm typecheck` builds shared contracts before checking dependent applications.
- [x] Lint passes across every workspace.
- [x] The lockfile is synchronized with all package manifests and passes a frozen install.
- [ ] End-to-end browser/API/MCP collaboration tests exist.

## What has been done

### Foundation and Phase 1

- [x] Created a pnpm TypeScript monorepo with `apps/api`, `apps/web`, and `apps/mcp-server`.
- [x] Added shared `database`, `types`, and `config` packages.
- [x] Added PostgreSQL persistence through Prisma, migrations, and seed data.
- [x] Added the Fastify API, Next.js dashboard, and MCP adapter.
- [x] Added project and task foundations plus the original task-context MCP tools.
- [x] Registered the MCP server for IBM Bob under `.bob/mcp.json`.

### Phase 2 coordination

- [x] Implemented task claiming, release, progress reporting, dependencies, and blockers.
- [x] Implemented agent sessions, heartbeats, stale-session handling, and session ending.
- [x] Implemented advisory file reservations, conflict warnings, lease expiry, and release.
- [x] Implemented work intents, task contracts, coordination preflight, and contract-risk detection.
- [x] Implemented project activity and an in-process realtime event layer with Socket.IO delivery.
- [x] Added active-agent, file-reservation, coordination-risk, and activity views.
- [x] Added Phase 2 MCP tools that proxy through the API rather than accessing Prisma directly.

### Phase 3 review and completion

- [x] Added completion reports and immutable review snapshots.
- [x] Added review requests, findings, AI-assisted review boundaries, approval, and change requests.
- [x] Added merge-readiness checks, merge confirmation, and idempotent task completion logic.
- [x] Added dependency re-evaluation, contract activation/versioning, project decisions, and context propagation.
- [x] Added review and decision pages plus Phase 3 MCP tools.
- [ ] Add dedicated Phase 3 automated tests and verify the full review-to-completion lifecycle end to end.

### Phase 4 Git intelligence

- [x] Added a provider abstraction with a GitHub implementation.
- [x] Added repository connections, task/branch links, webhook ingestion, external-event auditing, and deduplication.
- [x] Added actual-change, scope-deviation, code-entity, code-relationship, contract-change, coordination-risk, and context-update models/services.
- [x] Added impact analysis, branch divergence, merge-risk logic, realtime events, and MCP tools.
- [x] Added 40 passing Phase 4 unit tests.
- [ ] Complete the real-content semantic analysis path described under P1 below.

### Phase 5 handoffs and recovery

- [x] Added task readiness calculation and explanations.
- [x] Added structured handoffs, acknowledgement, superseding, and audit events.
- [x] Added versioned task context packages and relevance/noise controls.
- [x] Added recovery snapshots, recovery context, recovery delta, and resume flow.
- [x] Added parallel-safety analysis, safe-task suggestions, work groups, and coordinator summaries.
- [x] Added agent capability registration and Phase 5 MCP tools.
- [x] Added 37 passing Phase 5 unit tests.
- [x] Scoped recovery-delta project-decision queries to the snapshot project in source.
- [ ] Add the missing recovery-isolation regression test.

### Core product realignment already implemented

- [x] Added local registration, login, logout, session tokens, and `/auth/me`.
- [x] Added login/register pages and a client authentication context.
- [x] Added project-aware board and coordination routes.
- [x] Made sidebar projects selectable.
- [x] Added member-management API endpoints and an Add Member UI.
- [x] Added task acceptance criteria to the schema, shared contracts, forms, cards, and detail UI.
- [x] Added task creation and editing UI.
- [x] Added a detailed task drawer with dependencies, risks, context updates, handoffs, progress, and Git/review information.
- [x] Added a `dnd-kit` Kanban board with drag-to-claim behavior.
- [x] Prevented direct drag-to-DONE and routed IN_PROGRESS-to-REVIEW through review preflight in the client.
- [x] Added an Agent Dock and `AgentLaunchRequest` persistence/API flow.
- [x] Added MCP tools to list, accept, and reject launch requests.
- [x] Added project coordination UI for readiness, handoffs, context updates, recovery, and parallel-safety information.
- [x] Added visible developer/agent presence on task cards.

## Partially done and requiring completion

### P0 — secure, usable core workflow

- [x] Finish authentication integration for browser sessions, server-rendered API calls, and internal MCP requests.
- [ ] Replace all seeded-user fallbacks and caller-supplied actor IDs with `request.user.id` where the action represents the current human.
- [ ] Add authenticated MCP/integration credentials bound to a user, project access, and agent integration.
- [x] Apply centralized project-membership authorization to project-scoped task, review, repository, risk, handoff, recovery, context, coordination, activity, and launch operations.
- [x] Add and apply a project-role guard for owner-only member operations.
- [x] Ensure member update/delete queries verify that the target membership belongs to the route's project.
- [x] Restrict project listing and project reads to the authenticated user's memberships.
- [x] Make project creation use the authenticated user as owner instead of the first seeded user.
- [x] Make task creation use the authenticated user instead of the first seeded user.
- [ ] Make claim, release, progress, review, completion, handoff acknowledgement, recovery, and launch flows derive the actor safely.
- [ ] Convert Reviews and Decisions to project-aware routes (`/dashboard/[projectId]/reviews` and `/dashboard/[projectId]/decisions`) and project-scoped data.
- [x] Add a real Create Project workflow for first-time and existing users.
- [ ] Complete member management UI for role updates and member removal, including owner safeguards.
- [ ] Persist task dependency edits from the task form; the UI currently exposes task editing but dependency management is not complete.
- [ ] Make drag/drop state transitions authoritative on the backend, including review/completion state-machine enforcement independent of the client.
- [ ] Verify and improve duplicate-claim rollback/error messaging with two concurrent users.
- [ ] Add launch-request expiry handling and visible expired/error states.
- [ ] Make agent launch acceptance authenticate the integration and atomically create/bind the agent session, preflight, and context package.
- [ ] Resolve MCP naming/parity drift, including `end_session` versus the documented `end_task_session` and `reject_launch_request` versus cancel terminology.

### P1 — make Git and coordination intelligence trustworthy

- [x] Add `getFileContent(owner, repo, path, revision)` to the Git provider abstraction and GitHub provider.
- [x] Fetch actual changed file contents during normal push processing.
- [x] Run deterministic entity extraction on those real contents.
- [x] Persist deterministic import-based `CodeRelationship` records.
- [x] Add a task-to-code-entity mapping model and populate it from verified changes.
- [x] Feed verified semantic overlap into parallel-safety decisions.
- [x] Discover handoff targets through contract consumers as well as explicit task dependencies.
- [ ] Verify that contract-only consumers receive context updates and handoffs.
- [ ] Add robust pagination, rate-limit handling, and failure/retry behavior to GitHub API reads.
- [ ] Complete an MCP/API route integrity audit for all Phase 4/5 tools, request schemas, response envelopes, and tool names.
- [ ] Add authorization tests to ensure Phase 4/5 data cannot cross project boundaries.

### P2 — quality, documentation, and demo readiness

- [ ] Synchronize `README.md`, `AGENTS.md`, and `CURRENT_HANDOFF.md` with the actual Phase 1–5 and realignment status.
- [ ] Remove stale comments that still describe authentication or later phases as future work.
- [ ] Document the required clean-install sequence, or make scripts automatically generate Prisma/build shared packages before dependent checks.
- [x] Fix root workspace build filters so `pnpm build` runs all package and app builds on Windows.
- [x] Make lint scripts load the shared ESLint configuration and pass across the workspace.
- [x] Regenerate a lockfile consistent with every package manifest and verify `pnpm install --frozen-lockfile`.
- [ ] Replace broad `router.refresh()` realtime handling with targeted client-state updates where practical.
- [ ] Add consistent loading, empty, offline, retry, and error states across the dashboard.
- [ ] Remove or consolidate duplicate/legacy board components after confirming the active implementation.
- [ ] Clean up demo seed data and provide a repeatable two-user/two-agent demo setup.
- [ ] Add API integration tests backed by an isolated test database.
- [ ] Add E2E tests for authentication, project isolation, project switching, task drag, Agent Dock, multi-user presence, semantic Git analysis, handoffs, and recovery isolation.
- [ ] Run and document the complete Browser A / Browser B / agent handoff demo from `CORE_CONCEPT_REALIGNMENT_HANDOFF.md`.

## Phase 6 — specified, not implemented

Do not mark Phase 6 complete merely because `PHASE6_HANDOFF.md` exists. There are currently no Phase 6 CI modules, migrations, routes, or tests in the source tree.

- [ ] Add the CI provider abstraction and first GitHub Actions integration.
- [ ] Verify and deduplicate CI events.
- [ ] Add pipeline-run, pipeline-job, and test-result persistence.
- [ ] Track validation baselines, last-known-good revisions, first-failing revisions, and regression windows.
- [ ] Add regression incidents, evidence, candidate attribution, scoring, and confidence rules.
- [ ] Add flaky-test awareness, environment-failure classification, and failure-signature grouping.
- [ ] Add test-to-code relationships, validation coverage, task validation state, and deterministic release readiness.
- [ ] Add validation-failure context packages and human-approved repair-task proposals.
- [ ] Add MCP validation tools, validation context updates, the revalidation loop, and incident resolution rules.
- [ ] Add the validation dashboard and incident detail view.
- [ ] Add Phase 6 security, audit, unit, integration, and E2E coverage.

## Recommended execution order

1. Repair the development baseline: lockfile, build/typecheck prerequisites, root build script, and lint configuration.
2. Finish authentication identity propagation and project authorization across every route and MCP call.
3. Finish project-scoped navigation, project creation, member management, dependency editing, and backend state-machine enforcement.
4. Harden Agent Dock launch acceptance, expiry, integration credentials, and MCP parity.
5. Complete Git file-content retrieval, real semantic extraction, code relationships, task/entity mapping, and contract-consumer handoffs.
6. Add the required API integration and browser E2E suites.
7. Synchronize documentation and run the full two-user/two-agent demonstration.
8. Begin Phase 6 only after the core realignment definition of done is satisfied.

## Near-term definition of done

- [ ] Two different authenticated users can only see and mutate projects they belong to.
- [ ] An owner can create a project, add/manage members, and create/edit tasks entirely in the UI.
- [ ] Dragging a task claims it atomically; review and completion rules cannot be bypassed.
- [ ] Dropping a task in Agent Dock creates a secure launch request that an authenticated generic agent can accept.
- [ ] The accepted agent receives the full current context package without manual task copying.
- [ ] A second user's browser sees the active developer and agent without a manual reload.
- [ ] A real Git push yields content-based entity/contract analysis and reaches affected consumers.
- [ ] Dependency and contract consumers receive and acknowledge structured handoffs.
- [ ] Clean install, lint, typecheck, unit/integration tests, production builds, and E2E tests all pass from documented commands.
