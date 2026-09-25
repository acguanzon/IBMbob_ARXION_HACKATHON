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

### Phase 2 — IN PROGRESS 🔨

**What was done before this handoff:**

1. Prisma schema updated — new entities added:
   - `TaskContract` (PROVIDES / MODIFIES / CONSUMES relationships)
   - `TaskWorkIntent` (files, APIs, models, contracts, summary)
   - New enum values: `STALE` (AgentSessionStatus), `EXPIRED` (FileReservationStatus)
   - New enums: `ContractType`, `ContractRelationship`
   - `leaseExpiresAt` added to `TaskFileReservation`

2. Migration applied: `20260925180127_phase2_coordination` ✅

3. Prisma client regenerated ✅

4. `packages/types/src/index.ts` updated — all new Phase 2 schemas:
   - `TaskContractSchema`, `TaskWorkIntentSchema`
   - Request bodies: `ClaimTaskBody`, `CreateAgentSessionBody`, `ReserveFilesBody`, `ReleaseFilesBody`, `DeclareWorkIntentBody`, `DeclareContractBody`, `ReportProgressBody`
   - Coordination interfaces: `FileConflict`, `ContractRisk`, `CoordinationPreflight`
   - Updated `DomainEventType` with Phase 2 events

5. `apps/api/src/app.ts` updated — imports for all new modules wired in

**What still needs to be built (Phase 2):**

- [ ] `apps/api/src/lib/realtime.ts` — EventEmitter-based domain event bus
- [ ] `apps/api/src/lib/staleness-watcher.ts` — background job to mark stale sessions
- [ ] `apps/api/src/lib/normalize-path.ts` — file path normalization utility
- [ ] `apps/api/src/modules/tasks/task.service.ts` — add claim, release, progress, blockers
- [ ] `apps/api/src/modules/tasks/task.routes.ts` — wire claim, release, progress, blockers
- [ ] `apps/api/src/modules/agent-sessions/` — full CRUD + heartbeat + end
- [ ] `apps/api/src/modules/file-reservations/` — reserve, release, list, expiry
- [ ] `apps/api/src/modules/coordination/` — begin_task preflight, work intent, contracts, contract risk
- [ ] `apps/api/src/modules/activity/` — activity feed endpoint
- [ ] MCP server — all Phase 2 tools
- [ ] Frontend — live panels for agents, files, risks, activity
- [ ] AGENTS.md update

---

## Architecture

```
Human Developers
      │
      ▼
Collaboration Dashboard (Next.js, port 3000)
      │
   REST + WebSocket
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
      └── Realtime Events (EventEmitter → WebSocket)
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
| `apps/api/src/index.ts` | Entry point |
| `apps/api/src/lib/error-handler.ts` | Central error handling |
| `apps/mcp-server/src/index.ts` | MCP adapter — all agent tools |
| `apps/web/src/app/dashboard/page.tsx` | Main dashboard page |
| `apps/web/src/components/TaskBoard.tsx` | Kanban board component |
| `.bob/mcp.json` | MCP server registration for IBM Bob |

---

## Phase 2 Implementation Order (remaining)

```
1. realtime.ts + staleness-watcher.ts + normalize-path.ts   ← utility layer
2. Task claiming (claim/release endpoints + atomic tx)
3. Agent sessions (CRUD + heartbeat + end)
4. File reservations (reserve + release + expiry + conflict)
5. Work intent (declare + get)
6. Contracts (declare + get)
7. Contract risk detection
8. Coordination preflight (begin_task)
9. Progress reporting
10. Activity feed
11. MCP tools (claim_task, begin_task, reserve_files, etc.)
12. Frontend Phase 2 panels
13. AGENTS.md update
14. Build + typecheck + verify demo
15. Commit
```

---

## Phase 2 Demo Scenario (definition of done)

```
Developer A claims T-102 (Build Login API)
  → Bob calls begin_task(T-102)
  → Bob declares: files=[AuthController.ts, AuthService.ts], MODIFIES POST /api/login
  → Bob reserves files
  → Dashboard shows: Maki / IBM Bob / T-102 / WORKING

Developer B claims T-103 (Build Login Frontend)
  → Bob calls begin_task(T-103)
  → System detects: T-103 CONSUMES POST /api/login, T-102 MODIFIES it
  → Bob receives: CONTRACT RISK warning
  → Bob tries to reserve AuthService.ts
  → System detects: FILE CONFLICT (already held by Maki/T-102)
  → Both dashboards update in real time

Agent A reports progress
  → Activity feed updates live

Agent A stops without releasing
  → After 60-90s, session marked STALE
  → Reservations marked EXPIRED
  → No stale state remains
```

---

## Engineering Rules (quick ref)

1. MCP server NEVER accesses DB directly — calls backend API only
2. Backend owns all business logic
3. File reservations are advisory (soft) — never hard locks
4. Task claiming uses DB transactions — never frontend-enforced
5. Shared types from `@arxion/types` — never redefine locally
6. No Redis, Kafka, RabbitMQ — realtime via in-process EventEmitter + Socket.IO

---

*Last updated: Phase 2 in progress — schema + types done, building API modules*
