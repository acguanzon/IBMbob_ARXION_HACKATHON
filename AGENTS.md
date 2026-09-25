# AGENTS.md

This file is for AI coding agents operating in the Arxion repository.

Read this file before making any changes to the codebase.

---

## Project Purpose

Arxion is an agent-agnostic collaboration and coordination platform for software development teams
that use AI coding agents.

The platform does not replace an IDE, a coding agent, or Git.

Its role is to give human developers and their AI coding agents shared awareness of:

- what project they are working on
- what tasks exist and who owns them
- what task is currently in progress
- which files are being modified by which agent
- what tasks depend on other tasks
- where potential conflicts exist
- what progress has been made
- what work is ready for review

IBM Bob 2.0 is the first coding agent integrated with the platform.

The architecture must remain compatible with other agentic coding tools (Cursor, Claude Code, etc.)
through MCP, REST APIs, CLI adapters, SDKs, and plugins.

---

## Repository Structure

```
/
├── apps/
│   ├── api/            — Fastify REST API (Node.js + TypeScript)
│   ├── web/            — Next.js collaboration dashboard
│   └── mcp-server/     — MCP adapter for AI coding agents
│
├── packages/
│   ├── database/       — Prisma schema, client, migrations, seed
│   ├── types/          — Shared Zod schemas and TypeScript types
│   └── config/         — Shared configuration utilities
│
├── docs/               — Architecture documentation
├── AGENTS.md           — This file
├── HANDOFF.md          — Project context and background
└── README.md           — Setup and usage
```

---

## Architectural Rules

Follow these rules strictly when making any change to this codebase.

### 1. The platform must remain agent-agnostic

Do not place IBM Bob-specific business logic inside the core backend API or shared packages.

Agent-specific behavior belongs in adapters.

### 2. Agent-specific integrations belong in adapters

The `apps/mcp-server` is the MCP adapter for coding agents.

It is not the business logic layer.

If you need to support a new agent type, add an adapter — do not modify the core backend.

### 3. MCP is an adapter, not the business-logic layer

The MCP server (`apps/mcp-server`) must:

- receive tool calls from the coding agent
- translate them into backend REST API calls
- return the response to the agent

The MCP server must NOT:

- import or use `@arxion/database` or Prisma directly
- contain business rules or validation logic beyond basic input sanitization
- access PostgreSQL in any way

### 4. The backend API owns business rules

All business logic lives in `apps/api`.

Validation uses Zod.

The service layer enforces business rules.

Routes are thin controllers.

### 5. PostgreSQL is the source of truth

All collaboration state is stored in and retrieved from PostgreSQL through Prisma.

Do not introduce Redis, in-memory state, or other stores for primary collaboration data.

### 6. File reservations are advisory — never hard locks

`TaskFileReservation` records are soft reservations.

The system warns about potential conflicts.

It does not prevent a second agent or developer from working on the same file.

Do not introduce file locking, pessimistic locking, or blocking behavior.

### 7. Shared domain contracts must be reused across applications

Zod schemas and TypeScript types are defined in `packages/types`.

The backend, frontend, and MCP server must import types from `@arxion/types`.

Do not redefine core types locally inside individual apps.

### 8. Prefer straightforward architecture over premature enterprise abstractions

This is a hackathon MVP.

Do not introduce factory patterns, decorators, dependency injection containers, or similar
complexity unless there is a clear, immediate need.

### 9. Do not introduce unnecessary infrastructure

Do not introduce:

- Kafka or RabbitMQ
- Redis (unless there is a clearly justified need)
- Kubernetes or Docker Swarm
- Distributed locks
- Complex event sourcing
- Microservices

The realtime layer uses Socket.IO emitting events directly to connected clients.

---

## Collaboration Agent Workflow

This is the intended agent workflow. Not all steps are implemented in Phase 1.

```
Developer claims a task on the web dashboard
      ↓
Developer tells the coding agent: "Work on T-102"
      ↓
Agent calls:  get_task("T-102")
      ↓
Platform returns: title, description, status, assignee, dependencies, team activity
      ↓
Agent calls:  get_task_dependencies("T-102")
      ↓
Agent determines which files it will modify
      ↓
Agent calls:  reserve_files(...)
      ↓
Platform checks for active overlapping reservations
      ↓
If conflict: platform returns a warning (agent may still proceed)
If clear:    reservation is created
      ↓
Agent works on the task
      ↓
Agent calls:  report_progress(...)
      ↓
Agent runs tests
      ↓
Agent calls:  request_review(...)
      ↓
Human reviews the work
      ↓
Agent calls:  release_files(...)
      ↓
Agent calls:  complete_task(...)
      ↓
Dependent tasks are unblocked
```

---

## MCP Tools

Available in Phase 1:

| Tool | Status | Description |
|------|--------|-------------|
| `get_task` | ✅ Implemented | Retrieve task details and context |
| `get_project_context` | ✅ Implemented | Retrieve project info and members |
| `get_task_dependencies` | ✅ Implemented | Get dependency list for a task |
| `claim_task` | 🔜 Phase 2 | Claim a task for yourself |
| `start_task` | 🔜 Phase 2 | Start an agent session and begin work |
| `get_team_activity` | 🔜 Phase 2 | Get recent project activity |
| `get_active_file_reservations` | 🔜 Phase 2 | See active file reservations |
| `reserve_files` | 🔜 Phase 2 | Reserve files for modification |
| `release_files` | 🔜 Phase 2 | Release file reservations |
| `report_progress` | 🔜 Phase 2 | Report progress on a task |
| `request_review` | 🔜 Phase 3 | Request human review |
| `complete_task` | 🔜 Phase 3 | Mark task as completed |

---

## Environment Variables

Required variables — see `.env.example` for the full list.

| Variable | App | Description |
|----------|-----|-------------|
| `DATABASE_URL` | api | PostgreSQL connection string |
| `PORT` | api | API server port (default: 3001) |
| `NEXT_PUBLIC_API_URL` | web | Backend URL for the frontend |
| `MCP_API_BASE_URL` | mcp-server | Backend URL for MCP server |
| `MCP_API_KEY` | mcp-server | Optional API key for internal calls |

---

## Phase Map

| Phase | Focus |
|-------|-------|
| Phase 1 | Foundation: monorepo, schema, API, dashboard, `get_task` MCP tool |
| Phase 2 | Task claiming, agent sessions, file reservations, conflict detection |
| Phase 3 | Reviews, dependency blocking, task completion, file release |
| Phase 4 | GitHub integration, PR tracking, richer agent integrations |

---

## Do Not

- Do not access the database from `apps/mcp-server`
- Do not duplicate Zod schemas — import from `@arxion/types`
- Do not use `any` in TypeScript unless unavoidable and commented
- Do not add infrastructure (Redis, Kafka, queues) without a clear requirement
- Do not put agent-specific logic in `apps/api`
- Do not hard-lock files — file reservations are always advisory
