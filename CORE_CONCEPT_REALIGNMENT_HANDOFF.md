# CORE CONCEPT REALIGNMENT HANDOFF
# Bring Arxion Back to the Original Product Experience

## Purpose of This Handoff

Arxion's backend architecture has become substantially more sophisticated than the original MVP idea.

The current repository already contains major coordination capabilities from Phases 1 through 5:

- project/task state
- task claiming
- agent sessions
- heartbeats and stale-session handling
- file reservations
- contract risk detection
- reviews and merge readiness
- Git webhook ingestion
- actual-change tracking
- coordination risks and context updates
- task readiness
- handoffs
- recovery snapshots
- parallel-safety analysis

However, the **original product experience is still incomplete**.

The original concept was simple and powerful:

> A developer opens one collaborative workspace, sees projects and teammates, sees task cards with clear instructions, grabs a task, and hands it directly to their coding agent. Everyone immediately knows who is working on what, and the agent receives the task context without the developer re-explaining it.

The current system has much of the backend intelligence required for this idea, but the human-facing workflow does not yet deliver that experience.

This handoff is therefore a **product realignment and completion pass**, not another intelligence-heavy phase.

Do not add more advanced orchestration until the original core experience works end to end.

---

# 1. Product North Star

Arxion should feel like this:

```text
Developer logs in
      ↓
Selects a project
      ↓
Sees teammates + live agent presence
      ↓
Sees actionable task board
      ↓
Opens or drags a task
      ↓
Task is claimed
      ↓
Drops task into Agent Dock
      ↓
Agent receives:
- task description
- acceptance criteria
- dependencies
- project decisions
- contracts
- risks
- current handoffs/context updates
      ↓
Agent starts work
      ↓
Everyone sees:
"Maki + IBM Bob are working on T-102"
      ↓
Git verifies what actually changed
      ↓
Affected teammates/agents receive context automatically
```

The human should never need to:

```text
open Arxion
copy task description
switch to Bob
paste the task
re-explain project context
manually tell teammates what is being changed
```

That manual context transfer is exactly what Arxion is supposed to remove.

---

# 2. Current-State Diagnosis

## What Is Already Strong

The current backend is not the main problem.

Arxion already has a strong backend foundation for:

```text
Shared project state
Live agent sessions
Soft file reservations
Contract coordination
Review lifecycle
Git-aware coordination
Context updates
Handoffs
Recovery
Parallel-safety evaluation
```

Preserve these systems.

Do not rewrite working backend architecture unnecessarily.

---

# 3. Critical Gap: Real User Identity Does Not Exist Yet

The current API still uses a seeded/hardcoded user fallback for project creation.

This means the system models multiple users in the database but does not yet have trustworthy runtime identity.

That is incompatible with real collaboration.

## Required Fix

Introduce actual authenticated user context.

Minimum requirements:

```text
POST /auth/login
POST /auth/logout
GET  /auth/me
```

For a hackathon implementation, use a simple secure local authentication flow.

Recommended:

```text
email
passwordHash
signed session or JWT
```

Do not require a third-party identity provider.

### Backend Requirement

After authentication:

```text
request.user.id
```

must become the authoritative user identity.

Remove patterns where clients send arbitrary:

```text
userId
reviewerId
createdById
```

for actions that should derive identity from the authenticated session.

Examples:

```text
claim task
create project
report progress
reserve files
approve review
acknowledge handoff
resume task
```

should derive the acting user from authentication.

### MCP Identity

MCP calls must also have authenticated identity.

Create an agent/integration credential tied to:

```text
user
project access
agent integration
```

Do not allow an MCP client to impersonate another user by passing an arbitrary userId.

---

# 4. Critical Gap: Authorization and Project Isolation

Authentication alone is not enough.

Every project-scoped request must verify that the authenticated user is a member of that project.

Create reusable guards:

```text
requireAuthenticatedUser()
requireProjectMember(projectId)
requireProjectRole(projectId, roles)
```

Suggested roles:

```text
OWNER
MEMBER
REVIEWER
```

At minimum:

```text
OWNER
MEMBER
```

All task, repository, review, risk, handoff, recovery, context, and coordination operations must enforce project membership.

---

# 5. Fix Cross-Project Recovery Context

The recovery delta currently queries newly created project decisions by date without sufficiently scoping them to the task's project.

That risks unrelated project decisions appearing in another task's recovery context.

Fix recovery-delta generation so every query is scoped to:

```text
snapshot.projectId
```

Recovery context must never cross project boundaries.

Add a regression test for this.

---

# 6. Critical Gap: Project Selection Is Visual, Not Functional

The dashboard currently loads the first returned project.

The project list in the sidebar is displayed but is not a real project selector.

## Required Routing

Use project-aware routes:

```text
/dashboard/[projectId]
/dashboard/[projectId]/reviews
/dashboard/[projectId]/coordination
/dashboard/[projectId]/decisions
```

Project sidebar items must be links.

Example:

```text
FinSight
Payroll
OmniGrid
```

Clicking `Payroll` must change:

```text
task board
members
activity
agents
risks
handoffs
context
```

to Payroll's project state.

Never default all pages to `projects[0]` after a project has been selected.

---

# 7. Critical Gap: Team Management Is Read-Only

The sidebar can display members, but there is no complete human workflow for building a team.

Implement:

```text
GET    /projects/:projectId/members
POST   /projects/:projectId/members
PATCH  /projects/:projectId/members/:memberId
DELETE /projects/:projectId/members/:memberId
```

Hackathon-friendly workflow:

```text
Owner selects Add Member
      ↓
Select existing user / enter email
      ↓
Member added
      ↓
Member appears in project immediately
```

A full email invitation system is optional.

What is required is that the project can genuinely contain different authenticated developers.

---

# 8. Critical Gap: The Task Board Is Display-Only

The original idea requires tasks to be actionable.

The current board must become an interactive client-side Kanban board.

## Required Interactions

Task cards must support:

```text
click
drag
drop
claim
release
edit
open details
```

Use a stable React drag-and-drop library.

Recommended:

```text
dnd-kit
```

Do not implement raw pointer logic manually unless necessary.

---

# 9. Dragging Tasks Between Columns

Required behavior:

### TODO -> IN_PROGRESS

Dragging an unassigned task into `IN_PROGRESS` should:

```text
validate current user
      ↓
attempt atomic claim
      ↓
if successful:
  assign current user
  update task to IN_PROGRESS
      ↓
broadcast realtime event
```

If another developer already claimed it:

```text
TASK_ALREADY_CLAIMED
```

The UI must roll the card back and show:

```text
Alex already claimed this task.
```

### IN_PROGRESS -> REVIEW

Do not allow raw status drag if review preflight is required.

Instead:

```text
drop attempted
      ↓
open Review Preflight
      ↓
require completion report
      ↓
request review
```

### REVIEW -> DONE

Do not permit manual drag.

Completion must still follow Phase 3 approval and merge rules.

The visual board must respect backend state machines.

---

# 10. Task Detail Drawer

Clicking a task should open a detailed drawer or modal.

Required contents:

```text
Task ID
Title
Full Description
Acceptance Criteria
Priority
Assignee
Status
Dependencies
Blocked By
Contracts
Files / Intended Files
Active Agent
Active Risks
Context Updates
Handoffs
Recent Progress
Git Branch / Revision
Review State
```

Task detail is where the developer decides whether they understand the work before handing it to an agent.

---

# 11. Add Acceptance Criteria to Tasks

The current Task model mostly contains:

```text
title
description
priority
status
```

That is not enough for reliable agent execution.

Add explicit acceptance criteria.

Recommended model:

```text
TaskSpecification
```

Fields:

```text
id
taskId
acceptanceCriteria String[]
notes String?
createdAt
updatedAt
```

Alternative:

```text
Task.acceptanceCriteria String[]
```

Either is acceptable.

The requirement is that an agent receives structured success criteria, not only a prose description.

Example:

```text
Task:
T-102 Build Login API

Description:
Create login endpoint.

Acceptance Criteria:
- POST /api/login exists
- invalid password returns 401
- JWT is returned for valid login
- LoginResponse includes user
- tests pass
```

---

# 12. Task Creation and Editing UI

The web app must support:

```text
Create Task
Edit Task
Add Dependency
Add Acceptance Criteria
Assign Priority
Assign Developer
```

Do not force developers to create tasks through raw APIs or seed scripts.

The product must be usable without database manipulation.

---

# 13. Restore the Original "Drag Task Into the Agent" Interaction

This is the largest missing piece from the original concept.

Create an:

```text
Agent Dock
```

The Agent Dock is a persistent UI target where a developer can drag a task card.

Example:

```text
┌───────────────────────────────┐
│ IBM Bob                       │
│ Drop a task here to work on it│
└───────────────────────────────┘
```

---

# 14. Agent Dock Behavior

When a task is dropped onto the Agent Dock:

```text
Task dropped
   ↓
Verify current user
   ↓
Verify project membership
   ↓
Check task ownership
   ↓
Claim task if unassigned
   ↓
Create AgentLaunchRequest
   ↓
Generate current TaskContextPackage
   ↓
Show launch state
```

Do NOT silently create a fake active agent session until an actual agent accepts the launch.

Use two stages:

```text
CLAIMED / WAITING_FOR_AGENT
        ↓
AGENT_ACCEPTED
        ↓
IN_PROGRESS / WORKING
```

This prevents ghost sessions.

---

# 15. Agent Launch Request Model

Create:

```text
AgentLaunchRequest
```

Suggested fields:

```text
id
projectId
taskId
userId
agentType
status
contextPackageId
createdAt
acceptedAt
expiredAt
agentSessionId
```

Statuses:

```text
PENDING
ACCEPTED
EXPIRED
CANCELLED
FAILED
```

A launch request is the bridge between the web UI and an external coding agent.

---

# 16. Important MCP Limitation

Do not pretend MCP can automatically type text into an external coding agent's chat.

MCP is normally agent-initiated.

Therefore:

```text
Web App -> Bob Chat Injection
```

cannot be assumed.

Do not fake this behavior.

Instead use a generic launch queue.

---

# 17. Agent Launch Queue

Add MCP operations:

```text
get_pending_launch_requests()
accept_launch_request(launchRequestId)
reject_launch_request(launchRequestId)
```

When Bob accepts:

```text
AgentLaunchRequest = ACCEPTED
      ↓
create/resume AgentSession
      ↓
begin_task workflow
      ↓
return TaskContextPackage
      ↓
task becomes actively WORKING
```

The user should no longer have to type the task description manually.

At most, the Bob-side user may need one generic action such as:

```text
Check Arxion work queue.
```

Long term, agent-specific adapters may support deeper launching.

The Arxion backend must remain agent-agnostic.

---

# 18. One-Click Fallback

If an agent cannot consume launch requests automatically, the Agent Dock must provide a fallback:

```text
Copy Launch Command
```

Example:

```text
Work on Arxion task T-102. Accept my pending launch request and retrieve the current context package.
```

This is still better than copying the complete task description and project context.

---

# 19. Agent Dock Should Show Agent State

Example:

```text
IBM Bob
CONNECTED

Current:
T-102 Login API

Status:
WORKING
```

Or:

```text
Cursor
NOT CONNECTED
```

The web app should make it obvious which agent will receive a dropped task.

---

# 20. Agent Integration Registry

Add a small integration model:

```text
AgentIntegration
```

Suggested fields:

```text
id
userId
type
name
status
capabilities
lastSeenAt
createdAt
```

Examples:

```text
IBM_BOB
CURSOR
CLAUDE_CODE
OTHER
```

Capabilities may include:

```text
launchQueue
heartbeat
contextUpdates
handoffs
recovery
reviewTools
```

Do not score agent quality.

This is compatibility metadata only.

---

# 21. Critical Gap: MCP Source / Tool Parity Must Be Audited

The repository snapshot references the MCP server package and expects:

```text
src/index.ts
```

but the exported tree does not include the MCP source itself.

Do not assume the MCP implementation is healthy simply because README documentation lists tools.

First verify:

```text
apps/mcp-server/src/index.ts exists
build succeeds
registered MCP tools match backend capabilities
Phase 4 tools exist
Phase 5 tools exist
new launch-queue tools exist
```

Create an automated MCP parity test.

Expected categories:

```text
Core task tools
Coordination tools
Review tools
Git/impact tools
Context update tools
Handoff tools
Recovery tools
Parallel-safety tools
Agent launch tools
```

If the source is actually absent, restore it.

If it was only omitted from the repository export, document that and continue.

---

# 22. Critical Gap: Phase 5 Route Source Must Be Verified

The uploaded repository export represents:

```text
apps/api/src/modules/phase5/phase5.routes.ts
```

as binary/unreadable.

Before adding more Phase 5 functionality:

```text
verify the source file is valid text TypeScript
verify Git attributes/encoding
verify route registration
verify all Phase 5 routes with API integration tests
```

Do not rebuild working Phase 5 services until route integrity has been checked.

---

# 23. Critical Gap: Git Semantic Analysis Does Not Receive Real File Content

The Phase 4 entity extractor contains deterministic TypeScript/Prisma parsing logic.

However, in the current webhook flow the changed-file records primarily contain:

```text
file path
change type
```

and not the actual file contents.

The extractor therefore falls back to:

```text
content = ''
```

which means ordinary push events mostly generate FILE entities.

This severely limits:

```text
automatic type discovery
automatic API discovery
automatic model discovery
contract impact analysis
```

Fix this before claiming semantic impact intelligence is complete.

---

# 24. Add File Content Retrieval to GitProvider

Extend:

```text
IGitProvider
```

with:

```text
getFileContent(owner, repo, filePath, ref)
```

or equivalent blob/content operations.

For each relevant changed file:

```text
push received
   ↓
get changed files
   ↓
fetch content at commit SHA
   ↓
size/type safety check
   ↓
pass content into entity extractor
```

Recommended limits:

```text
supported text formats only
max file size configurable
skip binaries
skip generated/vendor folders
```

Example ignored paths:

```text
node_modules/
dist/
build/
.next/
coverage/
vendor/
```

---

# 25. Build Real Code Relationships

The schema contains CodeRelationship, but the semantic graph must actually be populated.

Implement deterministic relationship extraction for TypeScript first.

At minimum:

```text
FILE DEFINES TYPE
FILE DEFINES API
FILE IMPORTS FILE
TYPE DEPENDS_ON TYPE
TASK MODIFIES ENTITY
```

Create:

```text
TaskCodeEntity
```

Suggested fields:

```text
id
taskId
entityId
relationship
source
confidence
commitSha
```

Relationships:

```text
MODIFIES
PROVIDES
CONSUMES
```

This gives tasks a direct semantic connection to code entities.

---

# 26. Fix Parallel Safety Semantic Placeholder

The current Phase 5 parallel-safety service contains a placeholder for MODEL/SCHEMA overlap.

Replace that placeholder using:

```text
TaskCodeEntity
CodeEntity
CodeRelationship
```

Parallel-safety decisions should consider:

```text
same modified file
same modified API
same modified TYPE
same modified MODEL
same modified SCHEMA
dependency relationship
active HIGH/CRITICAL risk
```

Return:

```text
SAFE
SAFE_WITH_WARNINGS
UNSAFE
UNKNOWN
```

with reasons.

Never return SAFE simply because the semantic graph was not populated.

If evidence is insufficient:

```text
UNKNOWN
```

is safer.

---

# 27. Fix Handoff Target Discovery

The current handoff implementation targets explicit downstream TaskDependency relationships.

The original Phase 5 intent also requires handoffs to contract consumers.

When a completed task produces or modifies:

```text
LoginResponse
POST /api/login
```

find downstream targets from:

```text
TaskDependency
TaskContract CONSUMES
TaskCodeEntity CONSUMES
Context subscription
```

Deduplicate targets.

A task should receive a handoff even if no manually authored TaskDependency exists but it is a verified consumer of the completed contract.

---

# 28. Human UI Must Surface Phase 4 and Phase 5 Intelligence

A large amount of intelligence currently exists primarily in backend services.

Create a dedicated project coordination page:

```text
/dashboard/[projectId]/coordination
```

Sections:

```text
Active Agents
Active Work
File Reservations
Open Risks
Context Updates
Pending Handoffs
Interrupted Tasks
Recovery Available
Parallel Safety
Branch Status
Scope Deviations
```

The original concept is collaborative.

Important coordination information cannot remain hidden behind APIs.

---

# 29. Context Update Inbox

Add a human-visible inbox.

Example:

```text
CONTEXT UPDATES

HIGH
LoginResponse changed by T-102
Affects T-103
[View] [Acknowledge]

MEDIUM
Your branch is 6 commits behind main
[View]
```

The same update should be available to the agent through MCP.

Humans and agents must see the same coordination state.

---

# 30. Handoff UI

When a task receives a handoff:

```text
T-102 -> T-103

LoginResponse v3
Revision a981cc2

[View Handoff]
[Acknowledge]
```

Acknowledging from either:

```text
human UI
or
agent MCP
```

must update the same record.

---

# 31. Recovery UI

For interrupted tasks:

```text
INTERRUPTED

T-118 Payments API

Last Progress:
Endpoint complete, tests pending

Last Revision:
91ba231

[Resume With Agent]
```

`Resume With Agent` should feed directly into Agent Dock / launch request.

---

# 32. Task Presence Should Be Obvious

Original concept:

> Whoever takes the task should visibly be the person currently working on it.

Task cards should clearly show:

```text
Maki
IBM Bob
WORKING
```

not only the assignee.

Suggested presence block:

```text
Maki + IBM Bob
● Working now
```

If claimed but waiting for agent:

```text
Maki
◐ Waiting for Bob
```

If stale:

```text
Maki + IBM Bob
⚠ Interrupted
```

---

# 33. Realtime UX Should Be Incremental

The current app can refresh server-rendered state on realtime events.

For the core collaboration experience, move the most interactive components to client state where appropriate.

Do not reload the entire project view for every heartbeat.

At minimum:

```text
task movement
agent presence
file reservations
context updates
handoffs
```

should feel immediate.

Keep server state authoritative.

Optimistic UI is allowed where rollback is safe.

---

# 34. Documentation Drift Must Be Fixed

The repository contains later-phase migrations and modules, while several docs still describe Phase 2/3 as the current roadmap.

Update:

```text
README.md
AGENTS.md
CURRENT_HANDOFF.md
```

They must accurately reflect:

```text
what is implemented
what is verified
what is partially implemented
what is only specified in handoff documents
```

Do not mark a phase complete just because a `PHASE*_HANDOFF.md` exists.

---

# 35. Phase 6 Status Must Be Honest

The repository snapshot contains:

```text
PHASE6_HANDOFF.md
```

but the visible source tree and migrations only show implementation through Phase 5.

Treat Phase 6 as:

```text
SPECIFIED
NOT YET VERIFIED AS IMPLEMENTED
```

until CI modules, migrations, routes, and tests exist in the repository.

Do not continue piling phases on top of missing core UX.

---

# 36. New Priority Order

## P0 — Required to Deliver the Original Concept

Implement first:

```text
1. Authentication + current user
2. Project authorization
3. Project switching
4. Member management
5. Interactive task details
6. Acceptance criteria
7. Task create/edit UI
8. Drag-to-claim Kanban
9. Agent Dock
10. AgentLaunchRequest queue
11. MCP launch-request parity
```

Without these, Arxion is architecturally impressive but does not yet feel like the original product.

---

# 37. P1 — Make Existing Intelligence Actually Trustworthy

After P0:

```text
12. Git file-content retrieval
13. Real code-entity extraction from pushes
14. CodeRelationship creation
15. TaskCodeEntity mapping
16. Semantic parallel-safety fix
17. Contract-consumer handoffs
18. Cross-project recovery isolation fix
19. Phase 4/5 coordination UI
20. MCP + Phase5 route integrity audit
```

---

# 38. P2 — Documentation and Product Polish

Then:

```text
21. README/AGENTS/CURRENT_HANDOFF sync
22. Better realtime client updates
23. Empty/loading/error states
24. Demo data cleanup
25. E2E collaboration tests
```

Only after these should Phase 6 validation intelligence become the main development focus.

---

# 39. Target End-to-End Demo

This demo must work before this realignment is considered done.

## Browser A — Maki

Maki logs in.

Selects:

```text
FinSight
```

Sidebar shows:

```text
Maki
Bea
Alex
```

Maki sees:

```text
T-102 Build Login API
```

with:

```text
Description
Acceptance Criteria
Dependencies
```

Maki drags T-102 into:

```text
IBM Bob Agent Dock
```

System:

```text
claims T-102 for Maki
creates AgentLaunchRequest
shows Waiting for Bob
```

Bob accepts launch through MCP.

System:

```text
creates agent session
runs begin_task
returns TaskContextPackage
```

Task card instantly shows:

```text
Maki + IBM Bob
● WORKING
```

No task description was manually copied.

---

# 40. Target Demo — Browser B

Bea is logged in separately.

Bea immediately sees:

```text
Maki + IBM Bob
working on T-102
```

Bea opens:

```text
T-103 Login Frontend
```

and sees:

```text
Blocked / At Risk because of T-102
```

Bea can still inspect the task.

When T-102 changes LoginResponse, Git webhook analysis retrieves the actual changed source content and detects:

```text
LoginResponse changed
```

T-103 receives:

```text
CONTEXT UPDATE
```

in both:

```text
Bea's Arxion dashboard
Bea's agent context
```

---

# 41. Target Demo — Handoff

T-102 completes and merges.

Arxion finds T-103 through:

```text
explicit dependency
or verified contract consumption
```

and creates:

```text
HANDOFF T-102 -> T-103
```

Bea's task shows:

```text
Final LoginResponse
Git revision
Project decisions
Remaining risks
```

Bea acknowledges the handoff.

T-103 becomes:

```text
READY
```

Bea drags it into her Agent Dock.

Her agent starts with all required context automatically.

That is the original idea fully realized.

---

# 42. Required E2E Tests

Create end-to-end tests for:

## Authentication

```text
two different users
project membership isolation
unauthorized project blocked
```

## Project Switching

```text
select project A
tasks/members/activity belong to A

select project B
tasks/members/activity belong to B
```

## Task Drag

```text
TODO -> IN_PROGRESS claims current user
duplicate claim rolls UI back
REVIEW cannot bypass preflight
DONE cannot bypass merge rules
```

## Agent Dock

```text
drop creates launch request
agent accepts request
session created
context package returned
task shows active presence
expired request handled
```

## Multi-User Presence

```text
browser A starts task
browser B sees active user/agent without reload
```

## Semantic Git Analysis

```text
push modifies TypeScript exported type
content fetched from Git provider
entity extracted
contract change detected
consumer task receives update
```

## Handoff

```text
dependency consumer receives handoff
contract-only consumer receives handoff
acknowledgement changes readiness
```

## Recovery Isolation

```text
project A recovery context never contains project B decisions
```

---

# 43. What Not to Add During This Realignment

Do not add:

```text
more speculative AI agents
new graph databases
autonomous sprint planning
developer scoring
agent performance rankings
billing
enterprise analytics
another CI provider
deployment automation
large design-system rewrite
```

The current problem is not lack of advanced features.

The problem is that the original simple workflow is not yet completely delivered.

---

# 44. Definition of Done

This realignment is complete only when:

- real users can authenticate
- all project actions use authenticated identity
- cross-project access is blocked
- project list is actually selectable
- members can be added/managed
- the web app is usable without seed scripts or raw API calls
- tasks have acceptance criteria
- task details show full coordination context
- tasks can be dragged to IN_PROGRESS and atomically claimed
- tasks cannot bypass review/completion state machines through drag/drop
- Agent Dock exists
- dropping a task creates an AgentLaunchRequest
- an agent can accept the launch through a generic integration contract
- task context is retrieved automatically
- the developer no longer copies the task description into the agent
- live task cards show developer + agent presence
- Phase 4 semantic analysis fetches actual changed file contents
- code entities are extracted from normal Git pushes
- code relationships are persisted
- task-to-code-entity mappings exist
- parallel safety no longer contains semantic placeholders
- contract consumers receive handoffs even without explicit task dependencies
- Phase 4/5 intelligence is visible in the human UI
- recovery is project-isolated
- MCP tool parity is verified
- Phase 5 route source integrity is verified
- documentation matches actual implementation
- full two-user/two-agent demo works end to end
- type checking passes
- linting passes
- builds pass
- E2E collaboration tests pass

---

# 45. Product Statement After Realignment

Arxion should finally be accurately described as:

> **A collaborative control plane for human developers and coding agents where tasks can be handed directly to agents, team activity is visible in real time, and project context automatically follows the work across developers, agents, Git changes, reviews, and handoffs.**

---

# 46. One-Line Goal

**Make the sophisticated coordination backend disappear behind one simple experience: pick a task, give it to your agent, and let the entire team stay synchronized automatically.**
