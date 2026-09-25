<<<<<<< HEAD
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
COLLABORATION WEB APP (Next.js)
      │
    REST API
      │
      ▼
BACKEND APPLICATION (Fastify)
      │
      ├────────────────┐
      ▼                ▼
 PostgreSQL      Realtime Events
                       │
                       ▼
                  Web Clients


CODING AGENTS (IBM Bob, etc.)
      │
      ▼
MCP SERVER (adapter only)
      │
      ▼
BACKEND APPLICATION
      │
      ▼
PostgreSQL (same database)
```

**The most important rule:** humans and AI agents share one source of truth — PostgreSQL, accessed through the backend API.

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
├── AGENTS.md           — Guide for AI coding agents in this repo
├── HANDOFF.md          — Project context and background
└── README.md           — This file
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, React, TypeScript, Tailwind CSS |
| Backend | Node.js, TypeScript, Fastify |
| Database | PostgreSQL, Prisma ORM |
| Validation | Zod |
| Realtime | Socket.IO (Phase 2) |
| Agent bridge | MCP server (TypeScript) |
| Monorepo | pnpm workspaces |

---

## Prerequisites

- Node.js >= 20
- pnpm >= 9
- PostgreSQL running locally (or via Docker)

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

Edit `.env` and fill in your values. The minimum required:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/arxion_dev"
```

### 4. Set up the database

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

```bash
cd apps/mcp-server
pnpm dev
```

The MCP server runs on stdio (spawned by the MCP host).

---

## Environment Variables

See `.env.example` for the complete list.

| Variable | App | Required | Description |
|---|---|---|---|
| `DATABASE_URL` | api | ✅ | PostgreSQL connection string |
| `PORT` | api | — | API port (default: 3001) |
| `NODE_ENV` | api | — | `development` or `production` |
| `CORS_ORIGIN` | api | — | Allowed origin (default: http://localhost:3000) |
| `NEXT_PUBLIC_API_URL` | web | — | Backend URL for the browser (default: http://localhost:3001) |
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

### Lifecycle (Phase 2+)

```
POST   /tasks/:taskId/claim
POST   /tasks/:taskId/start
POST   /tasks/:taskId/progress
POST   /tasks/:taskId/request-review
POST   /tasks/:taskId/complete
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
PATCH  /agent-sessions/:agentSessionId
GET    /projects/:projectId/agent-sessions
```

---

## MCP Integration

The MCP server allows AI coding agents (IBM Bob, Cursor, Claude Code, etc.) to interact with the collaboration platform.

### How it works

```
AI Agent (IBM Bob)
      │
  get_task("T-102")
      │
      ▼
MCP Server (apps/mcp-server)
      │
  GET /tasks/T-102
      │
      ▼
Backend API (apps/api)
      │
      ▼
PostgreSQL
      │
      ▼
Task returned to IBM Bob
```

### Configuring IBM Bob

Add this to your Bob `mcp.json`:

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

Build the MCP server first:

```bash
cd apps/mcp-server
pnpm build
```

### Available MCP Tools (Phase 1)

| Tool | Description |
|---|---|
| `get_task` | Retrieve a task by display ID (e.g. T-102) or internal ID |
| `get_project_context` | Retrieve project info, members, and task count |
| `get_task_dependencies` | Get the dependency list for a task |

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

| Phase | Features |
|---|---|
| **Phase 1** ✅ | Monorepo, Prisma schema, Fastify API, Next.js dashboard, seed data, `get_task` MCP tool |
| **Phase 2** | Task claiming, agent sessions, file reservations, conflict detection, progress reporting, realtime |
| **Phase 3** | Reviews, dependency blocking, task completion, file release, dependent task unlocking |
| **Phase 4** | GitHub integration, PR tracking, branch association, richer agent integrations |

---

## Engineering Principles

1. Agent-agnostic architecture
2. Backend API owns business logic
3. MCP is an adapter, not the business layer
4. PostgreSQL is the single source of truth
5. File reservations are soft warnings, not hard locks
6. Shared types from `@arxion/types` across all apps
7. No unnecessary infrastructure for the MVP
8. Strict TypeScript throughout

---

## Contributing

See [AGENTS.md](./AGENTS.md) for the full architectural guide for coding agents working in this repository.
=======
# IBMbob_ARXION_HACKATHON
>>>>>>> 0aa814e940fd5d28ed501ed2aa84e73e4c9bde5f
