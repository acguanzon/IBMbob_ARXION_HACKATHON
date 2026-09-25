# Project Handoff: Agentic Coding Collaboration Platform

## Project Summary

We are building an agent-agnostic collaboration and coordination platform for software development teams using AI coding agents.

The platform does not replace an IDE, coding agent, Git, or GitHub. Its purpose is to provide a shared coordination layer so human developers and their AI agents can understand what the rest of the team is doing.

IBM Bob 2.0 will be the first coding agent used for the hackathon implementation, but the platform must remain compatible with other agentic coding tools through MCP, REST APIs, CLI adapters, SDKs, or plugins.

## Core Problem

Modern AI coding agents are strong at understanding and modifying code, but they usually work with limited awareness of the broader development team.

When multiple developers and coding agents work on the same project, they may not know:

- who is working on what
- which task each developer owns
- which files another agent is currently modifying
- whether two agents are about to work on the same file
- whether a required dependency is unfinished
- whether another task is changing an API, model, or schema they depend on
- what work is ready for review

Teams currently compensate for this using separate tools such as GitHub, Jira, Trello, Slack, and manual communication.

This creates context switching, duplicated work, merge conflicts, integration problems, and unnecessary rework.

## Proposed Solution

Create a shared collaboration layer between developers and their AI coding agents.

The platform acts as the shared project brain and keeps track of:

- projects
- team members
- tasks
- task ownership
- task status
- task dependencies
- agent sessions
- files currently being worked on
- possible file conflicts
- progress updates
- reviews
- Git branches and pull requests later

Coding agents can query and update this shared project state while they work.

## Core Product Principle

Any coding agent can understand the code.

Our platform gives every coding agent a shared understanding of the team.

The coding agent writes the code.

Git stores and versions the code.

Our platform coordinates the work.

## High-Level Architecture

Human workflow:

```text
Human Developer
      ↓
Web Collaboration App
      ↓
Backend REST API
      ↓
PostgreSQL
```

Agent workflow:

```text
IBM Bob / Other Coding Agent
      ↓
MCP Server
      ↓
Backend REST API
      ↓
Same PostgreSQL
```

Version control:

```text
Developer / Coding Agent
      ↓
Git
      ↓
GitHub / GitLab
```

The most important architectural rule is:

**Humans and AI agents must operate on the same shared source of truth.**

## Why MCP Exists

MCP means Model Context Protocol.

For this project, MCP acts as the bridge between a coding agent and the collaboration platform.

Example:

```text
Developer:
"Work on T-103."

IBM Bob
      ↓
get_task("T-103")
      ↓
MCP Server
      ↓
Backend API
      ↓
PostgreSQL
```

The backend returns the task information to Bob.

The MCP server must not contain the main business logic and should not directly access PostgreSQL.

Correct:

```text
Agent
  ↓
MCP Server
  ↓
Backend API
  ↓
Database
```

Incorrect:

```text
Agent
  ↓
MCP Server
  ↓
Database
```

The backend owns the business rules.

MCP is only an agent-facing adapter.

## Agent-Agnostic Design

IBM Bob 2.0 is the first integration, not the product itself.

The platform should later support:

- IBM Bob
- other MCP-compatible coding agents
- Cursor or similar tools where integration is possible
- Claude Code or similar CLI agents
- IDE plugins
- custom enterprise coding agents
- REST API integrations
- CLI adapters
- SDKs

Agent-specific logic should remain outside the core backend.

## Main Development Workflow

1. A developer opens the collaboration platform.
2. The developer selects a project.
3. The project task board is displayed.
4. The developer claims a task.
5. The task becomes assigned and moves into progress.
6. The developer opens IBM Bob or another coding agent.
7. The developer says something simple such as:

```text
Work on T-103.
```

8. The coding agent calls `get_task(T-103)` through MCP.
9. The agent receives:
   - task title
   - task description
   - acceptance criteria
   - assignee
   - dependencies
   - project context
   - active team activity
   - active file reservations
10. The agent creates a plan.
11. The agent identifies the files it expects to modify.
12. The agent calls `reserve_files(...)`.
13. The backend checks for overlapping active reservations.
14. If no overlap exists, the agent proceeds.
15. If an overlap exists, the platform returns a conflict warning.
16. The agent works on the task.
17. The agent reports progress.
18. The agent runs tests.
19. The agent requests review.
20. The task moves from `IN_PROGRESS` to `REVIEW`.
21. A human teammate reviews the work.
22. The code is merged through Git.
23. The task becomes `DONE`.
24. Dependent tasks can continue.

## Task Statuses

Initial task statuses:

- BACKLOG
- TODO
- IN_PROGRESS
- BLOCKED
- REVIEW
- DONE

## File Reservation Model

The system must use **soft file reservations**, not hard file locking.

Example:

```text
File:
src/auth/AuthService.ts

Developer:
Maki

Task:
T-103

Agent:
IBM Bob

Status:
ACTIVE
```

If another agent wants to modify the same file, the platform returns a warning.

Example:

```text
Potential conflict detected.

File:
src/auth/AuthService.ts

Currently associated with:
Maki

Task:
T-103

Agent:
IBM Bob
```

The second developer may still continue.

The platform provides awareness, not forced blocking.

## Task Dependency Awareness

Tasks may depend on other tasks.

Example:

```text
T-101
Create User Database Schema
      ↓
T-102
Build Login API
      ↓
T-103
Integrate Login Frontend
```

If T-101 is unfinished, T-102 may be marked blocked.

If T-102 is still in progress, T-103 can know that its required backend API is not yet ready.

## Agent Sessions

Each active coding-agent session should be associated with:

- project
- user
- task
- agent type
- status
- start time
- last seen time
- end time

Example:

```text
Developer:
Maki

Agent:
IBM Bob

Task:
T-103 Login API

Status:
WORKING
```

Another developer may use a different agent and still interact with the same project state.

## Project Dashboard

The initial dashboard should contain:

### Left Sidebar

- project list
- current project
- team members

### Main Area

Kanban-style task board:

- Backlog
- Todo
- In Progress
- Review
- Done

### Right Sidebar

- project activity
- active coding agents
- active file reservations
- conflict warnings

## Core Data Models

Initial entities:

### User
- id
- name
- email
- createdAt
- updatedAt

### Project
- id
- name
- description
- repositoryUrl
- createdById
- createdAt
- updatedAt

### ProjectMember
- id
- projectId
- userId
- role
- joinedAt

### Task
- id
- projectId
- displayId
- title
- description
- status
- priority
- assigneeId
- createdById
- createdAt
- updatedAt
- startedAt
- completedAt

### TaskDependency
- id
- taskId
- dependsOnTaskId
- createdAt

### TaskFileReservation
- id
- projectId
- taskId
- userId
- agentSessionId
- filePath
- status
- reservedAt
- releasedAt

### AgentSession
- id
- projectId
- userId
- taskId
- agentType
- externalAgentId
- status
- startedAt
- endedAt
- lastSeenAt

### TaskActivity
- id
- projectId
- taskId
- userId
- agentSessionId
- type
- message
- metadata
- createdAt

### Review
- id
- taskId
- reviewerId
- status
- comment
- createdAt
- updatedAt

## Technology Direction

Recommended stack:

### Frontend
- Next.js
- React
- TypeScript
- Tailwind CSS

### Backend
- Node.js
- TypeScript
- Fastify

### Database
- PostgreSQL
- Prisma ORM

### Validation
- Zod

### Realtime
- WebSockets
- Socket.IO

### Agent Integration
- MCP server in TypeScript

### Version Control
- Git
- GitHub integration later

### Repository
- pnpm monorepo

## Suggested Repository Structure

```text
/
├── apps/
│   ├── web/
│   ├── api/
│   └── mcp-server/
│
├── packages/
│   ├── database/
│   ├── shared/
│   ├── types/
│   └── config/
│
├── docs/
│
├── AGENTS.md
├── HANDOFF.md
├── README.md
├── package.json
├── pnpm-workspace.yaml
└── .env.example
```

## Backend API Direction

Initial endpoints should include:

### Health

```text
GET /health
```

### Projects

```text
POST /projects
GET /projects
GET /projects/:projectId
```

### Members

```text
GET /projects/:projectId/members
```

### Tasks

```text
POST /projects/:projectId/tasks
GET /projects/:projectId/tasks
GET /tasks/:taskId
PATCH /tasks/:taskId

POST /tasks/:taskId/claim
POST /tasks/:taskId/start
POST /tasks/:taskId/progress
POST /tasks/:taskId/request-review
POST /tasks/:taskId/complete
```

### Dependencies

```text
GET /tasks/:taskId/dependencies
```

### File Reservations

```text
POST /tasks/:taskId/files/reserve
POST /tasks/:taskId/files/release

GET /projects/:projectId/files/active
```

### Activity

```text
GET /projects/:projectId/activity
```

### Agent Sessions

```text
POST /agent-sessions
PATCH /agent-sessions/:agentSessionId
GET /projects/:projectId/agent-sessions
```

## Initial MCP Tools

Planned tools:

- `get_project_context`
- `get_task`
- `claim_task`
- `start_task`
- `get_task_dependencies`
- `get_team_activity`
- `get_active_file_reservations`
- `reserve_files`
- `release_files`
- `report_progress`
- `request_review`
- `complete_task`

The first MCP tool to implement should be:

```text
get_task(task_id)
```

This proves that the full agent path works:

```text
IBM Bob
    ↓
MCP
    ↓
Backend API
    ↓
PostgreSQL
```

## Realtime Events

The backend should eventually broadcast events such as:

```text
task.created
task.claimed
task.started
task.updated
task.progress
task.review_requested
task.completed

file.reserved
file.released
file.conflict

agent.started
agent.updated
agent.ended

member.joined
```

For the hackathon, keep this lightweight.

Do not introduce Kafka, RabbitMQ, distributed event sourcing, or other unnecessary infrastructure.

## Phase 1 MVP

The first implementation phase should prove the architecture.

Build:

- pnpm monorepo
- Next.js web app
- Fastify API
- PostgreSQL database
- Prisma schema
- shared TypeScript/Zod contracts
- MCP server
- project creation/listing
- task creation/listing
- Kanban dashboard
- seed project
- `get_task` MCP tool
- README
- AGENTS.md

Seed example:

```text
Project:
CollabAI Demo

Members:
Maki
Alex
Bea

Tasks:

T-101
Create User Schema

T-102
Build Login API

T-103
Create Login Interface

Dependency:
T-102 depends on T-101
```

The critical Phase 1 proof:

```text
Web App
   ↓
Backend API
   ↓
PostgreSQL
```

and:

```text
IBM Bob
   ↓
MCP
   ↓
Backend API
   ↓
Same PostgreSQL
```

The same task should be retrievable through both the web/API path and the MCP path.

## Phase 2

After Phase 1 works:

- task claiming
- task starting
- agent sessions
- file reservations
- file conflict detection
- progress reporting
- realtime updates

## Phase 3

Then implement:

- reviews
- dependency blocking
- task completion
- file release
- dependent task unlocking

## Phase 4

Later additions may include:

- GitHub API integration
- branch association
- pull requests
- commit tracking
- merge tracking
- project-level coordination agent
- cross-agent dependency detection
- richer activity summaries
- more agent integrations

## Strongest Hackathon Demo

Demonstrate two developers working at the same time.

Developer A claims:

```text
T-103 Authentication API
```

IBM Bob retrieves the task through MCP.

Bob reports that it plans to modify:

```text
AuthController.ts
AuthService.ts
```

The platform creates soft reservations.

Developer B starts another task.

Developer B's coding agent also wants to modify:

```text
AuthService.ts
```

The collaboration platform detects the overlap.

Developer B's agent receives:

```text
Potential conflict detected.

AuthService.ts is currently being worked on by Maki for T-103.
```

The second agent can adapt its plan.

Developer A finishes.

Bob requests review.

The dashboard changes:

```text
IN_PROGRESS → REVIEW
```

This demo shows the core value of the platform without needing to rebuild an IDE or GitHub.

## Product Positioning

Do not present the product as:

> Jira inside an AI coding tool.

Present it as:

> A shared coordination layer for human developers and AI coding agents.

The key innovation is **shared agent awareness**.

The platform helps coding agents understand:

- what their developer is doing
- what teammates are doing
- what other agents are doing
- which files are currently active
- what tasks depend on each other
- what might conflict before code is merged
- what is ready for review

## Core Product Statement

We are building an agent-agnostic collaboration layer for AI-assisted software development.

The coding agents write the code.

Git versions the code.

Our platform coordinates the work.

It answers:

- Who is working on what?
- Which agent is working on it?
- Which files are being touched?
- What depends on what?
- What may conflict?
- What is blocked?
- What is ready for review?

## Short Pitch

Modern AI coding agents are powerful, but they largely work in isolation.

Our platform gives developers and their coding agents a shared project context so everyone knows who is working on what, which files are being changed, what tasks depend on each other, and where conflicts may occur.

Instead of replacing coding agents, we make them collaborate.

IBM Bob 2.0 is our first integration, but the system is designed to support other compatible agentic coding tools.

## One-Line Pitch

**Any coding agent can understand your code. We give every coding agent a shared understanding of your team.**

## Important Engineering Principles

1. Remain agent-agnostic.
2. Keep IBM Bob-specific behavior out of the core backend.
3. Backend API owns business logic.
4. PostgreSQL is the shared source of truth.
5. MCP acts only as an adapter.
6. Do not let the MCP server directly access the database.
7. File reservations are soft warnings, not hard locks.
8. Keep the MVP simple and reliable.
9. Avoid unnecessary infrastructure.
10. Build the coordination layer, not another IDE.
