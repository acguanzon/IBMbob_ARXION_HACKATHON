# Phase 2 Handoff: Multi-Agent Collaboration and Coordination

## Objective

Phase 1 proved the shared architecture:

```text
Web App -> Backend API -> PostgreSQL
IBM Bob -> MCP Server -> Backend API -> Same PostgreSQL
```

Phase 2 must prove that multiple developers and multiple coding agents can coordinate work on the same project in real time.

The platform should now understand:

- who is working on what
- which agent is active
- what files an agent intends to modify
- whether active tasks overlap
- whether dependencies are unfinished
- whether an API, schema, model, type, or other contract change affects another active task
- what progress is being made
- whether an agent session is stale
- when coordination risks exist before Git conflicts happen

The strongest Phase 2 proof is:

> Two coding agents can detect overlapping or dependent work before those changes become a Git conflict.

---

## Product Direction

Move from:

```text
Task Awareness
+ Agent Awareness
+ File Awareness
```

toward:

```text
Task Awareness
+ Agent Awareness
+ File Awareness
+ Dependency Awareness
+ Contract Awareness
+ Change-Impact Awareness
```

IBM Bob 2.0 remains the first integration, but all business logic stays agent-agnostic in the backend.

---

## Core Architecture

```text
Human Developers
      |
      v
Collaboration Dashboard
      |
 REST + WebSocket
      |
      v
Coordination Backend
      |
      +-- Tasks
      +-- Agent Sessions
      +-- File Reservations
      +-- Dependencies
      +-- Contracts
      +-- Activity / Events
      |
      v
PostgreSQL
      |
      v
MCP Adapter
      |
      +--> IBM Bob
      +--> Other Agents
```

Rules:

1. Backend owns business rules.
2. PostgreSQL is the source of truth.
3. MCP is only an adapter.
4. Agent-specific logic stays outside the core backend.

---

# 1. Atomic Task Claiming

Implement:

```text
POST /tasks/:taskId/claim
POST /tasks/:taskId/release
```

Behavior:

```text
TODO
 -> Developer claims
 -> Atomic DB transaction
 -> assigneeId = developer
 -> status = IN_PROGRESS
 -> startedAt = now
 -> TaskActivity created
 -> Realtime event emitted
```

Two developers must never successfully claim the same task at the same time.

If a duplicate claim occurs:

```text
TASK_ALREADY_CLAIMED

Task:
T-102

Current owner:
Maki
```

MCP tool:

```text
claim_task(task_id)
```

---

# 2. Agent Sessions

Implement:

```text
POST /agent-sessions
PATCH /agent-sessions/:agentSessionId
POST /agent-sessions/:agentSessionId/heartbeat
POST /agent-sessions/:agentSessionId/end
GET /projects/:projectId/agent-sessions
```

Store:

- id
- projectId
- userId
- taskId
- agentType
- externalAgentId
- status
- startedAt
- lastSeenAt
- endedAt

Statuses:

```text
IDLE
WORKING
WAITING
FINISHED
STALE
```

Example:

```text
Developer: Maki
Agent: IBM Bob
Task: T-102 Build Login API
Status: WORKING
```

---

# 3. Heartbeat and Stale Session Handling

Use:

```text
Agent Session
+ Heartbeat
+ Expiry
```

Suggested behavior:

```text
Heartbeat every 20-30 seconds
Session stale after 60-90 seconds without heartbeat
```

If stale:

```text
WORKING -> STALE
```

Associated file reservations should expire automatically or enter a short grace period before release.

Never leave dead sessions or file reservations active indefinitely.

---

# 4. begin_task MCP Workflow

Create:

```text
begin_task(task_id)
```

This should perform the full collaboration preflight:

```text
Verify task
 -> Verify ownership
 -> Start/resume agent session
 -> Check dependencies
 -> Check active teammates
 -> Check file reservations
 -> Check declared contracts
 -> Return coordination context
```

Example response:

```text
Task:
T-102 Build Login API

Owner:
Maki

Dependencies:
T-101 DONE

Active teammates:
Alex -> T-110
Bea -> T-103

Active reservations:
src/models/User.ts -> Alex / T-110

Contract dependencies:
POST /api/login is consumed by T-103

Coordination status:
READY_WITH_WARNINGS
```

This makes safe coordination the default instead of requiring many manual MCP calls.

---

# 5. Work Intent Declaration

Before changing code, an agent should declare its intended work.

Implement:

```text
POST /tasks/:taskId/intent
GET /tasks/:taskId/intent
```

MCP:

```text
declare_work_intent
get_work_intent
```

Example:

```text
Task:
T-102

Files:
- src/auth/AuthController.ts
- src/auth/AuthService.ts

APIs:
- POST /api/login

Models:
- User

Contracts:
- LoginResponse

Summary:
Implement authentication and return token plus user profile.
```

This enables conflict detection before code is written.

---

# 6. Soft File Reservations

Implement:

```text
POST /tasks/:taskId/files/reserve
POST /tasks/:taskId/files/release
GET /projects/:projectId/files/active
```

MCP:

```text
reserve_files
release_files
get_active_file_reservations
```

Reservations are advisory, never hard locks.

Example:

```text
File:
src/auth/AuthService.ts

Developer:
Maki

Task:
T-102

Agent:
IBM Bob

Status:
ACTIVE
```

If another task wants the same file:

```text
CONFLICT

File:
src/auth/AuthService.ts

Currently associated with:
Maki

Task:
T-102

Agent:
IBM Bob
```

The second developer may continue.

---

# 7. Reservation Leases

Reservations must expire.

Suggested fields:

- id
- projectId
- taskId
- userId
- agentSessionId
- filePath
- status
- reservedAt
- leaseExpiresAt
- releasedAt

Statuses:

```text
ACTIVE
CONFLICT
RELEASED
EXPIRED
```

Flow:

```text
reserve file
 -> lease created
 -> heartbeat extends lease
 -> agent disappears
 -> lease expires
 -> reservation becomes EXPIRED
```

This prevents stale conflicts.

---

# 8. File Conflict Detection

For Phase 2, use exact normalized-path matching.

Normalize:

```text
src/auth/AuthService.ts
./src/auth/AuthService.ts
```

into one canonical path.

Flow:

```text
requested files
 -> normalize
 -> query active leases
 -> same project + same path?
 -> return overlaps
```

Do not attempt line-level conflict detection yet.

---

# 9. Task Dependency Awareness

Implement:

```text
GET /tasks/:taskId/dependencies
GET /tasks/:taskId/blockers
```

MCP:

```text
get_task_dependencies
get_task_blockers
```

Example:

```text
T-101 Database Schema
      |
      v
T-102 Login API
      |
      v
T-103 Login Frontend
```

If T-101 is unfinished:

```text
T-102
Status: BLOCKED
Reason: T-101 is not complete
```

Keep dependency logic simple and visible.

---

# 10. Contract Awareness

Allow tasks to declare contracts they:

- PROVIDE
- MODIFY
- CONSUME

Contract types:

```text
API
MODEL
SCHEMA
TYPE
EVENT
OTHER
```

Suggested model:

```text
TaskContract

id
projectId
taskId
type
name
relationship
metadata
createdAt
updatedAt
```

Example:

T-102:

```text
MODIFIES:
POST /api/login

PROVIDES:
LoginResponse
```

T-103:

```text
CONSUMES:
POST /api/login

CONSUMES:
LoginResponse
```

If both tasks are active, the system should detect an integration risk.

---

# 11. Contract Risk Detection

Initial detection should be simple and deterministic.

Example:

```text
Task A MODIFIES POST /api/login
Task B CONSUMES POST /api/login
```

Return:

```text
INTEGRATION_RISK

Source task:
T-102

Affected task:
T-103

Contract:
POST /api/login

Risk:
CONTRACT_CHANGE
```

This is a warning, not a hard error.

Do not attempt full semantic code analysis yet.

Manually or agent-declared contracts are enough for Phase 2.

---

# 12. Coordination Preflight

`begin_task()` should return a readable preflight report.

Example:

```text
TASK
T-103 Login Interface

DEPENDENCIES
OK: T-101 complete
WARNING: T-102 in progress

FILES
No direct overlap

CONTRACTS
POST /api/login

WARNING
T-102 is actively modifying POST /api/login.

RECOMMENDED COORDINATION
Frontend structure may proceed, but final API integration should wait for the contract to stabilize.
```

Every warning should explain:

- what overlaps
- which task caused it
- who owns it
- what file or contract is involved
- whether the developer may continue

---

# 13. Progress Reporting

Implement:

```text
POST /tasks/:taskId/progress
```

MCP:

```text
report_progress
```

Example:

```text
Authentication endpoint complete. Adding validation and tests.
```

Store progress in `TaskActivity`.

Avoid fake percentages in Phase 2.

Text progress is enough.

---

# 14. Team Activity Awareness

Implement:

```text
GET /projects/:projectId/activity
```

MCP:

```text
get_team_activity
```

Example:

```text
Maki
Task: T-102 Login API
Agent: IBM Bob
Status: WORKING
Files:
- AuthController.ts
- AuthService.ts
Contracts:
- POST /api/login

Alex
Task: T-110 User Model
Agent: IBM Bob
Status: WORKING
Files:
- User.ts
Contracts:
- User model
```

---

# 15. Realtime Events

Broadcast:

```text
task.claimed
task.released
task.started
task.progress
task.updated

agent.started
agent.heartbeat
agent.stale
agent.ended

file.reserved
file.released
file.conflict
file.expired

contract.declared
contract.risk_detected
```

For the hackathon, keep this lightweight.

Do not add Kafka, RabbitMQ, event sourcing, or similar infrastructure.

---

# 16. Frontend Upgrade

## Task Cards

Show:

```text
T-102
Build Login API

Maki
IBM Bob

IN PROGRESS

2 active files
1 contract
```

## Active Agents

```text
Maki
IBM Bob
T-102
Working

Alex
IBM Bob
T-110
Working
```

## Active Files

```text
AuthController.ts
Maki / T-102

AuthService.ts
Maki / T-102

User.ts
Alex / T-110
```

## Coordination Risks

```text
FILE OVERLAP

AuthService.ts

Maki / T-102
Alex / T-110
```

and:

```text
CONTRACT RISK

POST /api/login

T-102 modifies
T-103 consumes
```

## Activity Feed

```text
01:22 Maki claimed T-102
01:23 IBM Bob started T-102
01:24 AuthService.ts reserved
01:25 Alex started T-110
01:25 Contract risk detected
01:26 Maki reported progress
```

All should update without manual refresh.

---

# 17. MCP Tools Required by End of Phase 2

Required:

```text
get_task
claim_task
begin_task
get_task_dependencies
get_task_blockers
get_team_activity
declare_work_intent
get_active_file_reservations
reserve_files
release_files
report_progress
heartbeat
end_task_session
```

Optional if time permits:

```text
get_coordination_risks
```

---

# 18. Agent Workflow

Normal flow:

```text
Developer:
Work on T-102.
```

Agent:

```text
begin_task(T-102)
 -> receive preflight
 -> inspect task
 -> declare work intent
 -> reserve files
 -> review warnings
 -> implement
 -> report progress
 -> send heartbeat
 -> run tests
 -> release unused files
 -> end session
```

Review automation belongs mainly to Phase 3.

---

# 19. AGENTS.md Update

Add:

## Collaboration Rules

Before modifying code:

1. Begin the active task.
2. Verify ownership.
3. Review dependencies.
4. Review team activity.
5. Declare intended work.
6. Declare important contracts.
7. Reserve intended files.
8. Read all coordination warnings.
9. Never assume no file overlap means no integration risk.

During development:

10. Maintain heartbeat.
11. Report meaningful progress.
12. Update intent if scope changes.
13. Report newly discovered dependencies.
14. Re-check risks when changing public APIs, schemas, or shared types.

When stopping:

15. Release files no longer needed.
16. End the active session.
17. Never intentionally leave stale reservations.

---

# 20. Concurrency Requirements

Use database transactions or atomic conditional operations for:

- task claims
- active reservation creation
- session start
- reservation release
- task state transitions

Do not rely on frontend checks.

The backend is authoritative.

---

# 21. Scope Expansion Detection

If an agent declares:

```text
AuthService.ts
```

but later expands to:

```text
AuthService.ts
User.ts
Database.ts
```

the agent should update intent and reservations.

Record:

```text
SCOPE_EXPANSION

Task:
T-102

New file:
User.ts
```

Do not block it. Run the normal conflict check and activity logging.

---

# 22. Main Demo Scenario

## Developer A

Claims:

```text
T-102 Build Login API
```

Bob calls:

```text
begin_task(T-102)
```

Bob declares:

```text
Files:
- AuthController.ts
- AuthService.ts

Contracts:
MODIFIES POST /api/login
PROVIDES LoginResponse
```

Bob reserves those files.

Dashboard shows:

```text
Maki
IBM Bob
T-102
WORKING
```

## Developer B

Claims:

```text
T-103 Build Login Frontend
```

Their agent calls:

```text
begin_task(T-103)
```

The system sees:

```text
T-103 CONSUMES:
POST /api/login
LoginResponse
```

The system returns:

```text
COORDINATION WARNING

T-102 is actively modifying:
POST /api/login

T-103 consumes:
POST /api/login

Owner of T-102:
Maki

Recommendation:
Frontend structure may proceed, but final integration should wait until the login contract is stable.
```

This proves semantic coordination even when the agents edit different files.

Optional second step:

Developer B also tries to reserve:

```text
AuthService.ts
```

System returns:

```text
FILE CONFLICT

AuthService.ts is currently reserved by:
Maki / T-102
```

Now the demo proves both:

- file overlap awareness
- cross-task contract awareness

---

# 23. Testing Requirements

## Task Claiming

Test:

- successful claim
- duplicate claim
- concurrent claim
- release
- invalid task

## Agent Sessions

Test:

- start
- heartbeat
- end
- stale detection

## File Reservations

Test:

- reserve one file
- reserve multiple files
- normalized paths
- overlap warning
- release
- expiry

## Dependencies

Test:

- complete dependency
- incomplete dependency
- multiple dependencies

## Contracts

Test:

- provider + consumer
- modifier + consumer
- unrelated contracts
- active risk detection

## Realtime

Verify important events are emitted correctly.

---

# 24. Non-Goals

Do not spend Phase 2 on:

- full GitHub synchronization
- pull-request automation
- advanced code review
- automatic merges
- full semantic static analysis
- AST-level dependency analysis
- line-level collaborative editing
- Kubernetes
- Kafka
- enterprise RBAC
- billing
- time tracking
- complex project-management features

The coordination engine is the priority.

---

# 25. Recommended Implementation Order

```text
1. Atomic Task Claiming
2. Agent Sessions
3. Heartbeat + Stale Detection
4. begin_task MCP Preflight
5. Work Intent Declaration
6. File Reservations
7. Reservation Leases
8. File Conflict Detection
9. Task Dependency Awareness
10. Basic Contract Model
11. Contract Risk Detection
12. Progress Reporting
13. Activity Feed
14. Realtime WebSocket Events
15. Frontend Coordination Panels
16. End-to-End Multi-Agent Testing
```

Build behavior first, visual polish later.

---

# 26. Definition of Done

Phase 2 is complete when this works reliably:

```text
Developer A claims Task A
 -> Agent A begins task
 -> Agent A receives dependency/team preflight
 -> Agent A declares work intent
 -> Agent A reserves files
 -> Agent A declares an API contract change
 -> Developer B claims Task B
 -> Agent B begins task
 -> System recognizes Task B consumes that API
 -> Agent B receives contract warning
 -> Agent B tries one overlapping file
 -> System detects file conflict
 -> Both dashboards update in real time
 -> Agent A reports progress
 -> Activity feed updates
 -> Heartbeat remains active
 -> Agent stops
 -> Reservations release or expire
 -> No stale activity remains
```

---

# Phase 2 Core Differentiator

The product must not stop at:

> Two agents are editing the same file.

The stronger capability is:

> Two agents are editing different files, but one task changes a contract the other task depends on, and the system detects that risk before integration.

That is the main Phase 2 differentiator.

---

# One-Line Phase 2 Goal

**Make coding agents aware not only of shared files, but also shared development intent, dependencies, and contracts before conflicts reach Git.**
