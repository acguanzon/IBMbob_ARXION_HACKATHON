# PHASE 6 HANDOFF
# Integration Validation, Regression Intelligence, and Evidence-Based Repair Routing

## Phase 6 Objective

Phase 6 validates the integrated product after multiple independently coordinated changes are merged.

The core question is:

> Did the combined system actually build, test, and behave correctly after integration, and if not, what evidence can we use to route the failure back to the right work without pretending certainty we do not have?

The Phase 6 principle is:

> CI proves what failed. Deterministic evidence narrows where the problem likely came from. The platform then routes structured repair context to the right tasks and agents.

## Product Direction

Do not build another CI/CD platform.

The platform should consume CI evidence and connect it back into the multi-agent coordination system.

```text
Merged Work
   ↓
CI / Integration Validation
   ↓
Build / Test Evidence
   ↓
Regression Window
   ↓
Relevant Code Entities
   ↓
Candidate Changes
   ↓
Evidence-Based Attribution
   ↓
Regression Incident
   ↓
Repair Task
   ↓
Agent Receives Failure Context
   ↓
Fix
   ↓
Revalidation
   ↓
Incident Resolved
```

The platform must clearly distinguish:

```text
FACTS
vs
INFERENCES
vs
UNKNOWN
```

Never present inferred root cause as proven fact.

## Architecture Rules

1. CI provider results are factual evidence.
2. Regression attribution is never treated as fact unless deterministic evidence supports it.
3. Last-known-good and first-failing revisions are first-class concepts.
4. Flaky tests and environment failures reduce attribution confidence.
5. AI may explain evidence but may not fabricate causal certainty.
6. Repair tasks are suggestions until a human accepts or creates them.
7. Release readiness is deterministic.
8. Historical validation evidence remains auditable.

## Core Architecture

```text
Developers
   ↓
Collaboration Platform
   ↓
Coordination Backend
   ├── CI Evidence Store
   ├── Regression Engine
   ├── Test Impact Graph
   ├── Repair Router
   └── Release Readiness
   ↓
PostgreSQL
   ├── MCP Layer -> IBM Bob / Other Agents
   └── CI Provider -> GitHub Actions
```

## 1. CI Provider Abstraction

Create:

```text
CIProvider
```

Suggested operations:

```text
getPipelineRun()
getJobs()
getTests()
getArtifacts()
getLogs()
getStatus()
rerunPipeline()
getWorkflowMetadata()
```

First implementation:

```text
GitHubActionsProvider
```

Future providers may implement the same interface:

```text
GitLabCIProvider
JenkinsProvider
CircleCIProvider
```

Do not spread GitHub Actions-specific logic across the backend.

## 2. CI Integration Model

Create:

```text
ProjectCIIntegration
```

Fields:

```text
id
projectId
repositoryId
provider
workflowId
status
createdAt
updatedAt
```

All provider credentials remain server-side.

## 3. CI Event Ingestion

Ingest events such as:

```text
workflow started
workflow completed
job completed
test completed
artifact published
workflow cancelled
```

Flow:

```text
CI Provider
   ↓
Webhook / API Event
   ↓
Signature Verification
   ↓
Event Deduplication
   ↓
Normalize Event
   ↓
CI Event Processor
   ↓
Validation State Update
```

CI event processing must be idempotent.

## 4. Pipeline Run Model

Create:

```text
PipelineRun
```

Fields:

```text
id
projectId
repositoryId
provider
externalRunId
revision
branch
workflowName
status
startedAt
completedAt
```

Statuses:

```text
QUEUED
RUNNING
PASSED
FAILED
CANCELLED
SKIPPED
```

## 5. Pipeline Job Model

Create:

```text
PipelineJob
```

Fields:

```text
id
pipelineRunId
externalJobId
name
status
startedAt
completedAt
logReference
```

## 6. Test Result Model

Create:

```text
TestResult
```

Fields:

```text
id
pipelineRunId
pipelineJobId
suiteName
testName
status
durationMs
failureMessage
failureSignature
metadata
createdAt
```

Statuses:

```text
PASSED
FAILED
SKIPPED
FLAKY
UNKNOWN
```

Use a stable failure signature where possible so recurring failures can be grouped.

## 7. Separate Evidence from Attribution

This distinction is mandatory.

Example:

```text
FACT:
AuthIntegrationTest failed on revision 981ab21.

FACT:
LoginResponse changed between the last passing and first failing revisions.

INFERENCE:
T-102 may be related to the failure.

UNKNOWN:
Whether T-102 alone caused the regression.
```

Never store ambiguous statements such as:

```text
T-102 caused AuthIntegrationTest.
```

unless confirmed by deterministic evidence or a human.

## 8. Validation Baseline

Create:

```text
ValidationBaseline
```

Fields:

```text
id
projectId
branch
lastKnownGoodRevision
lastKnownGoodRunId
updatedAt
```

When a validated run passes, update the baseline.

## 9. First Failing Revision

When validation fails, capture:

```text
firstFailingRevision
```

Example:

```text
Last Known Good:
883cd19

First Failing:
981ab21
```

This establishes the regression window.

## 10. Regression Window

The platform should identify everything introduced between the last known good and first failing revision:

- commits
- tasks
- changed files
- changed entities
- changed contracts
- schema changes
- migrations
- relevant project decisions

This narrows the search space before any AI reasoning.

## 11. Regression Incident Model

Create:

```text
RegressionIncident
```

Fields:

```text
id
projectId
pipelineRunId
revision
lastKnownGoodRevision
firstFailingRevision
severity
title
description
status
detectedAt
resolvedAt
resolvedRevision
resolvedPipelineRunId
```

Statuses:

```text
OPEN
INVESTIGATING
REPAIR_IN_PROGRESS
VALIDATING
RESOLVED
DISMISSED
```

## 12. Incident Evidence Model

Create:

```text
IncidentEvidence
```

Fields:

```text
id
incidentId
type
source
entityId
taskId
testResultId
confidence
summary
metadata
createdAt
```

Evidence types:

```text
FAILED_TEST
CHANGED_FILE
CHANGED_CONTRACT
CHANGED_SCHEMA
DEPENDENCY_PATH
COMMIT_IN_WINDOW
FLAKY_HISTORY
ENVIRONMENT_SIGNAL
LOG_SIGNATURE
```

Sources:

```text
CI
GIT
DETERMINISTIC_ANALYZER
HISTORY
AI_EXPLANATION
```

## 13. Incident Candidate Model

Create:

```text
IncidentCandidate
```

Fields:

```text
id
incidentId
taskId
commitSha
entityId
confidence
score
reason
status
createdAt
```

Statuses:

```text
POSSIBLE
LIKELY
RULED_OUT
CONFIRMED
```

Only use `CONFIRMED` with deterministic evidence or human confirmation.

## 14. Candidate Scoring

Evidence signals may include:

```text
+ failed test directly covers changed entity
+ changed entity occurred inside regression window
+ contract changed
+ schema changed
+ failure signature matches changed behavior
+ last-known-good comparison points to same entity
- historically flaky test
- environment-level failure
- unrelated module
- candidate outside regression window
```

Rank changes or tasks, never developers.

## 15. Confidence Levels

Use:

```text
HIGH
MEDIUM
LOW
UNKNOWN
```

Suggested interpretation:

```text
HIGH
Multiple deterministic evidence paths agree.

MEDIUM
One strong deterministic signal or several weaker signals.

LOW
Mostly indirect or inferred relationship.

UNKNOWN
Insufficient evidence.
```

Always expose the reason.

## 16. Test-to-Code Relationships

Create:

```text
TestCodeRelationship
```

Fields:

```text
id
projectId
testIdentifier
entityId
relationship
source
confidence
createdAt
updatedAt
```

Relationships:

```text
COVERS
EXERCISES
DEPENDS_ON
ASSERTS
```

Sources:

```text
DECLARED
DETERMINISTIC
OBSERVED
INFERRED
```

## 17. Test Impact Analysis

For a changed task or revision, identify relevant tests.

Example:

```text
Changed:
POST /api/login
LoginResponse
```

Relevant tests:

```text
LoginControllerTest
AuthIntegrationTest
LoginResponseSchemaTest
```

Then calculate what was actually executed.

## 18. Validation Coverage

Create:

```text
ValidationCoverage
```

This is not line/code coverage.

Example:

```text
Relevant Tests:
8

Executed:
7

Passed:
7

Failed:
0

Not Executed:
1
```

States:

```text
COMPLETE
PARTIAL
INSUFFICIENT
UNKNOWN
```

## 19. Flaky Test Awareness

Create:

```text
TestStability
```

Fields:

```text
id
projectId
testIdentifier
windowSize
passCount
failCount
flakyCount
stabilityRate
updatedAt
```

If a historically flaky test fails:

- lower attribution confidence
- consider rerun before opening a high-severity repair incident
- do not immediately blame a task

## 20. Environment Failure Classification

Not every CI failure is caused by code.

Classify:

```text
CODE_REGRESSION
TEST_FLAKE
ENVIRONMENT_FAILURE
DEPENDENCY_FAILURE
CONFIGURATION_FAILURE
UNKNOWN
```

Signals may include:

```text
runner unavailable
network failure
dependency registry outage
timeout
database service unavailable
secret missing
test assertion failure
compile failure
type failure
```

Avoid blaming application tasks for infrastructure failures.

## 21. Failure Signature Grouping

Normalize repeated failures when possible.

Example:

```text
AuthIntegrationTest
Expected user field but received undefined
```

becomes a reusable signature such as:

```text
AUTH_LOGINRESPONSE_USER_MISSING
```

This lets the platform recognize recurrence.

## 22. Historical Validation Intelligence

Use observed history.

Example:

```text
LoginResponse changes historically affect:
- AuthIntegrationTest
- LoginUIIntegrationTest
- MobileAuthTest
```

Simple historical frequency and observed relationships are enough.

Do not claim machine learning unless ML is actually implemented.

## 23. Validation Failure Context Package

Create:

```text
ValidationFailureContext
```

Example:

```text
INCIDENT
I-18

PIPELINE
CI #551

REVISION
981ab21

FAILED TEST
AuthIntegrationTest

LAST KNOWN GOOD
883cd19

REGRESSION WINDOW
7 commits

AFFECTED ENTITY
LoginResponse

CANDIDATES
T-102 HIGH
T-118 MEDIUM

FLAKY STATUS
Stable

PROJECT DECISION
LoginResponse must include token + user
```

Expose this through MCP.

## 24. Repair Task Proposal

Allow:

```text
Create Repair Task
```

but require a human to accept or edit it.

Example:

```text
Title:
Fix authentication integration regression

Generated From:
Incident I-18

Evidence:
AuthIntegrationTest failing
LoginResponse changed in T-102
Last known good = 883cd19
```

Do not auto-assign developers.

## 25. Repair Task Context

When repair work begins, `begin_task()` should include:

```text
SOURCE INCIDENT
FAILED TEST
FAILURE REVISION
LAST KNOWN GOOD
REGRESSION WINDOW
CANDIDATE CHANGES
CANDIDATE CONFIDENCE
AFFECTED CONTRACT
RELEVANT DECISIONS
FLAKY TEST STATUS
```

This plugs directly into the Phase 5 context-package system.

## 26. Revalidation Loop

After a repair merge:

```text
Repair merged
   ↓
CI reruns
   ↓
Failed tests re-evaluated
   ↓
Incident remains or resolves
```

If validation passes:

```text
incident.status = RESOLVED
resolvedRevision = ...
resolvedPipelineRunId = ...
```

## 27. Incident Resolution Criteria

Do not resolve an incident simply because a repair task is DONE.

Resolve only when validation evidence supports it.

Example:

```text
Previously failing test:
PASS

Required integration suite:
PASS

Incident:
RESOLVED
```

If CI is unavailable:

```text
Incident:
VALIDATING or UNKNOWN
```

## 28. Release Readiness

Create:

```text
ReleaseReadiness
```

States:

```text
READY
READY_WITH_WARNINGS
NOT_READY
UNKNOWN
```

Deterministic examples:

```text
Critical required test failed
-> NOT_READY

Required integration suite failed
-> NOT_READY

CI unavailable
-> UNKNOWN

All required validation passed
-> READY

Only non-blocking gaps remain
-> READY_WITH_WARNINGS
```

AI may explain readiness but must not override deterministic evidence.

## 29. Separate Task Completion from Integration Health

Do not reopen historical tasks incorrectly.

Track:

```text
UNVERIFIED
VALIDATING
VERIFIED
IMPACTED
REGRESSION_DETECTED
```

Example:

```text
T-102
Task Status: DONE
Integration Status: IMPACTED
```

## 30. Task Validation State

Create:

```text
TaskValidationState
```

Fields:

```text
taskId
status
latestValidatedRevision
latestPipelineRunId
latestIncidentId
updatedAt
```

## 31. Validation Context Updates

If a completed contract becomes impacted:

```text
VALIDATION CONTEXT UPDATE

LoginResponse validation is failing on main.

Your task consumes LoginResponse.

Do not assume the current contract is healthy until incident I-18 is resolved.
```

Affected active agents should receive this through existing context-update mechanisms.

## 32. MCP Tools Required by End of Phase 6

Add:

```text
get_validation_status(task_id)
get_pipeline_status(project_id)
get_failed_tests(revision)
get_validation_failure_context(incident_id)
get_relevant_tests(task_id)
get_release_readiness(project_id)
get_regression_incidents(project_id)
```

Optional if provider permissions allow:

```text
request_pipeline_rerun(run_id)
```

## 33. Incident Timeline

Every incident should have an auditable timeline.

Example:

```text
07:10 CI #551 failed
07:11 Incident I-18 created
07:11 Regression window calculated
07:12 T-102 identified HIGH confidence
07:13 Repair task T-201 created
07:20 Repair merged
07:22 CI #552 started
07:25 CI #552 passed
07:25 Incident I-18 resolved
```

## 34. Validation Dashboard

Add:

```text
Validation
```

Example:

```text
LATEST REVISION
981ab21

BUILD
PASS

UNIT TESTS
144 / 144 PASS

INTEGRATION
1 FAILED

RELEASE READINESS
NOT_READY

OPEN REGRESSIONS
1
```

## 35. Incident View

Example:

```text
REGRESSION I-18

Severity:
HIGH

Classification:
CODE_REGRESSION

Failed Test:
AuthIntegrationTest

Last Known Good:
883cd19

First Failing:
981ab21

Regression Window:
7 commits

Affected Entity:
LoginResponse

Candidates:
T-102 HIGH
T-118 MEDIUM

Flaky Status:
STABLE

[Create Repair Task]
[Dismiss]
```

## 36. Main Demo

1. T-102 and T-103 pass review and merge.
2. GitHub Actions runs.
3. Build passes.
4. Unit tests pass.
5. Integration test fails.
6. Platform identifies last known good and first failing revisions.
7. Regression window is calculated.
8. Candidate tasks are identified from deterministic evidence.
9. Confidence is shown for each candidate.
10. Human creates repair task.
11. Bob receives structured failure context.
12. Repair merges.
13. CI reruns.
14. Validation passes.
15. Incident becomes RESOLVED.
16. Release readiness changes from NOT_READY to READY.

## 37. Secondary Demo: Flaky Test

A historically flaky test fails.

The system should show:

```text
FAILURE DETECTED

Test:
NotificationTimingTest

Stability:
82%

Classification:
POSSIBLE TEST FLAKE

Attribution Confidence:
LOW

Recommended:
Rerun before creating a repair incident.
```

This proves the system does not blindly blame code.

## 38. Security

Minimum requirements:

- CI credentials remain server-side
- webhook signatures are verified
- project authorization is enforced
- cross-project CI access is blocked
- scoped provider permissions are used
- rerun requests are audited
- CI logs are access-controlled
- secrets in logs are redacted
- external CI payloads are sanitized

## 39. Realtime Events

Add:

```text
pipeline.started
pipeline.completed
test.failed
test.passed
regression.detected
regression.updated
regression.resolved
candidate.created
candidate.updated
validation.readiness_changed
repair_task.proposed
repair_task.created
ci_context_update.created
```

## 40. Testing Requirements

Test:

### CI Events
- valid webhook
- invalid signature
- duplicate event
- retry event
- out-of-order event
- cancelled run

### Baselines
- first passing run
- new passing run
- first failing run
- multiple failures
- recovered passing run

### Regression Window
- single commit
- multiple commits
- no baseline
- merge commit
- branch mismatch

### Attribution
- direct test relationship
- contract relationship
- schema relationship
- multiple candidates
- no candidates
- candidate outside regression window

### Flaky Tests
- stable failure
- historically flaky failure
- rerun pass
- rerun fail

### Environment Failures
- runner unavailable
- network failure
- dependency outage
- application assertion failure

### Incident Lifecycle
- open
- investigating
- repair in progress
- validating
- resolved
- dismissed

### Release Readiness
- all pass
- required suite fail
- CI unavailable
- warning-only state
- open critical incident

### Security
- cross-project access denied
- invalid CI token
- secret redaction
- unauthorized rerun denied

## 41. Non-Goals

Do not build:

```text
full CI/CD replacement
deployment orchestration
production monitoring
APM platform
autonomous rollback
autonomous merge
unrestricted AI repair
full root-cause analysis engine
all CI providers
complex ML attribution model
```

Phase 6 is an evidence-routing and validation-intelligence layer.

## 42. Recommended Implementation Order

```text
1. CI Provider Abstraction
2. GitHub Actions Integration
3. CI Event Verification + Deduplication
4. PipelineRun Model
5. PipelineJob Model
6. TestResult Model
7. Validation Baseline
8. Last Known Good Revision
9. Regression Window
10. RegressionIncident Model
11. IncidentEvidence Model
12. TestCodeRelationship Model
13. IncidentCandidate Model
14. Candidate Scoring
15. Confidence Rules
16. Flaky Test Awareness
17. Environment Failure Classification
18. Failure Signature Grouping
19. ValidationFailureContext
20. Repair Task Proposal
21. MCP Validation Tools
22. TaskValidationState
23. Validation Coverage
24. Release Readiness
25. Validation Context Updates
26. Validation Dashboard
27. Incident View
28. Revalidation Loop
29. End-to-End Tests
```

## 43. Phase 6 Definition of Done

Phase 6 is complete when:

- a supported CI provider can be connected
- CI events are verified and deduplicated
- pipeline runs are stored
- jobs are stored
- test results are stored
- last known good revision is tracked
- first failing revision is tracked
- regression window is calculated
- incidents are created from meaningful failures
- evidence is stored separately from attribution
- test-to-code relationships exist
- candidate changes are generated from evidence
- candidates include confidence and reasons
- flaky tests reduce attribution confidence
- environment failures are classified separately
- validation failure context is available through MCP
- repair tasks can be proposed from incidents
- humans approve repair-task creation
- repair agents receive structured context
- revalidation can resolve incidents
- incidents are not resolved without validation evidence
- release readiness is deterministic
- task integration health is separate from task completion
- affected active agents receive validation context updates
- audit history is preserved
- authorization prevents cross-project CI access
- secrets are protected/redacted
- tests cover duplicate, out-of-order, flaky, and environment-failure scenarios
- type checking passes
- linting passes
- builds pass

## Core Differentiator

Phase 5 asks:

> How does the next coding agent continue with the right context?

Phase 6 asks:

> After multiple agents' work is integrated, does the system still work, and if not, how do we route evidence back into the right repair workflow without pretending certainty?

## One-Line Phase 6 Goal

**Turn CI failures into evidence-based, confidence-scored repair context that reaches the right coding agents and is only considered resolved after integration validation passes.**
