# CURRENT_HANDOFF.md
# Living development handoff — updated continuously

---

## Project

**Arxion** — Agent-agnostic collaboration layer for AI-assisted software development.

Repository: pnpm monorepo, Node.js 22, TypeScript strict mode.

---

## Current State

### Phase 1 — COMPLETE ✅

Everything verified and committed (`d8f1758`).

- pnpm monorepo with `apps/api`, `apps/web`, `apps/mcp-server`
- `packages/database` — Prisma schema, migrations, seed
- `packages/types` — Shared Zod schemas + TypeScript types
- `packages/config` — Shared env helpers
- Fastify REST API: `/health`, `/projects`, `/tasks`
- Next.js 14 Kanban dashboard — pulls live data from API
- MCP server — `get_task`, `get_project_context`, `get_task_dependencies`
- Seed data: CollabAI Demo, Maki/Alex/Bea, T-101/T-102/T-103
- Full chain verified: IBM Bob → MCP → API → PostgreSQL ✅
- MCP registered at `.bob/mcp.json`

### Phase 2 — COMPLETE ✅

All backend modules, MCP tools, and frontend panels built and typechecked clean.

**Schema & Types (previously done):**
- Prisma schema updated — `TaskContract`, `TaskWorkIntent`, `STALE`, `EXPIRED`, `ContractType`, `ContractRelationship`, `leaseExpiresAt`
- Migration applied: `20260925180127_phase2_coordination`
- `packages/types/src/index.ts` — all Phase 2 Zod schemas and TypeScript types

**Utility layer:**
- `apps/api/src/lib/realtime.ts` — in-process EventEmitter domain event bus ✅
- `apps/api/src/lib/staleness-watcher.ts` — background job: marks stale sessions + expires leases ✅
- `apps/api/src/lib/normalize-path.ts` — file path normalization utility ✅

**API modules:**
- `apps/api/src/modules/tasks/` — claim (atomic tx), release, progress, blockers ✅
- `apps/api/src/modules/agent-sessions/` — create, heartbeat, end, list, CRUD ✅
- `apps/api/src/modules/file-reservations/` — reserve (with conflict detection), release, list active ✅
- `apps/api/src/modules/coordination/` — begin_task preflight, work intent, contracts, contract risk ✅
- `apps/api/src/modules/activity/` — project + task activity feed ✅
- `apps/api/src/app.ts` — all modules registered ✅

**MCP server (`apps/mcp-server/src/index.ts`) — v0.2.0:**
- `get_task` (Phase 1) ✅
- `get_project_context` (Phase 1) ✅
- `get_task_dependencies` (Phase 1) ✅
- `claim_task` ✅
- `begin_task` — full coordination preflight (claim + session + context + risks) ✅
- `reserve_files` ✅
- `release_files` ✅
- `report_progress` ✅
- `get_team_activity` ✅
- `get_active_file_reservations` ✅
- `end_session` ✅

**Frontend (`apps/web`):**
- `src/lib/api.ts` — extended with Phase 2 endpoints (agent sessions, file reservations, activity) ✅
- `src/components/ActivityPanel.tsx` — live panels: agents (with status dot), file reservations (with expiry), conflicts, activity feed with icons and time-ago ✅
- `src/app/dashboard/page.tsx` — fetches all Phase 2 data in parallel, shows active agent count in header ✅

**Build & typecheck:**
- All packages build clean: `@arxion/config`, `@arxion/types`, `@arxion/database`, `@arxion/api`, `@arxion/mcp-server` ✅
- `packages/config` + `packages/database` tsconfigs fixed: added `@types/node`, `seed.ts` excluded from database build ✅

---

## Architecture

```
Human Developers
      │
      ▼
Collaboration Dashboard (Next.js, port 3000)
  - Kanban task board
  - Live agents panel (status dot per session)
  - Live file reservations panel (with expiry)
  - Conflict panel
  - Activity feed (icons + time-ago)
      │
   REST
      │
      ▼
Coordination Backend (Fastify, port 3001)
      │
      ├── Tasks + Claiming (atomic DB transactions)
      ├── Agent Sessions + Heartbeat + Stale detection
      ├── File Reservations + Lease expiry
      ├── Work Intent Declaration
      ├── Contract Model (PROVIDES/MODIFIES/CONSUMES)
      ├── Contract Risk Detection
      ├── Coordination Preflight (begin_task)
      ├── Activity Feed
      └── Realtime Events (EventEmitter → future WebSocket)
      │
      ▼
PostgreSQL (arxion_dev)
      │
      ▼
MCP Adapter (stdio, port N/A)
  - 11 fully implemented tools
      │
      ▼
IBM Bob / Other Agents
```

---

## API Endpoints (Phase 2)

| Method | Path | Description |
|---|---|---|
| POST | `/coordination/begin` | Full begin_task preflight |
| POST | `/tasks/:taskId/claim` | Claim a task |
| POST | `/tasks/:taskId/release` | Release a task |
| POST | `/tasks/:taskId/progress` | Report progress |
| GET | `/tasks/:taskId/blockers` | Get active blockers |
| POST | `/tasks/:taskId/work-intent` | Declare/update work intent |
| GET | `/tasks/:taskId/work-intent` | Get work intent |
| POST | `/tasks/:taskId/contracts` | Declare a contract |
| GET | `/tasks/:taskId/contracts` | Get contracts |
| GET | `/tasks/:taskId/contract-risks` | Get contract risks |
| POST | `/tasks/:taskId/files/reserve` | Reserve files |
| POST | `/tasks/:taskId/files/release` | Release files |
| GET | `/projects/:projectId/files/active` | List active reservations |
| POST | `/agent-sessions` | Create agent session |
| POST | `/agent-sessions/:sessionId/heartbeat` | Heartbeat |
| POST | `/agent-sessions/:sessionId/end` | End session |
| GET | `/agent-sessions/:sessionId` | Get session |
| GET | `/projects/:projectId/agent-sessions` | List active sessions |
| GET | `/projects/:projectId/activity` | Activity feed |
| GET | `/tasks/:taskId/activity` | Task activity feed |

---

## Database

**Connection:** `postgresql://postgres:password@localhost:5432/arxion_dev`

**Migrations applied:**
- `20260925171328_init` — Phase 1 full schema
- `20260925180127_phase2_coordination` — TaskContract, TaskWorkIntent, leaseExpiresAt, STALE, EXPIRED

**To regenerate client after schema change:**
```cmd
set DATABASE_URL=postgresql://postgres:password@localhost:5432/arxion_dev
pnpm --filter @arxion/database db:generate
```

---

## Running the Stack

### PostgreSQL

**Option A — Docker (recommended, cross-platform):**
```bash
docker compose up -d
```
Starts PostgreSQL 16 on `localhost:5432` with credentials matching `.env.example`. Data persists in the `arxion_pgdata` named volume.

**Option B — Local Windows service:**
Already running as `postgresql-x64-17` if installed locally. Password: `password`.

### API
```cmd
set DATABASE_URL=postgresql://postgres:password@localhost:5432/arxion_dev
set PORT=3001
node apps\api\dist\index.js
```
Or in dev mode: `cd apps\api && pnpm dev`

### Web
```cmd
cd apps\web && pnpm dev
```
Opens at http://localhost:3000

### MCP Server
Registered at `.bob/mcp.json` — Bob spawns it automatically.
Built output: `apps/mcp-server/dist/index.js`

---

## Key Files

| File | Purpose |
|---|---|
| `packages/database/prisma/schema.prisma` | Full Prisma schema |
| `packages/types/src/index.ts` | All shared Zod schemas and TypeScript types |
| `apps/api/src/app.ts` | Fastify app — registers all route modules |
| `apps/api/src/lib/realtime.ts` | Domain event bus |
| `apps/api/src/lib/staleness-watcher.ts` | Background stale session + lease expiry job |
| `apps/api/src/modules/coordination/coordination.service.ts` | Core begin_task + contract risk logic |
| `apps/api/src/modules/activity/activity.service.ts` | Activity feed queries |
| `apps/mcp-server/src/index.ts` | MCP adapter — 11 agent tools |
| `apps/web/src/components/ActivityPanel.tsx` | Live dashboard right panel |
| `apps/web/src/lib/api.ts` | Server-side API client with Phase 2 endpoints |
| `.bob/mcp.json` | MCP server registration for IBM Bob |

---

## Phase 2 Demo Scenario (verified architecture)

```
Developer A claims T-102 (Build Login API)
  → Bob calls begin_task(T-102, userId)
  → System: claims task, creates agent session, returns READY status
  → Bob calls reserve_files(["AuthController.ts", "AuthService.ts"])
  → Bob calls POST /tasks/T-102/contracts with MODIFIES POST /api/login
  → Dashboard shows: Maki / IBM Bob / T-102 / WORKING

Developer B claims T-103 (Build Login Frontend)
  → Bob calls begin_task(T-103, userId)
  → System detects: T-103 CONSUMES POST /api/login, T-102 MODIFIES it
  → Bob receives: READY_WITH_WARNINGS + CONTRACT RISK warning
  → Bob calls reserve_files(["AuthService.ts"])
  → System returns 207 + FileConflict (held by Maki/T-102)
  → Both dashboards update on next poll

Agent A reports progress
  → Bob calls report_progress(T-102, "Implemented JWT auth")
  → Activity feed shows in dashboard

Agent A stops without releasing
  → After 90s: session marked STALE (staleness-watcher)
  → After lease expiry: reservations marked EXPIRED
  → No stale state remains
```

---

## Bug Fixes & Resilience (post-Phase 2)

- **Staleness watcher crash fix:** `checkStaleSessions()` and `expireLeases()` in `apps/api/src/lib/staleness-watcher.ts` were unguarded `async` functions called with `void`. A `PrismaClientInitializationError` (DB unreachable) would propagate as an unhandled rejection and crash the API process. Both functions are now wrapped in `try/catch` — they log a warning and skip the cycle instead of throwing.
- **Docker Compose added:** `docker-compose.yml` added at repo root to spin up PostgreSQL 16 with a single `docker compose up -d` command, removing the Windows-only dependency on a local PostgreSQL service.

---

## Engineering Rules (quick ref)

1. MCP server NEVER accesses DB directly — calls backend API only
2. Backend owns all business logic
3. File reservations are advisory (soft) — never hard locks
4. Task claiming uses DB transactions — never frontend-enforced
5. Shared types from `@arxion/types` — never redefine locally
6. No Redis, Kafka, RabbitMQ — realtime via in-process EventEmitter (WebSocket upgrade = Phase 3)

---

## Phase 3 (next)

- WebSocket / SSE layer for true real-time dashboard updates (currently polling via `force-dynamic`)
- `POST /tasks/:taskId/request-review` + `POST /tasks/:taskId/complete`
- Review workflow (approve / request changes)
- AGENTS.md full update
- E2E demo script / recording
- Build + commit

---

*Last updated: staleness-watcher crash fix + Docker Compose added for PostgreSQL*
