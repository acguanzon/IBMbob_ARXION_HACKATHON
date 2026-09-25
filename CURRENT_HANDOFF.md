# CURRENT_HANDOFF.md
# Living development handoff — updated continuously as Phase 2 is built

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

All Phase 2 backend, MCP tools, and frontend panels implemented.

**What was done:**

1. Prisma schema updated — `TaskContract`, `TaskWorkIntent`, `leaseExpiresAt`, `STALE`, `EXPIRED`
2. Migration applied: `20260925180127_phase2_coordination` ✅
3. `packages/types` — all Phase 2 Zod schemas + TypeScript types ✅

4. API modules — all implemented:
   - `apps/api/src/lib/realtime.ts` — in-process domain event bus ✅
   - `apps/api/src/lib/staleness-watcher.ts` — background stale/expiry job ✅
   - `apps/api/src/lib/normalize-path.ts` — file path normalization ✅
   - `apps/api/src/lib/websocket.ts` — Socket.IO attached to Fastify, bridges event bus to browser ✅
   - `apps/api/src/modules/tasks/` — claim, release, progress, blockers ✅
   - `apps/api/src/modules/agent-sessions/` — create, heartbeat, end, list ✅
   - `apps/api/src/modules/file-reservations/` — reserve, release, list active ✅
   - `apps/api/src/modules/activity/` — activity feed (`GET /projects/:id/activity`) ✅
   - `apps/api/src/modules/coordination/` — work intent, contracts, contract risk, `begin_task` preflight ✅

5. MCP tools — all Phase 2 tools implemented (replacing stubs):
   - `get_task`, `get_project_context`, `get_task_dependencies` (Phase 1)
   - `get_task_blockers` ✅
   - `claim_task` ✅
   - `begin_task` (full coordination preflight) ✅
   - `declare_work_intent` ✅
   - `reserve_files` ✅
   - `release_files` ✅
   - `get_active_file_reservations` ✅
   - `report_progress` ✅
   - `heartbeat` ✅
   - `end_task_session` ✅
   - `get_team_activity` ✅
   - `get_coordination_risks` ✅

6. Frontend — all Phase 2 panels live with real-time push:
   - Active Agents panel — shows name, agent type, task, status, last seen ✅
   - File Reservations panel — shows active/conflict reservations per file ✅
   - Coordination Risks panel — shows CONTRACT RISK warnings ✅
   - Activity Feed — live from API, with event icons and relative timestamps ✅
   - `RealtimeProvider` client component — Socket.IO connection, `router.refresh()` on events ✅
   - Kanban task cards — show active file count + contract risk count per task ✅

---

## Architecture

```
Human Developers
      │
      ▼
Collaboration Dashboard (Next.js, port 3000)
      │
   REST (server-side fetch)
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
      └── Realtime Events (EventEmitter → domain events)
      │
      ▼
PostgreSQL (arxion_dev)
      │
      ▼
MCP Adapter (stdio, port N/A)
      │
      ▼
IBM Bob / Other Agents
```

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

**To run migration:**
```cmd
set DATABASE_URL=postgresql://postgres:password@localhost:5432/arxion_dev
cd packages\database
pnpm exec prisma migrate dev --name <name>
```

---

## Running the Stack

### PostgreSQL
Already running as Windows service `postgresql-x64-17`.
Password: `password`

### API
```cmd
node --env-file=.env apps\api\dist\index.js
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
| `apps/api/src/modules/coordination/coordination.service.ts` | begin_task, work intent, contracts, risk detection |
| `apps/api/src/modules/coordination/coordination.routes.ts` | Coordination API routes |
| `apps/api/src/modules/activity/activity.routes.ts` | Activity feed route |
| `apps/mcp-server/src/index.ts` | MCP adapter — all 14 agent tools |
| `apps/web/src/components/ActivityPanel.tsx` | Right sidebar — live agents/files/risks/activity |
| `apps/web/src/lib/api.ts` | Frontend API client (all Phase 2 endpoints) |
| `.bob/mcp.json` | MCP server registration for IBM Bob |

---

## API Endpoints (Phase 2 additions)

| Method | Path | Description |
|---|---|---|
| `POST` | `/tasks/:taskId/claim` | Atomic task claim |
| `POST` | `/tasks/:taskId/release` | Release task claim |
| `POST` | `/tasks/:taskId/progress` | Report progress |
| `GET` | `/tasks/:taskId/blockers` | Get active blockers |
| `POST` | `/tasks/:taskId/intent` | Declare work intent |
| `GET` | `/tasks/:taskId/intent` | Get declared intent |
| `POST` | `/tasks/:taskId/contracts` | Declare a contract |
| `GET` | `/tasks/:taskId/contracts` | List task contracts |
| `POST` | `/tasks/:taskId/files/reserve` | Reserve files |
| `POST` | `/tasks/:taskId/files/release` | Release files |
| `GET` | `/projects/:projectId/files/active` | Active file reservations |
| `POST` | `/agent-sessions` | Create agent session |
| `POST` | `/agent-sessions/:id/heartbeat` | Send heartbeat |
| `POST` | `/agent-sessions/:id/end` | End session |
| `GET` | `/agent-sessions/:id` | Get session |
| `GET` | `/projects/:projectId/agent-sessions` | List active sessions |
| `POST` | `/coordination/begin` | begin_task preflight |
| `GET` | `/projects/:projectId/coordination/risks` | Get contract risks |
| `GET` | `/projects/:projectId/activity` | Activity feed |

---

## Phase 2 Demo Scenario (definition of done)

```
Developer A claims T-102 (Build Login API)
  → Bob calls begin_task(T-102, userId)
  → Bob receives READY preflight
  → Bob calls declare_work_intent(T-102, files=[AuthController.ts, AuthService.ts], apis=[POST /api/login])
  → Bob calls reserve_files(T-102, [AuthController.ts, AuthService.ts])
  → Dashboard shows: Maki / IBM Bob / T-102 / WORKING

Developer B claims T-103 (Build Login Frontend)
  → Bob calls begin_task(T-103, userId)
  → Bob declares: CONSUMES POST /api/login
  → System detects: T-102 MODIFIES POST /api/login, T-103 CONSUMES it
  → Bob receives: READY_WITH_WARNINGS + CONTRACT RISK warning
  → Bob tries to reserve AuthService.ts
  → System detects: FILE CONFLICT (already held by Maki/T-102)
  → Both dashboards update on next refresh

Agent A reports progress
  → Activity feed updates live

Agent A stops without releasing
  → After 90s, session marked STALE
  → Reservations marked EXPIRED
```

---

## Phase 3 — Remaining

- `POST /tasks/:taskId/request-review` — request human review
- `POST /tasks/:taskId/complete` — mark task as completed
- Dependency blocking enforcement (optional)
- File release on task completion
- GitHub integration (Phase 4)

---

## Engineering Rules (quick ref)

1. MCP server NEVER accesses DB directly — calls backend API only
2. Backend owns all business logic
3. File reservations are advisory (soft) — never hard locks
4. Task claiming uses DB transactions — never frontend-enforced
5. Shared types from `@arxion/types` — never redefine locally
6. No Redis, Kafka, RabbitMQ — realtime via in-process EventEmitter

---

*Last updated: Phase 2 complete — all backend modules, MCP tools, and frontend panels implemented*
