# Arxion

**Agent-agnostic collaboration layer for AI-assisted software development.**

> Any coding agent can understand your code. We give every coding agent a shared understanding of your team.

---

## What Is Arxion?

Modern AI coding agents are powerful, but they work largely in isolation. When multiple developers and agents work on the same project, they lack shared awareness of:

- who is working on what
- which files are being modified
- which tasks block other tasks
- where conflicts may occur before code is merged

Arxion is a **shared coordination layer** that gives human developers and their AI coding agents a unified view of the project state.

The coding agents write the code. Git versions the code. **Arxion coordinates the work.**

---

## High-Level Architecture

```
HUMAN DEVELOPERS
      │
      ▼
COLLABORATION WEB APP (Next.js, port 3000)
  - Kanban task board
  - Live agents panel (status dot per session)
  - Live file reservations panel (with expiry)
  - Conflict panel
  - Activity feed (icons + time-ago)
      │
    REST API
      │
      ▼
BACKEND APPLICATION (Fastify, port 3001)
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

CODING AGENTS (IBM Bob, Cursor, Claude Code, etc.)
      │
      ▼
MCP SERVER (stdio adapter, apps/mcp-server)
      │
      ▼
BACKEND APPLICATION (same instance)
      │
      ▼
PostgreSQL (same database)
```

**The most important rule:** humans and AI agents share one source of truth — PostgreSQL, accessed only through the backend API.

The MCP server is a thin adapter. It never accesses the database directly.

---

## Repository Structure

```
/
├── apps/
│   ├── api/            — Fastify REST API
│   ├── web/            — Next.js collaboration dashboard
│   └── mcp-server/     — MCP adapter for AI coding agents
│
├── packages/
│   ├── database/       — Prisma schema, client, migrations, seed
│   ├── types/          — Shared Zod schemas and TypeScript types
│   └── config/         — Shared environment/config utilities
│
├── docs/
├── docker-compose.yml  — PostgreSQL 16 for local development
├── AGENTS.md           — Guide for AI coding agents in this repo
├── CURRENT_HANDOFF.md  — Living development handoff document
└── README.md           — This file
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, React, TypeScript, Tailwind CSS |
| Backend | Node.js 22, TypeScript, Fastify |
| Database | PostgreSQL 16, Prisma ORM |
| Validation | Zod |
| Realtime | In-process EventEmitter (WebSocket upgrade in Phase 3) |
| Agent bridge | MCP server (TypeScript, stdio) |
| Monorepo | pnpm workspaces |

---

## Prerequisites

- Node.js >= 20
- pnpm >= 9
- Docker (recommended) **or** a local PostgreSQL 16 instance

---

## Local Setup

### 1. Clone the repository

```bash
git clone <repo-url>
cd arxion
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

The defaults in `.env.example` work out of the box with the Docker setup:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/arxion_dev"
```

### 4. Start PostgreSQL

**Option A — Docker (recommended):**

```bash
docker compose up -d
```

Starts PostgreSQL 16 on `localhost:5432`. Data persists in the `arxion_pgdata` named volume.

**Option B — Local service (Windows):**

Ensure your local `postgresql-x64-17` service is running. Password: `password`.

### 5. Set up the database

Generate the Prisma client:

```bash
pnpm db:generate
```

Run migrations:

```bash
pnpm db:migrate
```

Seed demo data:

```bash
pnpm db:seed
```

The seed creates:

- **Project:** CollabAI Demo
- **Users:** Maki, Alex, Bea
- **Tasks:** T-101 (Create User Schema), T-102 (Build Login API), T-103 (Create Login Interface)
- **Dependencies:** T-102 depends on T-101 · T-103 depends on T-102

---

## Running the Apps

### Backend API

```bash
cd apps/api
pnpm dev
```

The API starts at `http://localhost:3001`.

### Web Dashboard

```bash
cd apps/web
pnpm dev
```

The dashboard opens at `http://localhost:3000`.

### MCP Server

The MCP server runs on stdio and is spawned automatically by IBM Bob via `.bob/mcp.json`.

To build manually:

```bash
cd apps/mcp-server
pnpm build
```

---

## Environment Variables

See `.env.example` for the complete list.

| Variable | App | Required | Description |
|---|---|---|---|
| `DATABASE_URL` | api | ✅ | PostgreSQL connection string |
| `PORT` | api | — | API port (default: 3001) |
| `NODE_ENV` | api | — | `development` or `production` |
| `INTERNAL_API_KEY` | api | — | Key checked on internal routes |
| `NEXT_PUBLIC_API_URL` | web | — | Backend URL for the browser (default: http://localhost:3001) |
| `NEXT_PUBLIC_WS_URL` | web | — | WebSocket URL (default: ws://localhost:3001) |
| `MCP_API_BASE_URL` | mcp-server | — | Backend URL for MCP server (default: http://localhost:3001) |
| `MCP_API_KEY` | mcp-server | — | Optional API key for internal calls |

---

## API Reference

### Health

```
GET /health
```

### Projects

```
POST   /projects
GET    /projects
GET    /projects/:projectId
GET    /projects/:projectId/members
```

### Tasks

```
POST   /projects/:projectId/tasks
GET    /projects/:projectId/tasks
GET    /tasks/:taskId
PATCH  /tasks/:taskId
GET    /tasks/:taskId/dependencies
```

### Task Lifecycle (Phase 2)

```
POST   /tasks/:taskId/claim
POST   /tasks/:taskId/release
POST   /tasks/:taskId/progress
GET    /tasks/:taskId/blockers
```

### File Reservations (Phase 2)

```
POST   /tasks/:taskId/files/reserve
POST   /tasks/:taskId/files/release
GET    /projects/:projectId/files/active
```

### Agent Sessions (Phase 2)

```
POST   /agent-sessions
POST   /agent-sessions/:sessionId/heartbeat
POST   /agent-sessions/:sessionId/end
GET    /agent-sessions/:sessionId
GET    /projects/:projectId/agent-sessions
```

### Coordination (Phase 2)

```
POST   /coordination/begin
POST   /tasks/:taskId/work-intent
GET    /tasks/:taskId/work-intent
POST   /tasks/:taskId/contracts
GET    /tasks/:taskId/contracts
GET    /tasks/:taskId/contract-risks
```

### Activity Feed (Phase 2)

```
GET    /projects/:projectId/activity
GET    /tasks/:taskId/activity
```

---

## MCP Integration

The MCP server allows AI coding agents (IBM Bob, Cursor, Claude Code, etc.) to interact with the collaboration platform.

### How it works

```
AI Agent (IBM Bob)
      │
  begin_task("T-102", userId)
      │
      ▼
MCP Server (apps/mcp-server)
      │
  POST /coordination/begin
      │
      ▼
Backend API (apps/api)
      │
      ▼
PostgreSQL
      │
      ▼
Preflight result (status + risks + context) returned to IBM Bob
```

### Configuring IBM Bob

The server is pre-registered at `.bob/mcp.json`. For other environments, add this to your `mcp.json`:

```json
{
  "mcpServers": {
    "arxion": {
      "command": "node",
      "args": ["/absolute/path/to/apps/mcp-server/dist/index.js"],
      "env": {
        "MCP_API_BASE_URL": "http://localhost:3001",
        "MCP_API_KEY": "your-internal-api-key"
      }
    }
  }
}
```

### Available MCP Tools

| Tool | Phase | Description |
|---|---|---|
| `get_task` | 1 ✅ | Retrieve a task by display ID (e.g. T-102) or internal ID |
| `get_project_context` | 1 ✅ | Retrieve project info, members, and task count |
| `get_task_dependencies` | 1 ✅ | Get the dependency list for a task |
| `claim_task` | 2 ✅ | Claim a task for an agent |
| `begin_task` | 2 ✅ | Full coordination preflight — claim + session + context + contract risks |
| `reserve_files` | 2 ✅ | Reserve files for modification (with conflict detection) |
| `release_files` | 2 ✅ | Release file reservations |
| `report_progress` | 2 ✅ | Report progress on a task |
| `get_team_activity` | 2 ✅ | Get recent project activity feed |
| `get_active_file_reservations` | 2 ✅ | See all active file reservations in a project |
| `end_session` | 2 ✅ | End the current agent session |

---

## Future Agent Integration Strategy

The architecture is designed to support multiple agent integrations without modifying the core backend.

To add a new agent type:

1. Create an adapter in `apps/` (e.g. `apps/cursor-adapter`)
2. The adapter calls the same backend REST API
3. No changes to `apps/api` or `packages/` are required

Planned future integrations:

- Cursor via IDE plugin
- Claude Code via CLI adapter
- Generic REST SDK
- Custom enterprise agents

---

## Phase Roadmap

| Phase | Status | Features |
|---|---|---|
| **Phase 1** | ✅ Complete | Monorepo, Prisma schema, Fastify API, Next.js dashboard, seed data, 3 MCP tools |
| **Phase 2** | ✅ Complete | Task claiming, agent sessions, file reservations, conflict detection, progress reporting, coordination preflight, contract risk, activity feed, 8 new MCP tools |
| **Phase 3** | 🔜 Next | WebSocket/SSE realtime, request-review, task completion, dependent task unlocking |
| **Phase 4** | 🔜 Future | GitHub integration, PR tracking, branch association, richer agent integrations |

---

## Engineering Principles

1. Agent-agnostic architecture — Bob-specific logic only in adapters
2. Backend API owns all business logic
3. MCP is a thin adapter, not the business layer
4. PostgreSQL is the single source of truth
5. File reservations are soft warnings, never hard locks
6. Shared types from `@arxion/types` across all apps — never redefine locally
7. No unnecessary infrastructure for the MVP (no Redis, Kafka, queues)
8. Strict TypeScript throughout

---

## Contributing

See [AGENTS.md](./AGENTS.md) for the full architectural guide for coding agents working in this repository.
See [CURRENT_HANDOFF.md](./CURRENT_HANDOFF.md) for the living development handoff with implementation details.
