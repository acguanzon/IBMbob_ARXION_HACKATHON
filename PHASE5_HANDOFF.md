# PHASE 5 HANDOFF
# Reliable Multi-Agent Handoffs, Context Delivery, Recovery, and Safe Parallel Work

## Phase 5 Objective

Phase 1 established shared project state.

```text
Web App -> Backend API -> PostgreSQL
IBM Bob -> MCP -> Backend API -> Same PostgreSQL
```

Phase 2 established live multi-agent coordination.

```text
Task Claim
-> Agent Session
-> Work Intent
-> File Reservation
-> Dependency Awareness
-> Contract Awareness
-> Realtime Coordination
```

Phase 3 established trusted review and completion.

```text
Completion Report
-> Review Snapshot
-> Human Approval
-> Revision Binding
-> Merge Readiness
-> Merge Confirmation
-> DONE
-> Dependency Unlocking
```

Phase 4 established Git-verified change intelligence.

```text
Git Change
-> Deterministic Analysis
-> Impact Graph
-> Coordination Risk
-> Context Update
-> Affected Agent
```

Phase 5 must make continuation between tasks and agents reliable.

The core goal is:

> When one task, agent, or developer stops, finishes, or becomes blocked, the next agent should receive exactly the technical context it needs to continue safely without manually reconstructing the project state.

Phase 5 focuses on four capabilities:

1. Structured task handoffs
2. Relevant context packages
3. Agent/session recovery
4. Safe parallel-work identification

Do not expand Phase 5 into autonomous project management.

---

# 1. Phase 5 Product Principle

The platform already knows:

- task state
- dependencies
- active contracts
- Git revisions
- actual changes
- risks
- decisions
- reviews
- active agents

Phase 5 should use this information to create reliable transitions between pieces of work.

The core loop becomes:

```text
Task / Agent State Changes
        ↓
Relevant Context Recalculated
        ↓
Handoff or Recovery Package Created
        ↓
Affected Agent Receives Package
        ↓
Agent Acknowledges Context
        ↓
Work Continues Safely
```

The system should not attempt to make every project decision automatically.

Humans remain in control.

---

# 2. Core Architecture

```text
                         DEVELOPERS
                              │
                              ▼
                   COLLABORATION PLATFORM
                              │
                              ▼
                     COORDINATION BACKEND
                              │
      ┌───────────────────────┼────────────────────────┐
      │                       │                        │
      ▼                       ▼                        ▼
 Task Readiness         Context Engine          Recovery Engine
      │                       │                        │
      ├────────────── Handoff Engine ─────────────────┤
      │                       │                        │
      └──────────── Parallel Safety Engine ────────────┘
                              │
                              ▼
                          PostgreSQL
                              │
                   ┌──────────┴──────────┐
                   ▼                     ▼
               MCP Layer             Git Provider
                   │
          ┌────────┼─────────┐
          ▼        ▼         ▼
       IBM Bob   Agent B   Agent C
```

Rules:

1. Backend remains authoritative.
2. Context packages are generated from structured project facts.
3. AI may summarize context but must not invent task relationships.
4. Handoffs must be auditable.
5. Recovery must be deterministic where possible.
6. Parallel-work safety must be based on actual dependency and impact data.
7. Human assignment decisions remain human-controlled.

---

# 3. Task Readiness Engine

Introduce a derived readiness state separate from normal task status.

Normal task status may remain:

```text
BACKLOG
TODO
IN_PROGRESS
BLOCKED
REVIEW
DONE
```

Add derived readiness:

```text
READY
BLOCKED_BY_DEPENDENCY
AT_RISK
WAITING_FOR_REVIEW
WAITING_FOR_CONTEXT
INTERRUPTED
```

Readiness should be calculated, not manually typed.

Suggested calculation considers:

```text
Task dependencies
Active blockers
Active contract risks
Unacknowledged critical context updates
Review state
Agent/session state
Git branch state
```

Example:

```text
Task:
T-103 Login Frontend

Status:
TODO

Readiness:
AT_RISK

Reason:
T-102 changed LoginResponse and the update has not yet been acknowledged.
```

Another:

```text
Task:
T-109 Logging

Status:
TODO

Readiness:
READY

Reason:
No unresolved dependencies or active coordination risks.
```

---

# 4. Readiness Explanation

Every readiness state must have structured reasons.

Create:

```text
TaskReadinessEvaluation
```

Suggested fields:

```text
id
taskId
state
reasons
evaluatedAt
sourceRevision
```

Example:

```text
READY

Reasons:
- All dependencies complete
- No HIGH or CRITICAL coordination risks
- Required contracts available
- No blocking review dependency
```

Avoid unexplained labels.

---

# 5. Structured Task Handoffs

Create:

```text
TaskHandoff
```

A handoff represents technical context passed from completed/upstream work to dependent/downstream work.

Suggested fields:

```text
id
projectId
sourceTaskId
targetTaskId
sourceRevision
status
summary
createdAt
acknowledgedAt
acknowledgedByAgentSessionId
```

Statuses:

```text
PENDING
DELIVERED
ACKNOWLEDGED
SUPERSEDED
```

A handoff should be created automatically when:

```text
upstream task completes
AND
downstream task depends on or consumes output from it
```

---

# 6. Handoff Payload

Do not send raw project history.

Create a structured payload.

Example:

```text
HANDOFF

From:
T-102 Login API

To:
T-103 Login Frontend

Completed Revision:
a981cc2

Final Contracts:
- POST /api/login
- LoginResponse v3

Relevant Decisions:
- JWT authentication
- token expiry = 1 hour

Relevant Changes:
- LoginResponse now includes user object

Resolved Risks:
- API response shape stabilized

Remaining Risks:
- none

Recommended Next Check:
Validate frontend integration against LoginResponse v3
```

This is the ideal handoff.

---

# 7. Handoff Context Selection

Only include context relevant to the target task.

Use structured relationships:

```text
Task Dependency
Contract Consumption
Code Entity Relationship
Project Decision Scope
Coordination Risk Relationship
```

Do not include:

- unrelated project events
- irrelevant files
- unrelated reviews
- unrelated task history

The goal is high signal, low noise.

---

# 8. Handoff MCP Tools

Add:

```text
get_task_handoffs(task_id)
get_handoff(handoff_id)
acknowledge_handoff(handoff_id)
```

`begin_task()` should return pending handoffs automatically.

Example:

```text
PENDING HANDOFF

T-102 -> T-103

Final Contract:
LoginResponse v3

Revision:
a981cc2

Acknowledgement Required:
YES
```

---

# 9. Handoff Acknowledgement

Critical handoffs should require acknowledgement.

Example:

```text
acknowledge_handoff(H-103)
```

Store:

```text
acknowledgedAt
acknowledgedByAgentSessionId
```

Dashboard:

```text
T-103
Handoff received by Bea's IBM Bob
```

This proves that the context reached the downstream agent.

---

# 10. Superseded Handoffs

If upstream work changes after a handoff is created:

```text
old handoff -> SUPERSEDED
new handoff -> PENDING
```

Never silently edit a previously acknowledged handoff.

Preserve history.

---

# 11. Task Context Package

Create:

```text
TaskContextPackage
```

This is the standard context bundle delivered to an agent when beginning or resuming work.

Suggested contents:

```text
Task
Readiness
Dependencies
Pending Handoffs
Active Contracts
Relevant Project Decisions
Open Coordination Risks
Unread Context Updates
Relevant Upstream Changes
Branch Status
Actual Scope
Relevant Active Agents
Recovery State
```

Example:

```text
TASK
T-103 Login Frontend

READINESS
READY

DEPENDENCIES
T-102 DONE

PENDING HANDOFF
T-102 -> T-103

ACTIVE CONTRACT
LoginResponse v3

PROJECT DECISIONS
JWT authentication

RISKS
None

BRANCH
task/T-103-login-ui

UPSTREAM REVISION
a981cc2
```

---

# 12. Context Package Versioning

Context must be traceable.

Add:

```text
contextVersion
generatedAt
sourceProjectRevision
```

If significant project state changes:

```text
Context Package v3
-> stale

Context Package v4
-> current
```

Do not pretend old context is still current.

---

# 13. Context Relevance Engine

The relevance engine determines what belongs in a task's context package.

Inputs:

```text
Task dependencies
Consumed contracts
Changed code entities
Active risks
Project decisions
Git branch state
Review results
Context updates
Handoffs
```

Output:

```text
Relevant context only
```

Initial relevance rules should be deterministic.

Example:

```text
Include ProjectDecision if:
decision scope matches task module/contract
OR decision is project-global

Include CoordinationRisk if:
task is source or affected task

Include ContextUpdate if:
affectedTaskId == taskId

Include Contract if:
task consumes/provides/modifies it
```

AI may summarize selected context, but deterministic rules decide inclusion.

---

# 14. Context Noise Controls

Avoid overwhelming agents.

Context packages should separate:

```text
CRITICAL
IMPORTANT
BACKGROUND
```

Example:

```text
CRITICAL
LoginResponse v3 handoff requires acknowledgement

IMPORTANT
Branch is 4 commits behind main

BACKGROUND
JWT authentication decision
```

Agents should not receive hundreds of raw events.

---

# 15. Agent Session Recovery

Phase 2 can detect stale sessions.

Phase 5 should make them resumable.

Create:

```text
RecoverySnapshot
```

Suggested fields:

```text
id
taskId
previousAgentSessionId
lastKnownRevision
lastProgressMessage
activeWorkIntent
actualScope
activeContracts
openRisks
pendingContextUpdates
pendingHandoffs
createdAt
```

Create a recovery snapshot when:

```text
session becomes STALE
session ends unexpectedly
user explicitly pauses task
```

---

# 16. Recovery Context

Example:

```text
RECOVERY CONTEXT

Task:
T-102 Login API

Previous Session:
STALE

Last Revision:
a81cd22

Last Progress:
Authentication endpoint implemented. Tests remain.

Declared Intent:
AuthService.ts
AuthController.ts

Actual Scope:
AuthService.ts
AuthController.ts
LoginResponse.ts

Open Risks:
LoginResponse impacts T-103

Pending Work:
- add invalid password test
- submit completion report

Pending Context Updates:
1
```

A new agent should be able to continue from this.

---

# 17. Recovery MCP Tools

Add:

```text
get_recovery_context(task_id)
resume_task(task_id)
```

`resume_task()` should:

```text
verify task ownership
-> create new agent session
-> load RecoverySnapshot
-> load current TaskContextPackage
-> compare old vs current project state
-> return recovery delta
```

---

# 18. Recovery Delta

Do not only show the previous state.

Show what changed while the agent was gone.

Example:

```text
WHILE YOU WERE AWAY

T-103 acknowledged LoginResponse v3.

main advanced by 3 commits.

No new file conflicts.

One project decision added:
Token expiry is 1 hour.
```

This is essential for safe recovery.

---

# 19. Recovery State Rules

A resumed agent must not inherit stale reservations automatically.

Instead:

```text
old reservations expire
new session recalculates needed reservations
```

Similarly:

```text
old context != current context
```

The new agent must receive current state plus recovery history.

---

# 20. Safe Parallel-Work Detection

The system should identify tasks that can likely proceed simultaneously.

This is not autonomous scheduling.

It is a safety classification.

Create:

```text
ParallelSafetyEvaluation
```

Possible states:

```text
SAFE
SAFE_WITH_WARNINGS
UNSAFE
UNKNOWN
```

---

# 21. Parallel Safety Inputs

Evaluate using:

```text
Task dependencies
File overlap
Contract overlap
Schema overlap
Actual Git relationships
Active coordination risks
Branch divergence
Shared project decisions
```

Example:

```text
T-201 Dashboard UI
T-202 Email Notifications
```

No shared files, contracts, or dependencies:

```text
SAFE
```

Example:

```text
T-203 Database Migration
T-204 Authentication Refactor
```

Both modify User model:

```text
UNSAFE

Reason:
Shared MODEL entity: User
```

---

# 22. Parallel Safety Must Be Explainable

Example:

```text
SAFE_WITH_WARNINGS

Tasks:
T-103
T-109

Reason:
No direct file overlap.

Warning:
Both consume User model, but neither modifies it.
```

Never return unexplained safety labels.

---

# 23. Parallel Work Groups

Create groups only as derived views.

Example:

```text
SAFE PARALLEL GROUP

T-201 Dashboard UI
T-202 Email Notifications
T-206 Logging
```

Another group:

```text
SEQUENTIAL / COORDINATED

T-203 Database Migration
T-204 Authentication Refactor

Reason:
Both modify User model.
```

Do not automatically assign developers.

---

# 24. Parallel Work MCP Tools

Add:

```text
get_parallel_safety(task_id, other_task_id)
get_safe_parallel_tasks(project_id)
```

Optional:

```text
get_parallel_work_groups(project_id)
```

These tools are advisory.

---

# 25. Lightweight Recalculation After State Changes

Do not build a heavy autonomous replanner.

Instead, recalculate only:

```text
task readiness
pending handoffs
context packages
parallel safety
recovery deltas
```

after important events:

```text
task completed
contract changed
risk created/resolved
review approved
merge confirmed
agent session stale
Git push
project decision changed
```

This is enough for Phase 5.

---

# 26. Coordinator Summary

A lightweight project coordinator may summarize deterministic results.

Example:

```text
PROJECT COORDINATION SUMMARY

READY TASKS
T-109 Logging
T-112 Settings UI

WAITING
T-103 Login Frontend

Reason:
Pending handoff acknowledgement from T-102.

INTERRUPTED
T-118 Payments API

Recovery snapshot available.

SAFE PARALLEL WORK
T-109 + T-112

HIGH RISKS
None
```

The coordinator does not invent dependencies or assignments.

---

# 27. No Agent Ranking in Phase 5

Do not build speculative agent skill rankings.

Avoid:

```text
Agent A is 93% good at frontend.
Agent B is better at databases.
```

unless there is real measured evidence.

Agent capability data may remain simple:

```text
supportsMCP
supportsHeartbeat
supportsContextUpdates
supportsReviewTools
supportsRecovery
```

This is compatibility metadata, not performance scoring.

---

# 28. Agent Collaboration Protocol v1

Formalize the generic integration contract.

Working name:

```text
ACP v1
Agent Collaboration Protocol
```

This is an internal protocol initially.

Define core operations:

```text
begin_task
resume_task
heartbeat

declare_work_intent

get_context_updates
acknowledge_context_update

get_task_handoffs
acknowledge_handoff

reserve_files
release_files

report_progress

submit_completion_report
request_review

end_task_session
```

IBM Bob should use this generic contract.

Do not add Bob-specific business logic.

---

# 29. Capability Negotiation

When an agent integration connects, register capabilities.

Create:

```text
AgentIntegrationCapability
```

Example:

```text
Agent:
IBM Bob

Capabilities:
MCP = true
Heartbeat = true
ContextUpdates = true
Handoffs = true
Recovery = true
ReviewTools = true
```

The platform can then degrade gracefully for less capable tools.

Example:

```text
Agent does not support automatic context updates.

Fallback:
Show pending update in dashboard.
```

---

# 30. Handoff and Recovery Audit Trail

Track:

```text
who generated handoff
source task
target task
source revision
delivery time
acknowledgement time
receiving session
superseded state
```

Recovery:

```text
previous session
stale time
recovery snapshot
new session
resume time
revision delta
```

Never silently mutate history.

---

# 31. Realtime Events

Add:

```text
task.readiness_changed

handoff.created
handoff.delivered
handoff.acknowledged
handoff.superseded

context_package.generated
context_package.superseded

recovery_snapshot.created
task.resume_started
task.resume_completed

parallel_safety.changed
```

Use the existing WebSocket/event infrastructure.

---

# 32. Frontend Phase 5 Upgrade

Add useful coordination views without turning the UI into a giant project manager.

## Task Card

Example:

```text
T-103
Login Frontend

Status:
TODO

Readiness:
WAITING_FOR_CONTEXT

Pending Handoffs:
1
```

## Handoff Panel

```text
PENDING HANDOFF

T-102 -> T-103

LoginResponse v3
Revision a981cc2

[View]
[Acknowledge]
```

## Interrupted Work Panel

```text
INTERRUPTED

T-118 Payments API

Previous Agent:
IBM Bob

Last Revision:
91ba231

Recovery Available:
YES
```

## Parallel Work Panel

```text
SAFE TO RUN IN PARALLEL

T-109 Logging
T-112 Settings UI
T-116 Documentation
```

---

# 33. Main Phase 5 Demo

Use three tasks.

```text
T-102 Login API
T-103 Login Frontend
T-109 Logging
```

Initial state:

```text
T-102 IN_PROGRESS
T-103 BLOCKED_BY_DEPENDENCY
T-109 READY
```

Developer A completes T-102.

System:

```text
marks T-102 DONE
activates LoginResponse v3
creates handoff T-102 -> T-103
recalculates T-103 readiness
```

T-103 becomes:

```text
WAITING_FOR_CONTEXT
```

Bea's Bob calls:

```text
begin_task(T-103)
```

It receives:

```text
HANDOFF REQUIRED

Source:
T-102

Final Contract:
LoginResponse v3

Revision:
a981cc2
```

Bob acknowledges.

T-103 becomes:

```text
READY
```

Meanwhile T-109 is classified:

```text
SAFE
```

to run in parallel.

This demonstrates reliable continuation.

---

# 34. Recovery Demo

Developer working on:

```text
T-118 Payments API
```

Agent session crashes.

System:

```text
marks session STALE
expires reservations
creates RecoverySnapshot
```

New Bob session calls:

```text
resume_task(T-118)
```

Returns:

```text
RECOVERY CONTEXT

Last Revision:
91ba231

Last Progress:
Payment endpoint complete. Tests pending.

WHILE YOU WERE AWAY:
- main advanced 2 commits
- PaymentRequest contract unchanged
- one new project decision added

Remaining Work:
- add tests
- submit completion report
```

New session resumes safely.

This is a strong second demo.

---

# 35. Metrics

Track only useful coordination metrics:

```text
handoffs created
handoffs acknowledged
handoffs superseded
recovery sessions completed
stale sessions recovered
context packages generated
parallel-safe task pairs identified
tasks waiting for context
```

Optional measured outcomes:

```text
coordination risks resolved before merge
context updates acknowledged before affected task completion
```

Do not claim productivity improvements without actual measurement.

---

# 36. Testing Requirements

## Readiness

Test:

```text
ready task
blocked dependency
pending handoff
open high risk
interrupted task
review dependency
```

## Handoffs

Test:

```text
automatic handoff creation
relevant payload selection
acknowledgement
duplicate suppression
superseded handoff
multiple upstream tasks
```

## Context Packages

Test:

```text
relevant contract inclusion
irrelevant event exclusion
decision inclusion
risk inclusion
versioning
stale package replacement
```

## Recovery

Test:

```text
stale session creates snapshot
normal end does not create incorrect recovery
resume creates new session
reservations are not inherited blindly
current context included
recovery delta correct
```

## Parallel Safety

Test:

```text
independent tasks -> SAFE
shared modified file -> UNSAFE
shared consumed contract -> SAFE_WITH_WARNINGS
shared modified contract -> UNSAFE
unknown relationship -> UNKNOWN
```

## Protocol Compatibility

Test:

```text
full-capability agent
agent without context update support
agent without recovery support
invalid capability claims
```

## Security

Test:

```text
cross-project handoff access denied
cross-project recovery access denied
unauthorized acknowledgement denied
```

---

# 37. Non-Goals

Do NOT build in Phase 5:

```text
automatic developer reassignment
developer performance rankings
agent performance rankings
fully autonomous sprint planning
complex execution-wave optimization
employee surveillance
fully autonomous project management
agent-to-agent free-form chat
autonomous merges
billing
HR features
```

These weaken the phase and increase risk.

---

# 38. Recommended Implementation Order

Build in this order:

```text
1. Task Readiness Engine

2. Readiness Explanation

3. TaskHandoff Model

4. Automatic Handoff Creation

5. Handoff Payload Builder

6. Handoff MCP Tools

7. Handoff Acknowledgement

8. Handoff Supersession

9. TaskContextPackage Model

10. Context Relevance Rules

11. Context Package Versioning

12. RecoverySnapshot Model

13. Stale Session Recovery Snapshot

14. get_recovery_context()

15. resume_task()

16. Recovery Delta

17. ParallelSafetyEvaluation

18. Deterministic Parallel Safety Rules

19. Parallel Work MCP Tools

20. Lightweight Coordinator Summary

21. Agent Collaboration Protocol v1

22. Capability Negotiation

23. Frontend Handoff / Recovery Views

24. Realtime Events

25. End-to-End Multi-Agent Testing
```

---

# 39. Phase 5 Definition of Done

Phase 5 is complete when:

- task readiness is calculated automatically
- readiness includes structured reasons
- completed upstream tasks automatically create handoffs
- handoffs contain only relevant technical context
- important handoffs require acknowledgement
- acknowledged handoffs are auditable
- outdated handoffs can be superseded
- begin_task returns a versioned context package
- context packages filter irrelevant project noise
- stale sessions create recovery snapshots
- resume_task starts a new session safely
- recovery includes what changed while the agent was away
- stale reservations are not inherited automatically
- safe parallel task pairs can be identified
- unsafe parallel work is explained
- UNKNOWN is used when safety cannot be determined
- IBM Bob uses the generic ACP operations
- agent capability negotiation works
- less capable agent integrations degrade gracefully
- realtime handoff/readiness/recovery updates work
- security prevents cross-project context access
- tests cover handoff, recovery, parallel safety, and protocol compatibility
- type checking passes
- linting passes
- builds pass

---

# 40. Core Differentiator

Phase 4 asks:

> What actually changed, what does it affect, and who needs to know?

Phase 5 asks:

> How does the next developer or coding agent continue safely with exactly the context it needs, even across task boundaries and interrupted sessions?

This is the major Phase 5 leap.

---

# 41. One-Line Phase 5 Goal

**Make multi-agent development continuous by turning completed work, interruptions, and dependencies into precise, auditable context handoffs that the next coding agent can immediately use.**
