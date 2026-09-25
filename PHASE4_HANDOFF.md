# PHASE 4 HANDOFF
# Git-Verified Change Intelligence and Cross-Agent Impact Propagation

## Objective

Phase 4 moves the platform from declared coordination into Git-verified engineering intelligence.

Core loop:

```text
Declared Intent
-> Agent Codes
-> Git Records Actual Change
-> Deterministic Diff Analysis
-> Code / Contract Entities
-> Impact Graph
-> Risk Engine
-> Affected Tasks
-> Affected Agents
-> Context Update
-> Agent Adapts Before Conflict
```

The key principle is:

> Git proves what changed. Deterministic analysis identifies what it affects. The platform delivers that context to the right tasks and agents before rework or merge conflicts happen.

## Architecture Rules

1. PostgreSQL remains the source of truth for collaboration state.
2. Git becomes the source of truth for actual code changes.
3. Declared intent and actual scope must remain separate.
4. MCP remains an adapter only.
5. Deterministic analysis comes before AI interpretation.
6. AI may explain or summarize risks, but must not invent repository facts.
7. Git provider logic must remain behind a provider abstraction.

## Core Architecture

```text
Human Developers
      |
      v
Collaboration Platform
      |
REST + WebSocket + MCP
      |
      v
Coordination Backend
      |
      +-- Task / Review State
      +-- Git Adapter
      +-- Code Entity Index
      +-- Impact Engine
      +-- Risk Engine
      +-- Context Updates
      |
      v
PostgreSQL
      |
      +--> MCP Layer --> IBM Bob / Other Agents
      |
      +--> GitHub
```

## 1. Git Provider Abstraction

Create:

```text
GitProvider
```

Operations:

```text
getRepository()
getDefaultBranch()
getBranch()
getCommit()
getCommitDiff()
getChangedFiles()
getPullRequest()
getPullRequestFiles()
getMergeStatus()
getBranchComparison()
```

Implement first:

```text
GitHubProvider
```

Future providers such as GitLab or Bitbucket should implement the same interface.

## 2. Repository Connection

Create `ProjectRepository`.

Suggested fields:

```text
id
projectId
provider
owner
repository
defaultBranch
externalRepositoryId
status
createdAt
updatedAt
```

Security rules:

- provider credentials remain server-side
- never expose tokens through frontend or MCP
- authorize every repository operation
- audit repository connection changes

## 3. Task-to-Branch Mapping

Create or extend `TaskGitLink`.

Suggested fields:

```text
id
taskId
repositoryId
branchName
baseBranch
latestCommitSha
pullRequestUrl
pullRequestNumber
mergeStatus
mergedCommitSha
createdAt
updatedAt
```

Every active task should be able to identify its working branch.

## 4. Git Webhooks

Use webhooks instead of aggressive polling.

Initial events:

```text
push
pull_request
pull_request_review
pull_request_review_comment
create
delete
```

Flow:

```text
GitHub
-> Webhook Endpoint
-> Signature Verification
-> Event Deduplication
-> Normalize Event
-> Process Git State
-> Run Change Analysis
```

Webhook processing must be idempotent.

## 5. External Event Audit

Create `ExternalEvent`.

Fields:

```text
id
provider
externalEventId
eventType
repositoryId
payloadHash
receivedAt
processedAt
status
errorMessage
```

Statuses:

```text
RECEIVED
PROCESSED
FAILED
IGNORED
```

Never process the same external event twice.

## 6. Actual Git Scope

Phase 2 stores declared work intent.

Phase 4 stores actual Git scope.

Example:

Declared:

```text
AuthService.ts
AuthController.ts
```

Actual:

```text
AuthService.ts
AuthController.ts
User.ts
TokenService.ts
```

Return:

```text
SCOPE_DEVIATION

Declared files: 2
Actual files: 4

Unexpected:
- User.ts
- TokenService.ts
```

Do not overwrite original intent.

## 7. Actual Change Model

Create `TaskActualChange`.

Fields:

```text
id
taskId
repositoryId
commitSha
filePath
changeType
additions
deletions
metadata
detectedAt
```

Change types:

```text
ADDED
MODIFIED
DELETED
RENAMED
```

## 8. Scope Expansion Detection

If Git reveals undeclared files:

```text
Declared:
AuthService.ts

Actual:
AuthService.ts
User.ts
BillingService.ts
```

Generate `SCOPE_EXPANSION`.

Then:

1. record deviation
2. update actual scope
3. run file conflict analysis
4. run entity impact analysis
5. create coordination risks
6. emit realtime updates

Preserve declared intent separately.

## 9. Deterministic Analysis First

Pipeline:

```text
Git Diff
-> Deterministic Parser
-> Changed Files
-> Changed Code Entities
-> Changed Contracts
-> Relationships
-> Impact Analysis
-> Optional AI Explanation
```

Recommended deterministic sources:

```text
TypeScript interfaces/types
OpenAPI
GraphQL schemas
Prisma schemas
JSON Schema
reliably parsable routes
imports
exports
```

AI should summarize and explain, not establish repository facts.

## 10. Code Entity Model

Create `CodeEntity`.

Fields:

```text
id
projectId
repositoryId
type
name
filePath
symbolName
metadata
createdAt
updatedAt
```

Types:

```text
FILE
API
TYPE
MODEL
SCHEMA
EVENT
MODULE
```

## 11. Code Relationship Model

Create `CodeRelationship`.

Fields:

```text
id
projectId
sourceEntityId
targetEntityId
relationship
confidence
source
createdAt
updatedAt
```

Relationships:

```text
PROVIDES
CONSUMES
IMPORTS
DEPENDS_ON
IMPLEMENTS
MODIFIES
DEFINES
CALLS
```

Sources:

```text
DETERMINISTIC
DECLARED
INFERRED
```

Confidence:

```text
HIGH
MEDIUM
LOW
```

Use PostgreSQL first. Do not add a graph database unless clearly necessary.

## 12. Impact Graph

The system should trace:

```text
Task
-> modifies File
-> defines Contract
-> consumed by Another File
-> associated with Another Task
-> owned by Another Developer / Agent
```

Example:

```text
T-102
-> AuthService.ts
-> LoginResponse
-> LoginForm.tsx
-> T-103
-> Bea / IBM Bob
```

## 13. Automatic Contract Discovery v1

Start narrow and reliable.

Recommended first targets:

```text
TypeScript exported interfaces/types
OpenAPI schemas/endpoints
Prisma models
GraphQL schema definitions
```

Example:

```text
type LoginResponse = {
  token: string;
  user: User;
}
```

Detect:

```text
Entity: LoginResponse
Type: TYPE
Change: MODIFIED
```

Then find active tasks that consume it.

## 14. Contract Change Model

Create `ContractChange`.

Fields:

```text
id
projectId
taskId
entityId
previousRevision
currentRevision
changeKind
breaking
confidence
detectedAt
```

Change kinds:

```text
ADDED
REMOVED
MODIFIED
RENAMED
```

Only mark breaking changes when deterministic rules justify it.

Otherwise use an unknown/undetermined state.

## 15. Impact Analysis

Flow:

```text
Changed Entity
-> Find Direct Consumers
-> Find Active Tasks
-> Find Current Agents
-> Generate Coordination Risk
-> Generate Context Update
```

Example:

```text
CHANGE IMPACT

Source Task:
T-102

Changed:
LoginResponse

Affected Tasks:
T-103 Login Frontend
T-108 Mobile Authentication

Affected Developers:
Bea
Alex

Confidence:
HIGH
```

## 16. Coordination Risk Model

Create `CoordinationRisk`.

Fields:

```text
id
projectId
sourceTaskId
affectedTaskId
type
severity
confidence
title
description
sourceEntityId
status
detectedAt
resolvedAt
```

Risk types:

```text
FILE_OVERLAP
CONTRACT_CHANGE
DEPENDENCY_CHANGE
SCOPE_EXPANSION
SCHEMA_CHANGE
STALE_REVIEW
BRANCH_DIVERGENCE
MERGE_CONFLICT
ARCHITECTURAL_CONFLICT
```

Statuses:

```text
OPEN
ACKNOWLEDGED
RESOLVED
DISMISSED
```

## 17. Deterministic Severity

Initial rules:

```text
Same active file overlap -> MEDIUM
Shared API modified while consumer active -> HIGH
Shared schema modified with active consumers -> HIGH
Exported shared type removed -> CRITICAL
Relevant upstream contract change on stale branch -> HIGH
```

AI may explain severity, not invent it where rules already exist.

## 18. Risk Confidence

Every risk should expose confidence.

Example:

```text
Risk:
LoginResponse changed

Severity:
HIGH

Confidence:
HIGH

Detected From:
TypeScript parser + Git diff
```

Suggested confidence logic:

```text
HIGH:
deterministic parser + direct relationship

MEDIUM:
deterministic change + indirect relationship

LOW:
inferred relationship only
```

Low-confidence warnings must be visibly distinguished.

## 19. Context Updates

Create `ContextUpdate`.

Fields:

```text
id
projectId
sourceTaskId
affectedTaskId
type
title
message
entityId
riskId
status
createdAt
acknowledgedAt
```

Statuses:

```text
UNREAD
READ
ACKNOWLEDGED
RESOLVED
```

Example:

```text
CONTEXT UPDATE

Source:
T-102

Affected:
T-103

Contract:
LoginResponse

Previous:
{ token }

Current:
{ token, user }

Reason:
T-103 consumes LoginResponse.
```

## 20. Context Subscriptions

Tasks should automatically subscribe to entities they consume.

Example:

```text
T-103 consumes:
LoginResponse
POST /api/login
```

Therefore T-103 subscribes to changes in those entities.

A change creates a `ContextUpdate`.

Subscriptions may come from:

- declared contracts
- deterministic relationships
- task dependencies

## 21. MCP Context Update Tools

Add:

```text
get_context_updates(task_id)
acknowledge_context_update(update_id)
```

`begin_task()` should include relevant unread context updates.

## 22. Enhanced begin_task()

Phase 4 `begin_task(task_id)` should return:

```text
Task
Assignee
Dependencies
Active Contracts
Project Decisions
Active Risks
Unread Context Updates
Branch Status
Latest Upstream Changes
Relevant Actual Scope
Active Agents
```

Example:

```text
TASK
T-103 Login Interface

DEPENDENCIES
T-102 DONE

ACTIVE CONTRACT
LoginResponse v2

PROJECT DECISIONS
JWT authentication

ACTIVE RISKS
None

LATEST CONTEXT UPDATES
T-102 changed LoginResponse 6 minutes ago

BRANCH
task/T-103-login-ui

BRANCH STATUS
8 commits behind main
```

## 23. Branch Divergence Detection

Track:

```text
task branch
base branch
merge base
ahead count
behind count
```

Also identify relevant upstream changes.

Example:

```text
BRANCH DIVERGENCE

Task:
T-103

Branch:
14 commits behind main

Relevant Upstream Changes:
- LoginResponse changed
- User schema changed

Severity:
HIGH
```

## 24. Basic Merge Risk Detection

Do not promise perfect merge prediction.

Initial signals:

```text
same file changed in two branches
same exported contract changed
same Prisma model changed
same migration area changed
shared type removed or renamed
```

Generate:

```text
POTENTIAL_MERGE_RISK
```

## 25. Project Coordinator

The Project Coordinator is optional and secondary.

It must not write production code.

It may:

- summarize
- prioritize
- explain
- surface blockers
- explain cross-task impact
- highlight unresolved risks

It receives structured facts only:

```text
active tasks
dependencies
actual Git changes
contracts
relationships
risks
reviews
decisions
branch status
```

Do not build it before deterministic impact analysis is reliable.

## 26. Coordination Dashboard

Add:

```text
Coordination
```

Suggested project navigation:

```text
Board
Reviews
Coordination
Activity
Decisions
```

Summary:

```text
ACTIVE WORK      3
OPEN RISKS       4
CONTRACT CHANGES 2
BRANCHES BEHIND  1
CONTEXT UPDATES  3
```

Risk cards should show:

```text
severity
confidence
source task
affected tasks
detected-from evidence
```

## 27. Impact Explorer

Keep it simple.

Example:

```text
LoginResponse
  |- defined in LoginResponse.ts
  |- modified by T-102
  |- consumed by T-103
  |- consumed by T-108
```

Also show:

```text
Changed At:
Commit 97acd33

Affected Active Tasks:
2
```

A dependency tree is sufficient.

## 28. Value Metrics

Track:

```text
coordination risks detected
scope deviations detected
affected tasks discovered
context updates delivered
potential duplicate work detected
integration risks found before merge
stale branches detected
```

Do not claim unmeasured time or money saved.

## 29. Security Hardening

Minimum requirements:

- verify GitHub webhook signatures
- keep provider credentials server-side
- use scoped tokens
- encrypt sensitive credentials where applicable
- authorize every repository operation
- authorize every MCP project operation
- reject cross-project access
- audit repository connection changes
- validate external payloads
- rate-limit relevant public endpoints

## 30. MCP Tools Required by End of Phase 4

Retain previous tools.

Add:

```text
get_git_status
get_task_diff
get_actual_changes
get_coordination_risks
acknowledge_risk
get_context_updates
acknowledge_context_update
get_impact_analysis
get_active_contract
get_contract_consumers
get_branch_status
```

Optional internal coordinator capability:

```text
analyze_project_coordination
```

## 31. Realtime Events

Add:

```text
repository.connected
git.push_received
git.change_detected
scope.deviation_detected
code_entity.changed
contract.change_detected
risk.created
risk.updated
risk.resolved
context_update.created
context_update.acknowledged
branch.diverged
merge_risk.detected
```

Use existing realtime infrastructure.

## 32. Main Demo

Developer A works on:

```text
T-102 Login API
```

Declared:

```text
Files:
AuthService.ts

Contract:
POST /api/login
```

Git push arrives.

Actual diff:

```text
AuthService.ts
LoginResponse.ts
User.ts
```

Analyzer detects:

```text
LoginResponse changed
```

Impact graph finds:

```text
T-103 Login Frontend consumes LoginResponse.
```

Developer B is editing `LoginForm.tsx`.

There is no file overlap.

Yet Developer B's Bob receives:

```text
CONTEXT UPDATE

Source:
T-102

Contract Changed:
LoginResponse

Previous:
{
  token
}

Current:
{
  token,
  user
}

Your Task:
T-103 Login Frontend

Reason:
Your task consumes LoginResponse.

Recommended Action:
Re-check integration before continuing.
```

This is the strongest Phase 4 proof.

## 33. Secondary Demo

Declared:

```text
AuthService.ts
```

Actual:

```text
AuthService.ts
User.ts
BillingService.ts
```

Platform reports:

```text
SCOPE EXPANSION

Unexpected:
User.ts
BillingService.ts
```

If BillingService.ts is related to another active task:

```text
NEW COORDINATION RISK

T-102 unexpectedly modified BillingService.ts.

Affected Task:
T-118
```

This proves Git-based verification.

## 34. Testing Requirements

### Webhooks

Test:

```text
valid signature
invalid signature
duplicate event
retry event
unsupported event
malformed payload
```

### Repository State

Test:

```text
repository connection
branch association
latest commit update
disconnected repository
```

### Actual Scope

Test:

```text
declared == actual
extra file
deleted file
renamed file
repeated push
multiple commits
```

### Code Entity Extraction

Test supported deterministic formats individually.

### Impact Analysis

Test:

```text
direct consumer
multiple consumers
inactive consumer
unrelated entity
dependency chain
```

### Risk Engine

Test:

```text
file overlap
contract change
schema change
scope expansion
duplicate risk suppression
resolved risk
confidence assignment
```

### Context Updates

Test:

```text
affected task receives update
unrelated task does not
duplicate update suppression
acknowledgement
```

### Branch Divergence

Test:

```text
current branch
behind branch
relevant upstream change
unrelated upstream change
```

### Security

Test:

```text
unauthorized project access
unauthorized repository access
invalid webhook signature
MCP cross-project access
```

## 35. Non-Goals

Do not spend Phase 4 on:

```text
every Git provider
full GitHub clone
autonomous merging
full static-analysis platform
whole-repository semantic AI indexing
every programming language
complex graph visualization
enterprise analytics
billing
deployment pipelines
CI/CD replacement
organization-wide policy engine
```

Phase 4 should be narrow and reliable.

## 36. Recommended Implementation Order

```text
1. Git Provider Abstraction
2. GitHub Repository Connection
3. Webhook Signature Verification
4. External Event Deduplication
5. Task-to-Branch Mapping
6. Commit / Diff Synchronization
7. Actual Change Model
8. Declared vs Actual Scope Analysis
9. Scope Expansion Detection
10. Code Entity Model
11. Code Relationship Model
12. Deterministic TypeScript Contract Discovery
13. Contract Change Detection
14. Coordination Risk Model
15. Deterministic Risk Rules
16. Confidence Scoring
17. Impact Analysis
18. Context Subscriptions
19. Context Updates
20. MCP Context Update Tools
21. Enhanced begin_task()
22. Branch Divergence Detection
23. Basic Merge Risk Detection
24. Coordination Dashboard
25. Impact Explorer
26. Security Hardening
27. Optional Project Coordinator
28. End-to-End Testing
```

## 37. Definition of Done

Phase 4 is complete when:

- a GitHub repository can be connected
- Git provider logic is abstracted
- webhook signatures are verified
- duplicate webhooks do not duplicate state
- tasks map to Git branches
- pushes update task Git state
- actual changed files are captured
- declared intent remains separate from actual scope
- scope deviations are detected automatically
- newly discovered files trigger conflict analysis
- code entities are extracted from at least one supported format
- at least one contract type is discovered automatically
- contract changes are detected from Git changes
- active consumers of changed contracts are identified
- risks include severity and confidence
- affected tasks receive ContextUpdates
- affected agents retrieve updates through MCP
- begin_task includes upstream context
- branch divergence is detected
- relevant upstream changes are identified
- basic merge risks are generated
- cross-project access is blocked
- coordination metrics are recorded
- tests cover duplicate and concurrent events
- type checking passes
- linting passes
- builds pass

## Core Differentiator

Phase 2 asked:

> What does each developer and agent intend to do?

Phase 3 asked:

> Has the exact work been reviewed and safely completed?

Phase 4 asks:

> What actually changed in the codebase, what does that change affect, and who needs that context right now?

## One-Line Phase 4 Goal

**Use Git-verified changes and deterministic impact analysis to automatically deliver the right project context to every affected coding agent before those changes become conflicts or rework.**
