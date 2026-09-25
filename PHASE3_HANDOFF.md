# PHASE 3 HANDOFF
# Review, Merge Readiness, Completion, and Context Propagation

## Phase 3 Objective

Phase 1 proved the shared architecture:

```text
Web App -> Backend API -> PostgreSQL
IBM Bob -> MCP Server -> Backend API -> Same PostgreSQL
```

Phase 2 proved active multi-agent coordination:

```text
Task Claim
-> Agent Session
-> Work Intent
-> File Reservation
-> Dependency Awareness
-> Contract Awareness
-> Realtime Coordination
-> Progress Reporting
```

Phase 3 must close the development lifecycle.

The platform should now understand when work is:

- finished enough to review
- properly validated
- approved by a human
- still identical to the version that was reviewed
- ready to merge
- actually merged
- safe to mark complete
- ready to unblock dependent tasks
- ready to publish final project contracts and decisions

The central Phase 3 question is:

> Is this work actually reviewed, stable, traceable, and safe for the rest of the project to depend on?

## Core Phase 3 Lifecycle

```text
TODO
  ↓
IN_PROGRESS
  ↓
Agent coordination
  ↓
Completion report
  ↓
Review preflight
  ↓
REVIEW
  ↓
AI-assisted review
  ↓
Human review
  ↓
Changes requested?
  ├── YES -> IN_PROGRESS -> fix -> review again
  └── NO  -> APPROVED
               ↓
        Merge readiness check
               ↓
          READY_TO_MERGE
               ↓
             MERGED
               ↓
              DONE
               ↓
     Re-evaluate dependents
               ↓
      Activate final contracts
               ↓
       Propagate project context
```

## Architectural Rules

1. The backend remains authoritative.
2. PostgreSQL remains the source of truth.
3. MCP remains an adapter only.
4. Human approval is required before merge readiness.
5. AI review may advise and explain but may not be sole approval authority.
6. Review state must be tied to a specific immutable work revision.
7. If work changes after approval, approval becomes stale.
8. A task must not become DONE merely because an agent says it is finished.
9. Merge confirmation must be independently recorded.
10. Completion must be idempotent.
11. Dependency unlocking occurs only after successful completion.
12. Final contracts become ACTIVE only after successful completion.
13. Important review/completion transitions must be auditable.

## Review Domain

Suggested Review fields:

```text
id
taskId
requestedById
status
reviewRevision
reviewVersion
createdAt
updatedAt
approvedAt
approvedById
invalidatedAt
invalidationReason
```

Statuses:

```text
PENDING
IN_REVIEW
CHANGES_REQUESTED
APPROVED
INVALIDATED
REJECTED
SUPERSEDED
```

Task status remains:

```text
BACKLOG
TODO
IN_PROGRESS
BLOCKED
REVIEW
DONE
```

## Immutable Review Snapshot

Create:

```text
ReviewSnapshot
```

Fields:

```text
id
reviewId
taskId
workRevision
gitCommitSha
branchName
completionReportId
declaredIntentSnapshot
contractSnapshot
fileSnapshot
testSnapshot
createdAt
```

The snapshot must be immutable.

If code changes after the snapshot, the old review cannot silently remain valid.

## Completion Report

Create:

```text
TaskCompletionReport
```

Fields:

```text
id
taskId
agentSessionId
summary
filesChanged
contractsChanged
testsRun
testsPassed
testsFailed
knownIssues
scopeChanges
workRevision
createdAt
```

Example:

```text
Summary:
Implemented JWT login endpoint.

Files Changed:
- AuthController.ts
- AuthService.ts
- routes.ts

Contracts Changed:
- POST /api/login
- LoginResponse v2

Tests:
8 passed
0 failed

Known Issues:
Rate limiting not implemented.

Scope Changes:
Added LoginRequest.ts.
```

Add MCP:

```text
submit_completion_report(task_id, ...)
```

Validation:
- task exists
- caller is authorized
- task is IN_PROGRESS
- active agent session exists
- required evidence exists
- revision is known

## Review Preflight

Implement:

```text
POST /tasks/:taskId/request-review
```

MCP:

```text
request_review(task_id)
```

Check:
- task ownership
- active agent session
- dependencies
- completion report
- acceptance criteria
- declared work intent
- declared vs actual file scope
- active reservations
- active coordination risks
- contract changes
- tests
- known issues
- current revision

Return one of:

```text
READY
READY_WITH_WARNINGS
BLOCKED
```

Only BLOCKED prevents review creation.

Warnings must be visible to reviewers.

## Scope Deviation Analysis

Compare:

```text
Declared Work Intent
vs
Completion Report
vs
Git Diff / Revision
```

Example:

Declared:

```text
AuthController.ts
AuthService.ts
```

Actual:

```text
AuthController.ts
AuthService.ts
User.ts
Database.ts
```

Return:

```text
SCOPE_DEVIATION

Unexpected files:
- User.ts
- Database.ts

Severity:
MEDIUM
```

Do not automatically fail review.

## Git Revision Binding

Create:

```text
TaskGitLink
```

Fields:

```text
id
taskId
repositoryUrl
branchName
baseBranch
latestCommitSha
pullRequestUrl
pullRequestNumber
mergeStatus
mergedCommitSha
updatedAt
```

At minimum track:
- branchName
- latestCommitSha
- mergeStatus

When review snapshot is created:

```text
reviewRevision = latestCommitSha
```

If Git automation is incomplete, allow manual registration of branch and SHA.

## Review Invalidation

If:

```text
approvedRevision != currentRevision
```

then:

```text
Review -> INVALIDATED
Task -> REVIEW
```

Emit:

```text
review.invalidated
```

Reason:

```text
Work changed after approval.
```

## AI-Assisted Review

Add:

```text
run_ai_review(review_id)
```

AI review receives:
- task
- acceptance criteria
- dependencies
- work intent
- completion report
- review snapshot
- changed files
- changed contracts
- test results
- project decisions
- project rules
- coordination warnings
- Git diff if available

AI review checks:
- acceptance criteria coverage
- architecture consistency
- security concerns
- breaking contract changes
- tests
- scope deviation
- potential regressions
- dependency impact
- project decisions

AI review must never approve the review by itself.

## Structured Review Findings

Create:

```text
ReviewFinding
```

Fields:

```text
id
reviewId
source
category
severity
title
description
filePath
contractName
status
isBlocking
createdAt
resolvedAt
```

Sources:

```text
AI
HUMAN
SYSTEM
```

Categories:

```text
GENERAL
FILE
CONTRACT
TEST
ARCHITECTURE
SECURITY
DEPENDENCY
SCOPE
```

Severity:

```text
INFO
LOW
MEDIUM
HIGH
CRITICAL
```

Status:

```text
OPEN
RESOLVED
DISMISSED
```

## Human Review Workflow

Dedicated review page:

```text
REVIEW T-102

Task
Acceptance Criteria
Completion Report
Review Revision
Changed Files
Scope Deviations
Changed Contracts
Test Results
Known Issues
AI Review Findings
Human Findings
Git Revision
Coordination Risks
Merge Readiness

[ APPROVE ]
[ REQUEST CHANGES ]
```

Human approval remains authoritative.

## Review Feedback MCP

Add:

```text
get_review_feedback(task_id)
```

and:

```text
resolve_review_feedback(finding_id, resolution)
```

Never delete findings. Preserve audit history.

## Approval Rules

Approval requires:

```text
review.status == IN_REVIEW
AND all blocking findings are resolved or dismissed by an authorized reviewer
AND review snapshot is still current
AND task.status == REVIEW
```

Endpoint:

```text
POST /reviews/:reviewId/approve
```

On success:

```text
review.status = APPROVED
approvedAt = now
approvedById = reviewer
```

## Request Changes

Endpoint:

```text
POST /reviews/:reviewId/request-changes
```

Behavior:

```text
review.status = CHANGES_REQUESTED
task.status = IN_PROGRESS
```

Keep the previous review cycle in history.

Resubmission increments review version:

```text
Review v1 -> Changes requested
Review v2 -> Approved
```

## Review State Machine

Allowed examples:

```text
PENDING -> IN_REVIEW
IN_REVIEW -> CHANGES_REQUESTED
IN_REVIEW -> APPROVED
CHANGES_REQUESTED -> IN_REVIEW
APPROVED -> INVALIDATED
INVALIDATED -> IN_REVIEW
```

Invalid examples:

```text
PENDING -> APPROVED without review
CHANGES_REQUESTED -> APPROVED without resubmission
INVALIDATED -> DONE
```

Backend must reject invalid transitions.

## Merge Readiness

Implement:

```text
GET /tasks/:taskId/merge-readiness
```

MCP:

```text
get_merge_readiness(task_id)
```

Check:
- review approved
- approved revision equals current revision
- no blocking finding remains
- dependencies still valid
- no critical coordination risk unresolved
- no stale active reservation
- branch/revision exists
- task has not materially changed since approval

Return:

```text
READY_TO_MERGE
READY_WITH_WARNINGS
NOT_READY
```

## Merge Confirmation

Do not mark task DONE just because it is approved.

Add:

```text
POST /tasks/:taskId/confirm-merge
```

Store:

```text
mergeStatus
mergedCommitSha
mergedAt
```

Statuses:

```text
NOT_STARTED
READY
MERGED
FAILED
CANCELLED
```

Completion requires:

```text
mergeStatus == MERGED
```

## Idempotent Completion

Implement:

```text
POST /tasks/:taskId/complete
```

MCP:

```text
complete_task(task_id)
```

Calling twice must not duplicate:
- activity
- contract activation
- dependency unlocking
- session closure
- reservation release

Completion requires:
- task not already DONE
- review APPROVED
- approved revision current
- merge confirmed
- no blocking finding remains

On success, perform a transaction:

```text
Task -> DONE
Set completedAt
Release active reservations
End active agent sessions
Close work intent
Activate final contracts
Re-evaluate dependent tasks
Record completion activity
Emit task.completed
```

## Dependency Re-Evaluation

When a task becomes DONE:

```text
find dependent tasks
-> recalculate blockers
-> update blocked state
-> emit task.unblocked when applicable
```

Do not blindly mark all dependents TODO.

Recalculate all dependencies.

## Contract Activation

Phase 2 contracts may be DRAFT.

Phase 3 lifecycle:

```text
DRAFT
ACTIVE
DEPRECATED
SUPERSEDED
```

When task completes:
- final contract version -> ACTIVE
- older replaced version -> SUPERSEDED or DEPRECATED

Example:

```text
LoginResponse v1 -> SUPERSEDED
LoginResponse v2 -> ACTIVE
```

## Contract Version Model

Create:

```text
ContractVersion
```

Fields:

```text
id
contractId
taskId
version
status
schema
metadata
createdAt
activatedAt
```

Do not build a full schema registry in Phase 3.

## Context Propagation

When a task completes, propagate stable project context:
- final API contract
- final shared type
- final database schema decision
- final architectural decision
- completed dependency state

Dependent tasks should receive final context through `begin_task()`.

Example:

```text
Dependency completed:
T-102

Active contract:
POST /api/login

LoginResponse v2:
{
  token,
  user
}
```

## Project Decision Log

Create:

```text
ProjectDecision
```

Fields:

```text
id
projectId
taskId
title
decision
reason
createdById
agentSessionId
status
createdAt
supersededById
```

Statuses:

```text
ACTIVE
SUPERSEDED
DEPRECATED
```

MCP:

```text
get_project_decisions
record_project_decision
```

Future agents should receive relevant active decisions during preflight.

## Realtime Events

Add:

```text
completion_report.created
review.requested
review.started
review.finding_created
review.finding_resolved
review.changes_requested
review.approved
review.invalidated
merge.readiness_changed
merge.confirmed
task.completed
task.unblocked
contract.activated
contract.superseded
decision.recorded
decision.superseded
```

Existing WebSocket infrastructure is enough.

## Frontend Phase 3 Upgrade

Project navigation:

```text
Board
Activity
Agents
Reviews
Decisions
```

Review page:

```text
REVIEW T-102

Task
Acceptance Criteria
Completion Report
Review Revision
Changed Files
Scope Deviations
Changed Contracts
Test Results
Known Issues
AI Review Findings
Human Findings
Coordination Risks
Merge Readiness

[ APPROVE ]
[ REQUEST CHANGES ]
```

Dashboard indicators:

```text
READY FOR REVIEW   2
CHANGES REQUESTED  1
APPROVED           1
READY TO MERGE     1
BLOCKED            1
```

## MCP Tools Required by End of Phase 3

Retain Phase 2 tools.

Add:

```text
submit_completion_report
request_review
get_review
run_ai_review
get_review_feedback
resolve_review_feedback
get_merge_readiness
complete_task
get_project_decisions
record_project_decision
```

Optional:

```text
register_git_revision
confirm_merge
```

## AI Review Boundary

AI review may:
- identify issues
- explain risks
- compare task requirements with evidence
- identify contract impact
- identify scope deviations
- identify missing tests
- assist human reviewers

AI review must not:
- silently approve work
- bypass blocking human findings
- mark a task DONE
- confirm merge without evidence
- rewrite review history

## Audit Trail

Every important transition must record:

```text
who
what
task
review
previous state
new state
revision
timestamp
reason
```

Examples:

```text
Maki requested review for T-102 at revision 84fea12.
Alex requested changes on Review v1.
IBM Bob resolved Finding F-22.
Alex approved Review v2 at revision 97acd33.
T-102 merge confirmed at commit a1b2c3d.
T-102 marked DONE.
T-103 automatically unblocked.
```

Never mutate history silently.

## Testing Requirements

### Review State Machine
- request review
- valid transitions
- invalid transitions
- changes requested
- resubmission
- approval
- invalidation after changes

### Review Snapshot
- snapshot created
- snapshot immutable
- revision bound correctly
- newer revision invalidates approval

### Completion Report
- valid report
- missing evidence
- scope deviation detection

### Findings
- AI finding
- human finding
- blocking finding
- resolution
- dismissal
- approval blocked while finding remains

### Merge Readiness
- approved/current revision
- stale approval
- unresolved finding
- critical risk
- missing merge data

### Completion
- successful completion
- duplicate completion request
- completion before merge
- completion before approval
- reservations released once
- sessions ended once
- activity emitted once

### Dependencies
- one dependency
- multiple dependencies
- one remaining blocker
- all blockers completed
- automatic unblocking

### Contracts
- draft activation
- new active version
- superseding old version
- dependent task receives active contract

## Non-Goals

Do not spend Phase 3 on:
- autonomous merge bots
- enterprise approval matrices
- advanced static analysis engines
- full GitHub/GitLab parity
- line-level collaborative review
- release management
- CI/CD replacement
- billing
- enterprise RBAC
- organization-wide compliance workflows

The goal is to close the collaborative development lifecycle reliably.

## Recommended Implementation Order

```text
1. Completion Report
2. Review Domain Expansion
3. Immutable Review Snapshot
4. Review State Machine
5. request_review Preflight
6. Scope Deviation Detection
7. Git Revision Binding
8. AI Review Findings
9. Human Findings
10. Review Feedback MCP
11. Findings Resolution
12. Approval Rules
13. Review Invalidation
14. Merge Readiness
15. Merge Confirmation
16. Idempotent complete_task
17. Dependency Re-Evaluation
18. Contract Activation
19. Contract Versioning
20. Context Propagation
21. Project Decision Log
22. Realtime Review Events
23. Frontend Review Workspace
24. End-to-End Testing
```

Behavior and correctness come before visual polish.

## Main Phase 3 Demo

Developer A completes:

```text
T-102 Build Login API
```

Bob submits:

```text
Completion Report

Files:
- AuthController.ts
- AuthService.ts

Tests:
8 passed
0 failed

Contract:
POST /api/login
LoginResponse v2

Revision:
84fea12
```

Bob calls:

```text
request_review(T-102)
```

System creates immutable Review v1.

AI review warns:

```text
LoginResponse changed.

Affected task:
T-103 Login Frontend
```

Human reviewer requests:

```text
Add an invalid password test.
```

Task returns to IN_PROGRESS.

Bob fixes it and creates revision:

```text
97acd33
```

Review v2 is created.

Human approves Review v2.

System checks:

```text
approvedRevision == currentRevision
```

Merge readiness:

```text
READY_TO_MERGE
```

Merge is confirmed.

Task becomes DONE.

System automatically:
- releases reservations
- ends agent session
- activates LoginResponse v2
- re-evaluates dependencies
- unblocks T-103

T-103 now receives:

```text
Dependency completed:
T-102

Final active contract:
POST /api/login

LoginResponse v2
```

## Phase 3 Definition of Done

Phase 3 is complete when:

- agent can submit completion report
- request_review performs preflight
- review snapshot is immutable
- review is tied to a revision
- AI review creates structured findings
- humans can create structured findings
- blocking findings prevent approval
- findings can be resolved with audit history
- changes requested return task to active work
- new work invalidates stale approval
- human approval is required
- merge readiness can be calculated
- merge confirmation is stored
- completion is idempotent
- completion releases reservations
- completion ends agent sessions
- completion re-evaluates dependencies
- blocked tasks can automatically become ready
- final contracts become ACTIVE
- previous contracts can become SUPERSEDED
- final context reaches dependent tasks
- project decisions can be recorded and retrieved
- realtime updates work through review lifecycle
- backend tests cover invalid states
- type checking, linting, and builds pass

## Core Differentiator

Phase 2 answers:

> Are multiple developers and agents about to interfere with each other?

Phase 3 answers:

> Is this exact version of the work reviewed, validated, approved, merged, and safe for the rest of the project to depend on?

The platform is no longer only coordinating activity.

It is coordinating trust between tasks, humans, agents, contracts, and code revisions.

## One-Line Phase 3 Goal

**Turn coordinated agent work into reviewed, revision-bound, merge-safe project state that can reliably unlock and inform the next tasks.**
