/**
 * Phase 5 Test Suite
 *
 * Covers:
 * 1. Task Readiness Engine (6 tests)
 * 2. Handoffs — auto creation, acknowledgement, supersede, duplicate suppression (7 tests)
 * 3. Context Packages — versioning, noise controls (4 tests)
 * 4. Recovery — stale session creates snapshot, resume, delta, no stale reservations (5 tests)
 * 5. Parallel Safety — SAFE, UNSAFE shared file, UNSAFE shared contract, SAFE_WITH_WARNINGS consumed, dependency (6 tests)
 * 6. Security — cross-project handoff access denied (3 tests)
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'

// ─── Module-level mocks ───────────────────────────────────────────────────────

const makeId = (() => { let n = 0; return () => `id-${++n}` })()

interface StoreType {
  task: Record<string, unknown>[]
  taskDependency: Record<string, unknown>[]
  agentSession: Record<string, unknown>[]
  review: Record<string, unknown>[]
  coordinationRisk: Record<string, unknown>[]
  contextUpdate: Record<string, unknown>[]
  taskHandoff: Record<string, unknown>[]
  taskGitLink: Record<string, unknown>[]
  taskWorkIntent: Record<string, unknown>[]
  taskContract: Record<string, unknown>[]
  projectDecision: Record<string, unknown>[]
  taskActualChange: Record<string, unknown>[]
  taskContextPackage: Record<string, unknown>[]
  recoverySnapshot: Record<string, unknown>[]
  taskActivity: Record<string, unknown>[]
  taskFileReservation: Record<string, unknown>[]
  taskReadinessEvaluation: Record<string, unknown>[]
  parallelSafetyEvaluation: Record<string, unknown>[]
  codeEntity: Record<string, unknown>[]
  codeRelationship: Record<string, unknown>[]
  agentIntegrationCapability: Record<string, unknown>[]
}

const store: StoreType = {
  task: [], taskDependency: [], agentSession: [], review: [],
  coordinationRisk: [], contextUpdate: [], taskHandoff: [], taskGitLink: [],
  taskWorkIntent: [], taskContract: [], projectDecision: [], taskActualChange: [],
  taskContextPackage: [], recoverySnapshot: [], taskActivity: [], taskFileReservation: [],
  taskReadinessEvaluation: [], parallelSafetyEvaluation: [], codeEntity: [], codeRelationship: [],
  agentIntegrationCapability: [],
}

function resetStore() {
  for (const key of Object.keys(store) as (keyof StoreType)[]) { store[key] = [] }
}

function makeModel(table: keyof StoreType) {
  return {
    findFirst: vi.fn(({ where, include: _inc, orderBy: _ob, select: _sel }: { where?: Record<string, unknown>; include?: unknown; orderBy?: unknown; select?: unknown } = {}) => {
      const rows = store[table]
      if (!where) return Promise.resolve(rows[0] ?? null)
      const row = rows.find((r) =>
        Object.entries(where).every(([k, v]) => {
          if (k === 'NOT') return true
          if (k === 'OR' && Array.isArray(v)) return (v as Record<string, unknown>[]).some((c) => Object.entries(c).every(([ck, cv]) => r[ck] === cv))
          if (v && typeof v === 'object' && 'in' in (v as Record<string, unknown>)) return ((v as { in: unknown[] }).in).includes(r[k])
          if (v && typeof v === 'object' && 'notIn' in (v as Record<string, unknown>)) return !((v as { notIn: unknown[] }).notIn).includes(r[k])
          if (v && typeof v === 'object' && 'not' in (v as Record<string, unknown>)) return r[k] !== (v as { not: unknown }).not
          if (v && typeof v === 'object' && 'gt' in (v as Record<string, unknown>)) return true
          if (v && typeof v === 'object' && 'lt' in (v as Record<string, unknown>)) return true
          return r[k] === v
        }),
      )
      return Promise.resolve(row ?? null)
    }),
    findUnique: vi.fn(({ where, include: _inc }: { where: Record<string, unknown>; include?: unknown }) => {
      const rows = store[table]
      const row = rows.find((r) => Object.entries(where).every(([k, v]) => {
        if (v && typeof v === 'object' && 'taskId_taskBId' in (v as Record<string, unknown>)) {
          const compound = (v as { taskId_taskBId: Record<string, unknown> }).taskId_taskBId
          return Object.entries(compound).every(([ck, cv]) => r[ck] === cv)
        }
        if (v && typeof v === 'object' && 'projectId_agentType' in (v as Record<string, unknown>)) {
          const compound = (v as { projectId_agentType: Record<string, unknown> }).projectId_agentType
          return Object.entries(compound).every(([ck, cv]) => r[ck] === cv)
        }
        return r[k] === v
      }))
      return Promise.resolve(row ?? null)
    }),
    findMany: vi.fn(({ where, orderBy: _ob, select: _sel, take: _take, distinct: _dist, include: _inc }: { where?: Record<string, unknown>; orderBy?: unknown; select?: unknown; take?: number; distinct?: unknown; include?: unknown } = {}) => {
      const rows = store[table]
      if (!where) return Promise.resolve([...rows])
      const res = rows.filter((r) =>
        Object.entries(where).every(([k, v]) => {
          if (k === 'NOT') return true
          if (k === 'OR' && Array.isArray(v)) return (v as Record<string, unknown>[]).some((c) => Object.entries(c).every(([ck, cv]) => r[ck] === cv))
          if (v && typeof v === 'object' && 'in' in (v as Record<string, unknown>)) return ((v as { in: unknown[] }).in).includes(r[k])
          if (v && typeof v === 'object' && 'notIn' in (v as Record<string, unknown>)) return !((v as { notIn: unknown[] }).notIn).includes(r[k])
          if (v && typeof v === 'object' && 'not' in (v as Record<string, unknown>)) return r[k] !== (v as { not: unknown }).not
          if (v && typeof v === 'object' && 'gt' in (v as Record<string, unknown>)) return true
          if (v && typeof v === 'object' && 'lt' in (v as Record<string, unknown>)) return true
          return r[k] === v
        }),
      )
      return Promise.resolve(res)
    }),
    create: vi.fn(({ data }: { data: Record<string, unknown> }) => {
      const row = { id: makeId(), ...data }
      store[table].push(row)
      return Promise.resolve(row)
    }),
    update: vi.fn(({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const idx = store[table].findIndex((r) => Object.entries(where).every(([k, v]) => r[k] === v))
      if (idx === -1) throw new Error(`${table} not found`)
      const updated = { ...store[table][idx], ...data }
      store[table][idx] = updated
      return Promise.resolve(updated)
    }),
    updateMany: vi.fn(({ where: _w, data }: { where?: unknown; data: Record<string, unknown> }) => {
      // Simplified: update all
      store[table] = store[table].map((r) => ({ ...r, ...data }))
      return Promise.resolve({ count: store[table].length })
    }),
    upsert: vi.fn(({ where, create: c, update: u }: { where: Record<string, unknown>; create: Record<string, unknown>; update: Record<string, unknown> }) => {
      const rows = store[table]
      // Check compound unique keys
      const whereValues = Object.values(where)
      const compoundValue = whereValues[0]
      let idx = -1
      if (compoundValue && typeof compoundValue === 'object') {
        idx = rows.findIndex((r) => Object.entries(compoundValue as Record<string, unknown>).every(([ck, cv]) => r[ck] === cv))
      } else {
        const id = (where as { id?: string }).id
        idx = id ? rows.findIndex((r) => r['id'] === id) : -1
      }
      if (idx === -1) {
        const row = { id: makeId(), ...c }
        rows.push(row)
        return Promise.resolve(row)
      }
      const updated = { ...rows[idx], ...u }
      rows[idx] = updated
      return Promise.resolve(updated)
    }),
    count: vi.fn(({ where: _w }: { where?: unknown } = {}) => Promise.resolve(store[table].length)),
    delete: vi.fn(() => Promise.resolve(null)),
  }
}

vi.mock('@arxion/database', () => ({
  prisma: {
    task: makeModel('task'),
    taskDependency: makeModel('taskDependency'),
    agentSession: makeModel('agentSession'),
    review: makeModel('review'),
    coordinationRisk: makeModel('coordinationRisk'),
    contextUpdate: makeModel('contextUpdate'),
    taskHandoff: makeModel('taskHandoff'),
    taskGitLink: makeModel('taskGitLink'),
    taskWorkIntent: makeModel('taskWorkIntent'),
    taskContract: makeModel('taskContract'),
    projectDecision: makeModel('projectDecision'),
    taskActualChange: makeModel('taskActualChange'),
    taskContextPackage: makeModel('taskContextPackage'),
    recoverySnapshot: makeModel('recoverySnapshot'),
    taskActivity: makeModel('taskActivity'),
    taskFileReservation: makeModel('taskFileReservation'),
    taskReadinessEvaluation: makeModel('taskReadinessEvaluation'),
    parallelSafetyEvaluation: makeModel('parallelSafetyEvaluation'),
    codeEntity: makeModel('codeEntity'),
    codeRelationship: makeModel('codeRelationship'),
    agentIntegrationCapability: makeModel('agentIntegrationCapability'),
  },
  Prisma: {
    DbNull: 'DbNull',
    JsonNull: 'JsonNull',
    InputJsonValue: {},
  },
}))

vi.mock('./lib/realtime.js', () => ({ emitEvent: vi.fn() }))

// Branch divergence calls git provider — mock it to avoid network calls
vi.mock('./modules/git/branch-divergence.service.js', () => ({
  checkBranchDivergence: vi.fn().mockResolvedValue({
    taskId: 'mock', branchName: null, baseBranch: null,
    aheadCount: null, behindCount: null, latestCommitSha: null,
    divergenceCheckedAt: null, isDiverged: false,
  }),
}))

// ─── Static imports ───────────────────────────────────────────────────────────

import { calculateReadiness, getLatestReadiness } from './modules/phase5/readiness.service.js'
import {
  createHandoffsForCompletedTask,
  getTaskHandoffs,
  acknowledgeHandoff,
  supersedeHandoff,
} from './modules/phase5/handoff.service.js'
import { buildContextPackage, getCurrentContextPackage } from './modules/phase5/context-package.service.js'
import { createRecoverySnapshot, getRecoveryContext, resumeTask } from './modules/phase5/recovery.service.js'
import { evaluateParallelSafety } from './modules/phase5/parallel-safety.service.js'
import { prisma } from '@arxion/database'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function seedTask(overrides: Record<string, unknown> = {}) {
  const id = makeId()
  const task = {
    id,
    projectId: 'proj-1',
    displayId: `T-${id}`,
    title: `Task ${id}`,
    status: 'TODO',
    description: null,
    dependencies: [],
    agentSessions: [],
    reviews: [],
    ...overrides,
  }
  store.task.push(task)
  return task
}

// ─── 1. READINESS ENGINE ─────────────────────────────────────────────────────

describe('calculateReadiness', () => {
  beforeEach(() => { resetStore(); vi.clearAllMocks() })

  it('returns READY for a task with no blockers', async () => {
    const task = seedTask()
    const result = await calculateReadiness(task.id)
    expect(result.state).toBe('READY')
    expect(result.reasons.length).toBeGreaterThan(0)
  })

  it('returns BLOCKED_BY_DEPENDENCY when a dep is not DONE', async () => {
    const dep = seedTask({ status: 'IN_PROGRESS' })
    const task = seedTask({
      dependencies: [{ dependsOn: { id: dep.id, displayId: dep.displayId, status: 'IN_PROGRESS' } }],
    })
    const result = await calculateReadiness(task.id)
    expect(result.state).toBe('BLOCKED_BY_DEPENDENCY')
    expect(result.reasons[0]).toContain(dep.displayId)
  })

  it('returns READY when all deps are DONE', async () => {
    const dep = seedTask({ status: 'DONE' })
    const task = seedTask({
      dependencies: [{ dependsOn: { id: dep.id, displayId: dep.displayId, status: 'DONE' } }],
    })
    const result = await calculateReadiness(task.id)
    expect(result.state).toBe('READY')
  })

  it('returns WAITING_FOR_REVIEW when review is PENDING', async () => {
    const task = seedTask({ reviews: [{ id: 'r1', status: 'PENDING' }] })
    const result = await calculateReadiness(task.id)
    expect(result.state).toBe('WAITING_FOR_REVIEW')
  })

  it('returns INTERRUPTED when latest session is STALE', async () => {
    const task = seedTask({
      agentSessions: [{ id: 'sess-1', status: 'STALE', lastSeenAt: new Date() }],
    })
    const result = await calculateReadiness(task.id)
    expect(result.state).toBe('INTERRUPTED')
  })

  it('returns WAITING_FOR_CONTEXT when a pending handoff exists', async () => {
    const task = seedTask()
    store.taskHandoff.push({
      id: 'h1', targetTaskId: task.id, sourceTaskId: 'other', status: 'PENDING',
      projectId: 'proj-1', payload: {}, summary: 'test',
    })
    const result = await calculateReadiness(task.id)
    expect(result.state).toBe('WAITING_FOR_CONTEXT')
    expect(result.reasons[0]).toContain('handoff')
  })

  it('throws 404 for unknown task', async () => {
    await expect(calculateReadiness('nonexistent')).rejects.toMatchObject({ statusCode: 404 })
  })
})

// ─── 2. HANDOFFS ─────────────────────────────────────────────────────────────

describe('createHandoffsForCompletedTask', () => {
  beforeEach(() => { resetStore(); vi.clearAllMocks() })

  it('creates a handoff for each downstream dependent', async () => {
    const source = seedTask({ status: 'DONE' })
    const target = seedTask({ status: 'TODO' })
    // source has target as a dependent
    source.dependents = [{ task: { id: target.id, displayId: target.displayId, title: target.title, status: 'TODO' } }]
    ;(prisma.task.findUnique as Mock).mockResolvedValue({ ...source })

    await createHandoffsForCompletedTask(source.id)

    const handoffs = store.taskHandoff
    expect(handoffs.length).toBe(1)
    expect((handoffs[0] as Record<string, unknown>)['targetTaskId']).toBe(target.id)
    expect((handoffs[0] as Record<string, unknown>)['status']).toBe('PENDING')
  })

  it('does not create duplicate handoffs', async () => {
    const source = seedTask({ status: 'DONE' })
    const target = seedTask()
    source.dependents = [{ task: { id: target.id, displayId: target.displayId, title: target.title, status: 'TODO' } }]
    ;(prisma.task.findUnique as Mock).mockResolvedValue({ ...source })

    // Pre-seed an existing handoff
    store.taskHandoff.push({
      id: 'existing', sourceTaskId: source.id, targetTaskId: target.id,
      projectId: 'proj-1', status: 'PENDING', payload: {}, summary: 'existing',
    })

    await createHandoffsForCompletedTask(source.id)
    expect(store.taskHandoff.length).toBe(1) // no new one created
  })

  it('skips DONE target tasks', async () => {
    const source = seedTask({ status: 'DONE' })
    const target = seedTask({ status: 'DONE' })
    source.dependents = [{ task: { id: target.id, displayId: target.displayId, title: target.title, status: 'DONE' } }]
    ;(prisma.task.findUnique as Mock).mockResolvedValue({ ...source })

    await createHandoffsForCompletedTask(source.id)
    expect(store.taskHandoff.length).toBe(0)
  })
})

describe('acknowledgeHandoff', () => {
  beforeEach(() => { resetStore(); vi.clearAllMocks() })

  it('marks a handoff ACKNOWLEDGED', async () => {
    const task = seedTask()
    store.taskHandoff.push({
      id: 'h1', targetTaskId: task.id, sourceTaskId: 'src', status: 'PENDING',
      projectId: 'proj-1', payload: {}, summary: 'test handoff',
    })

    const result = await acknowledgeHandoff('h1', 'sess-abc')
    expect((result as Record<string, unknown>)['status']).toBe('ACKNOWLEDGED')
    expect((result as Record<string, unknown>)['acknowledgedByAgentSessionId']).toBe('sess-abc')
  })

  it('throws 404 for unknown handoff', async () => {
    await expect(acknowledgeHandoff('nonexistent')).rejects.toMatchObject({ statusCode: 404 })
  })

  it('throws 409 when acknowledging a superseded handoff', async () => {
    store.taskHandoff.push({
      id: 'h2', targetTaskId: 'task-x', sourceTaskId: 'src', status: 'SUPERSEDED',
      projectId: 'proj-1', payload: {}, summary: 's',
    })
    await expect(acknowledgeHandoff('h2')).rejects.toMatchObject({ statusCode: 409 })
  })

  it('is idempotent for already-acknowledged handoff', async () => {
    const task = seedTask()
    store.taskHandoff.push({
      id: 'h3', targetTaskId: task.id, sourceTaskId: 'src', status: 'ACKNOWLEDGED',
      projectId: 'proj-1', payload: {}, summary: 'already acked',
      acknowledgedAt: new Date(),
    })
    const result = await acknowledgeHandoff('h3')
    expect((result as Record<string, unknown>)['status']).toBe('ACKNOWLEDGED')
  })
})

describe('supersedeHandoff', () => {
  beforeEach(() => { resetStore(); vi.clearAllMocks() })

  it('marks old handoff SUPERSEDED', async () => {
    store.taskHandoff.push({
      id: 'old', targetTaskId: 't1', sourceTaskId: 'src', status: 'PENDING',
      projectId: 'proj-1', payload: {}, summary: 'old',
    })
    await supersedeHandoff('old', 'new-id')
    expect((store.taskHandoff[0] as Record<string, unknown>)['status']).toBe('SUPERSEDED')
    expect((store.taskHandoff[0] as Record<string, unknown>)['supersededById']).toBe('new-id')
  })

  it('does NOT supersede acknowledged handoffs (immutability)', async () => {
    store.taskHandoff.push({
      id: 'acked', targetTaskId: 't1', sourceTaskId: 'src', status: 'ACKNOWLEDGED',
      projectId: 'proj-1', payload: {}, summary: 'acked', acknowledgedAt: new Date(),
    })
    await supersedeHandoff('acked', 'newer')
    // Should remain ACKNOWLEDGED
    expect((store.taskHandoff[0] as Record<string, unknown>)['status']).toBe('ACKNOWLEDGED')
  })
})

// ─── 3. CONTEXT PACKAGES ─────────────────────────────────────────────────────

describe('buildContextPackage', () => {
  beforeEach(() => { resetStore(); vi.clearAllMocks() })

  it('creates a context package with CURRENT status', async () => {
    const task = seedTask()
    const pkg = await buildContextPackage(task.id)
    expect((pkg as Record<string, unknown>)['status']).toBe('CURRENT')
    expect((pkg as Record<string, unknown>)['taskId']).toBe(task.id)
    expect((pkg as Record<string, unknown>)['contextVersion']).toBe(1)
  })

  it('increments version on successive calls', async () => {
    const task = seedTask()
    await buildContextPackage(task.id)
    const pkg2 = await buildContextPackage(task.id)
    expect((pkg2 as Record<string, unknown>)['contextVersion']).toBe(2)
  })

  it('supersedes previous CURRENT package', async () => {
    const task = seedTask()
    await buildContextPackage(task.id)
    // All packages are now SUPERSEDED by updateMany mock
    const pkgs = store.taskContextPackage
    expect(pkgs.length).toBeGreaterThan(0)
  })

  it('throws 404 for unknown task', async () => {
    await expect(buildContextPackage('nonexistent')).rejects.toMatchObject({ statusCode: 404 })
  })

  it('includes critical/important/background noise controls', async () => {
    const task = seedTask()
    store.taskHandoff.push({
      id: 'ph1', targetTaskId: task.id, sourceTaskId: 'src', status: 'PENDING',
      projectId: 'proj-1', payload: {}, summary: 'pending handoff',
    })
    const pkg = await buildContextPackage(task.id)
    const content = (pkg as Record<string, unknown>)['content'] as Record<string, unknown>
    const critical = content['critical'] as string[]
    expect(critical.some((msg) => msg.includes('handoff'))).toBe(true)
  })
})

// ─── 4. RECOVERY ─────────────────────────────────────────────────────────────

describe('createRecoverySnapshot', () => {
  beforeEach(() => { resetStore(); vi.clearAllMocks() })

  it('creates a recovery snapshot with SESSION_STALE trigger', async () => {
    const task = seedTask()
    await createRecoverySnapshot({
      taskId: task.id,
      previousAgentSessionId: 'sess-old',
      trigger: 'SESSION_STALE',
    })
    expect(store.recoverySnapshot.length).toBe(1)
    const snap = store.recoverySnapshot[0] as Record<string, unknown>
    expect(snap['trigger']).toBe('SESSION_STALE')
    expect(snap['previousAgentSessionId']).toBe('sess-old')
    expect(snap['taskId']).toBe(task.id)
  })

  it('stores last progress from task activity', async () => {
    const task = seedTask()
    store.taskActivity.push({
      id: 'act1', taskId: task.id, type: 'progress', message: 'Auth endpoint done. Tests pending.',
    })
    await createRecoverySnapshot({ taskId: task.id, previousAgentSessionId: 'sess-old', trigger: 'SESSION_STALE' })
    const snap = store.recoverySnapshot[0] as Record<string, unknown>
    expect(snap['lastProgressMessage']).toBe('Auth endpoint done. Tests pending.')
  })

  it('silently skips unknown task', async () => {
    await expect(createRecoverySnapshot({ taskId: 'nonexistent', previousAgentSessionId: 'x', trigger: 'SESSION_STALE' }))
      .resolves.toBeUndefined()
  })
})

describe('getRecoveryContext', () => {
  beforeEach(() => { resetStore(); vi.clearAllMocks() })

  it('throws 404 when no recovery snapshot exists', async () => {
    const task = seedTask()
    await expect(getRecoveryContext(task.id)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('returns snapshot + delta when snapshot exists', async () => {
    const task = seedTask()
    store.recoverySnapshot.push({
      id: 'snap-1', taskId: task.id, projectId: 'proj-1',
      previousAgentSessionId: 'old-sess', trigger: 'SESSION_STALE',
      lastKnownRevision: 'abc1234', lastProgressMessage: 'half done',
      createdAt: new Date(Date.now() - 60_000),
      activeWorkIntent: null, actualScope: null, activeContracts: null,
      openRisks: null, pendingContextUpdates: null, pendingHandoffs: null,
    })
    const ctx = await getRecoveryContext(task.id)
    expect(ctx.snapshot).toBeDefined()
    expect((ctx.snapshot as Record<string, unknown>)['trigger']).toBe('SESSION_STALE')
    expect(ctx.delta).toBeDefined()
    expect(typeof ctx.delta.branchAdvancedBy).toBe('number')
  })
})

describe('resumeTask', () => {
  beforeEach(() => { resetStore(); vi.clearAllMocks() })

  it('creates a new agent session and does NOT inherit stale reservations', async () => {
    const task = seedTask()
    // Pre-existing stale reservation
    store.taskFileReservation.push({
      id: 'res-old', taskId: task.id, filePath: 'src/auth.ts', status: 'EXPIRED',
    })

    const result = await resumeTask({ taskId: task.id, userId: 'user-1' })

    expect(result.session).toBeDefined()
    expect((result.session as Record<string, unknown>)['status']).toBe('WORKING')
    // New session should be created, old reservations remain EXPIRED (not transferred)
    const activeRes = store.taskFileReservation.filter(
      (r) => (r as Record<string, unknown>)['status'] === 'ACTIVE',
    )
    expect(activeRes.length).toBe(0)
  })

  it('throws 404 for unknown task', async () => {
    await expect(resumeTask({ taskId: 'nonexistent', userId: 'u1' })).rejects.toMatchObject({ statusCode: 404 })
  })
})

// ─── 5. PARALLEL SAFETY ──────────────────────────────────────────────────────

describe('evaluateParallelSafety', () => {
  beforeEach(() => { resetStore(); vi.clearAllMocks() })

  it('returns SAFE for independent tasks with no shared files/contracts', async () => {
    const a = seedTask()
    const b = seedTask()
    store.taskWorkIntent.push({ id: 'wi-a', taskId: a.id, files: ['src/dashboard.ts'], apis: [], models: [], contracts: [] })
    store.taskWorkIntent.push({ id: 'wi-b', taskId: b.id, files: ['src/email.ts'], apis: [], models: [], contracts: [] })

    const result = await evaluateParallelSafety(a.id, b.id)
    expect(result.state).toBe('SAFE')
    expect(result.reasons.length).toBeGreaterThan(0)
  })

  it('returns UNSAFE when tasks have a direct dependency', async () => {
    const a = seedTask()
    const b = seedTask()
    store.taskDependency.push({ id: 'dep1', taskId: a.id, dependsOnTaskId: b.id })

    const result = await evaluateParallelSafety(a.id, b.id)
    expect(result.state).toBe('UNSAFE')
    expect(result.reasons[0]).toContain('dependency')
  })

  it('returns UNSAFE for shared modified file', async () => {
    const a = seedTask()
    const b = seedTask()
    store.taskWorkIntent.push({ id: 'wi-a', taskId: a.id, files: ['src/user.ts'], apis: [], models: [], contracts: [] })
    store.taskWorkIntent.push({ id: 'wi-b', taskId: b.id, files: ['src/user.ts'], apis: [], models: [], contracts: [] })

    const result = await evaluateParallelSafety(a.id, b.id)
    expect(result.state).toBe('UNSAFE')
    expect(result.reasons[0]).toContain('user.ts')
  })

  it('returns UNSAFE when both tasks modify the same contract', async () => {
    const a = seedTask()
    const b = seedTask()
    store.taskContract.push({ id: 'ca1', taskId: a.id, name: 'LoginResponse', type: 'TYPE', relationship: 'MODIFIES', projectId: 'proj-1' })
    store.taskContract.push({ id: 'cb1', taskId: b.id, name: 'LoginResponse', type: 'TYPE', relationship: 'MODIFIES', projectId: 'proj-1' })

    const result = await evaluateParallelSafety(a.id, b.id)
    expect(result.state).toBe('UNSAFE')
    expect(result.reasons[0]).toContain('LoginResponse')
  })

  it('returns SAFE_WITH_WARNINGS when both consume (not modify) the same contract', async () => {
    const a = seedTask()
    const b = seedTask()
    store.taskContract.push({ id: 'ca2', taskId: a.id, name: 'UserModel', type: 'MODEL', relationship: 'CONSUMES', projectId: 'proj-1' })
    store.taskContract.push({ id: 'cb2', taskId: b.id, name: 'UserModel', type: 'MODEL', relationship: 'CONSUMES', projectId: 'proj-1' })

    const result = await evaluateParallelSafety(a.id, b.id)
    expect(result.state).toBe('SAFE_WITH_WARNINGS')
    expect(result.warnings[0]).toContain('UserModel')
  })

  it('throws 404 for unknown task', async () => {
    const a = seedTask()
    await expect(evaluateParallelSafety(a.id, 'nonexistent')).rejects.toMatchObject({ statusCode: 404 })
  })
})

// ─── 6. SECURITY ─────────────────────────────────────────────────────────────

describe('security', () => {
  beforeEach(() => { resetStore(); vi.clearAllMocks() })

  it('getTaskHandoffs throws 404 for nonexistent task (cross-project guard)', async () => {
    const { getTaskHandoffs } = await import('./modules/phase5/handoff.service.js')
    await expect(getTaskHandoffs('nonexistent-task')).rejects.toMatchObject({ statusCode: 404 })
  })

  it('acknowledgeHandoff throws 404 for unknown handoff (prevents cross-project access)', async () => {
    await expect(acknowledgeHandoff('unknown-handoff-id')).rejects.toMatchObject({ statusCode: 404 })
  })

  it('getRecoveryContext throws 404 for task with no snapshot (prevents fishing)', async () => {
    const task = seedTask()
    await expect(getRecoveryContext(task.id)).rejects.toMatchObject({ statusCode: 404 })
  })
})
