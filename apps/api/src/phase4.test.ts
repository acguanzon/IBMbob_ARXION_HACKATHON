/**
 * Phase 4 Test Suite — Static-import version
 *
 * All imports are static (top-level) so vitest's alias resolution works correctly.
 * Prisma and realtime are mocked via vi.mock at module level.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { createHash, createHmac } from 'crypto'

// ─── Module-level mocks (must be before any import of the mocked modules) ────

const makeId = (() => { let n = 0; return () => `id-${++n}` })()

interface StoreType {
  projectRepository: Record<string, unknown>[]
  externalEvent: Record<string, unknown>[]
  taskActualChange: Record<string, unknown>[]
  taskWorkIntent: Record<string, unknown>[]
  codeEntity: Record<string, unknown>[]
  codeRelationship: Record<string, unknown>[]
  contractChange: Record<string, unknown>[]
  coordinationRisk: Record<string, unknown>[]
  contextUpdate: Record<string, unknown>[]
  task: Record<string, unknown>[]
  taskFileReservation: Record<string, unknown>[]
  taskContract: Record<string, unknown>[]
  taskActivity: Record<string, unknown>[]
  taskGitLink: Record<string, unknown>[]
  project: Record<string, unknown>[]
}

const store: StoreType = {
  projectRepository: [], externalEvent: [], taskActualChange: [],
  taskWorkIntent: [], codeEntity: [], codeRelationship: [], contractChange: [],
  coordinationRisk: [], contextUpdate: [], task: [], taskFileReservation: [],
  taskContract: [], taskActivity: [], taskGitLink: [], project: [],
}

function resetStore() {
  for (const key of Object.keys(store) as (keyof StoreType)[]) {
    store[key] = []
  }
}

function makeModel(table: keyof StoreType) {
  return {
    findFirst: vi.fn(({ where }: { where?: Record<string, unknown> } = {}) => {
      const rows = store[table]
      if (!where) return Promise.resolve(rows[0] ?? null)
      const row = rows.find((r) =>
        Object.entries(where).every(([k, v]) => {
          if (k === 'NOT') return true
          if (k === 'OR' && Array.isArray(v)) {
            return (v as Record<string, unknown>[]).some((c) =>
              Object.entries(c).every(([ck, cv]) => r[ck] === cv),
            )
          }
          if (v && typeof v === 'object' && 'in' in (v as Record<string, unknown>)) {
            return ((v as { in: unknown[] }).in).includes(r[k])
          }
          if (v && typeof v === 'object' && 'gte' in (v as Record<string, unknown>)) return true
          return r[k] === v
        }),
      )
      return Promise.resolve(row ?? null)
    }),
    findUnique: vi.fn(({ where }: { where: Record<string, unknown> }) => {
      const rows = store[table]
      const row = rows.find((r) => Object.entries(where).every(([k, v]) => r[k] === v))
      return Promise.resolve(row ?? null)
    }),
    findMany: vi.fn(({ where }: { where?: Record<string, unknown> } = {}) => {
      const rows = store[table]
      if (!where) return Promise.resolve([...rows])
      const res = rows.filter((r) =>
        Object.entries(where).every(([k, v]) => {
          if (k === 'NOT') return true
          if (k === 'OR' && Array.isArray(v)) {
            return (v as Record<string, unknown>[]).some((c) =>
              Object.entries(c).every(([ck, cv]) => r[ck] === cv),
            )
          }
          if (v && typeof v === 'object' && 'in' in (v as Record<string, unknown>)) {
            return ((v as { in: unknown[] }).in).includes(r[k])
          }
          if (v && typeof v === 'object' && 'has' in (v as Record<string, unknown>)) {
            const val = (v as { has: unknown }).has
            return Array.isArray(r[k]) && (r[k] as unknown[]).includes(val)
          }
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
      const rows = store[table]
      const idx = rows.findIndex((r) => Object.entries(where).every(([k, v]) => r[k] === v))
      if (idx === -1) throw new Error(`${table} record not found`)
      const updated = { ...rows[idx], ...data }
      rows[idx] = updated
      return Promise.resolve(updated)
    }),
    upsert: vi.fn(({ where, create: c, update: u }: { where: Record<string, unknown>; create: Record<string, unknown>; update: Record<string, unknown> }) => {
      const rows = store[table]
      const id = where['id'] as string | undefined
      const idx = id && id !== '' ? rows.findIndex((r) => r['id'] === id) : -1
      if (idx === -1) {
        const row = { id: makeId(), ...c }
        rows.push(row)
        return Promise.resolve(row)
      }
      const updated = { ...rows[idx], ...u }
      rows[idx] = updated
      return Promise.resolve(updated)
    }),
    count: vi.fn(() => Promise.resolve(0)),
    delete: vi.fn(() => Promise.resolve(null)),
  }
}

vi.mock('@arxion/database', () => ({
  prisma: {
    projectRepository: makeModel('projectRepository'),
    externalEvent: makeModel('externalEvent'),
    taskActualChange: makeModel('taskActualChange'),
    taskWorkIntent: makeModel('taskWorkIntent'),
    codeEntity: makeModel('codeEntity'),
    codeRelationship: makeModel('codeRelationship'),
    contractChange: makeModel('contractChange'),
    coordinationRisk: makeModel('coordinationRisk'),
    contextUpdate: makeModel('contextUpdate'),
    task: makeModel('task'),
    taskFileReservation: makeModel('taskFileReservation'),
    taskContract: makeModel('taskContract'),
    taskActivity: makeModel('taskActivity'),
    taskGitLink: makeModel('taskGitLink'),
    project: makeModel('project'),
  },
}))

vi.mock('./lib/realtime.js', () => ({ emitEvent: vi.fn() }))

// ─── Static imports of services (after mocks) ────────────────────────────────

import { verifyGitHubSignature, processGitHubWebhook } from './modules/webhooks/webhook.service.js'
import { connectRepository } from './modules/repositories/repository.service.js'
import { parseEntitiesFromContent } from './modules/webhooks/entity-extractor.service.js'
import { getActualScopeAnalysis } from './modules/webhooks/actual-changes.service.js'
import { getProjectRisks, acknowledgeRisk } from './modules/webhooks/risk-engine.service.js'
import { getContextUpdates, acknowledgeContextUpdate } from './modules/webhooks/context-update.service.js'
import { checkBranchDivergence } from './modules/git/branch-divergence.service.js'
import { getImpactAnalysis } from './modules/webhooks/contract-change.service.js'
import { prisma } from '@arxion/database'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePayload(obj: unknown) { return Buffer.from(JSON.stringify(obj)) }
function sig(payload: Buffer, secret: string) {
  return `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`
}

// ─── 1. WEBHOOK SIGNATURE ────────────────────────────────────────────────────

describe('verifyGitHubSignature', () => {
  it('returns true for valid HMAC-SHA256', () => {
    const p = Buffer.from('{"test":1}')
    expect(verifyGitHubSignature(p, sig(p, 'secret'), 'secret')).toBe(true)
  })
  it('returns false for invalid signature', () => {
    const p = Buffer.from('{"test":1}')
    expect(verifyGitHubSignature(p, 'sha256=badhash', 'secret')).toBe(false)
  })
  it('returns false when signature is undefined', () => {
    expect(verifyGitHubSignature(Buffer.from('x'), undefined, 'secret')).toBe(false)
  })
})

// ─── 2. WEBHOOK PROCESSING ───────────────────────────────────────────────────

describe('processGitHubWebhook', () => {
  beforeEach(() => {
    resetStore()
    vi.clearAllMocks()
    // Seed a repo and task
    store.projectRepository.push({
      id: 'repo-1', projectId: 'proj-1', provider: 'GITHUB',
      owner: 'org', repository: 'repo', defaultBranch: 'main',
      webhookSecret: 'test-secret', status: 'CONNECTED',
    })
    store.task.push({ id: 'task-1', projectId: 'proj-1', displayId: 'T-1', title: 'T', status: 'IN_PROGRESS' })
    store.taskGitLink.push({
      id: 'link-1', taskId: 'task-1', repositoryId: 'repo-1',
      branchName: 'task/T-1', baseBranch: 'main', latestCommitSha: 'abc',
      mergeStatus: 'NOT_STARTED', updatedAt: new Date(),
      task: store.task[0],
    })
    // Make prisma mocks reflect the store
    ;(prisma.projectRepository.findUnique as Mock).mockImplementation(({ where }: { where: Record<string, unknown> }) =>
      Promise.resolve(store.projectRepository.find((r) => r['id'] === where['id']) ?? null))
    ;(prisma.externalEvent.findUnique as Mock).mockImplementation(({ where }: { where: Record<string, unknown> }) => {
      const compound = where['provider_externalEventId'] as { provider: string; externalEventId: string } | undefined
      if (compound) {
        return Promise.resolve(store.externalEvent.find((e) => e['provider'] === compound.provider && e['externalEventId'] === compound.externalEventId) ?? null)
      }
      return Promise.resolve(null)
    })
    ;(prisma.externalEvent.create as Mock).mockImplementation(({ data }: { data: Record<string, unknown> }) => {
      const row = { id: makeId(), ...data }
      store.externalEvent.push(row)
      return Promise.resolve(row)
    })
    ;(prisma.externalEvent.update as Mock).mockImplementation(({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const idx = store.externalEvent.findIndex((e) => e['id'] === where['id'])
      if (idx !== -1) store.externalEvent[idx] = { ...store.externalEvent[idx], ...data }
      return Promise.resolve(store.externalEvent[idx] ?? {})
    })
    ;(prisma.taskGitLink.findFirst as Mock).mockImplementation(() =>
      Promise.resolve(store.taskGitLink[0] ?? null))
    ;(prisma.taskGitLink.update as Mock).mockImplementation(({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const row = { ...store.taskGitLink[0], ...data }
      store.taskGitLink[0] = row
      return Promise.resolve(row)
    })
    ;(prisma.taskActivity.create as Mock).mockResolvedValue({ id: makeId() })
    ;(prisma.taskWorkIntent.findUnique as Mock).mockResolvedValue(null)
    ;(prisma.codeEntity.upsert as Mock).mockResolvedValue({ id: makeId() })
    ;(prisma.codeEntity.findMany as Mock).mockResolvedValue([])
    ;(prisma.taskActualChange.findFirst as Mock).mockResolvedValue(null)
    ;(prisma.taskActualChange.upsert as Mock).mockResolvedValue({ id: makeId() })
    ;(prisma.contractChange.findFirst as Mock).mockResolvedValue(null)
    ;(prisma.coordinationRisk.findFirst as Mock).mockResolvedValue(null)
    ;(prisma.taskFileReservation.findMany as Mock).mockResolvedValue([])
    ;(prisma.taskContract.findMany as Mock).mockResolvedValue([])
  })

  it('processes a valid push event', async () => {
    const p = makePayload({
      ref: 'refs/heads/task/T-1', after: 'def456', before: 'abc',
      repository: { id: 1, full_name: 'org/repo' },
      commits: [{ id: 'def456', added: ['src/auth.ts'], modified: [], removed: [] }],
      head_commit: { id: 'def456' },
    })
    const result = await processGitHubWebhook({ repositoryId: 'repo-1', deliveryId: 'del-1', eventType: 'push', signature: sig(p, 'test-secret'), rawPayload: p })
    expect(result.status).toBe('PROCESSED')
  })

  it('rejects invalid webhook signature', async () => {
    const p = makePayload({ ref: 'refs/heads/main', after: 'x', before: '', repository: { id: 1, full_name: 'org/repo' }, commits: [], head_commit: null })
    const result = await processGitHubWebhook({ repositoryId: 'repo-1', deliveryId: 'del-2', eventType: 'push', signature: 'sha256=badsig', rawPayload: p })
    expect(result.status).toBe('FAILED')
    expect(result.message).toContain('Invalid webhook signature')
  })

  it('ignores duplicate delivery', async () => {
    store.externalEvent.push({ id: 'e1', provider: 'GITHUB', externalEventId: 'del-dup', eventType: 'push', repositoryId: 'repo-1', payloadHash: 'h', status: 'PROCESSED' })
    const p = makePayload({ ref: 'refs/heads/main', after: 'x', before: '', repository: { id: 1, full_name: 'org/repo' }, commits: [], head_commit: null })
    const result = await processGitHubWebhook({ repositoryId: 'repo-1', deliveryId: 'del-dup', eventType: 'push', signature: sig(p, 'test-secret'), rawPayload: p })
    expect(result.status).toBe('IGNORED')
    expect(result.message).toContain('Duplicate')
  })

  it('ignores unsupported event type', async () => {
    const p = makePayload({ action: 'labeled' })
    const result = await processGitHubWebhook({ repositoryId: 'repo-1', deliveryId: 'del-3', eventType: 'issues', signature: sig(p, 'test-secret'), rawPayload: p })
    expect(result.status).toBe('IGNORED')
  })

  it('processes retry (different deliveryId, same payload)', async () => {
    const p = makePayload({
      ref: 'refs/heads/task/T-1', after: 'retry1', before: 'abc',
      repository: { id: 1, full_name: 'org/repo' },
      commits: [{ id: 'retry1', added: ['src/retry.ts'], modified: [], removed: [] }],
      head_commit: { id: 'retry1' },
    })
    const result = await processGitHubWebhook({ repositoryId: 'repo-1', deliveryId: 'del-retry-new', eventType: 'push', signature: sig(p, 'test-secret'), rawPayload: p })
    expect(result.status).toBe('PROCESSED')
  })

  it('returns FAILED for missing repository', async () => {
    const p = makePayload({})
    const result = await processGitHubWebhook({ repositoryId: 'no-repo', deliveryId: 'del-4', eventType: 'push', signature: sig(p, 'x'), rawPayload: p })
    expect(result.status).toBe('FAILED')
  })

  it('processes when no webhook secret configured (open endpoint)', async () => {
    store.projectRepository[0] = { ...store.projectRepository[0], webhookSecret: null }
    const p = makePayload({
      ref: 'refs/heads/task/T-1', after: 'open1', before: 'abc',
      repository: { id: 1, full_name: 'org/repo' },
      commits: [{ id: 'open1', added: [], modified: [], removed: [] }],
      head_commit: { id: 'open1' },
    })
    const result = await processGitHubWebhook({ repositoryId: 'repo-1', deliveryId: 'del-open', eventType: 'push', signature: undefined, rawPayload: p })
    expect(result.status).toBe('PROCESSED')
  })
})

// ─── 3. REPOSITORY CONNECTION ─────────────────────────────────────────────────

describe('connectRepository', () => {
  beforeEach(() => {
    resetStore()
    vi.clearAllMocks()
    ;(prisma.project.findUnique as Mock).mockImplementation(({ where }: { where: Record<string, unknown> }) =>
      Promise.resolve(store.project.find((p) => p['id'] === where['id']) ?? null))
    ;(prisma.projectRepository.findFirst as Mock).mockImplementation(() =>
      Promise.resolve(store.projectRepository[0] ?? null))
    ;(prisma.projectRepository.create as Mock).mockImplementation(({ data }: { data: Record<string, unknown> }) => {
      const row = { id: makeId(), ...data }
      store.projectRepository.push(row)
      return Promise.resolve(row)
    })
    ;(prisma.projectRepository.update as Mock).mockImplementation(({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const idx = store.projectRepository.findIndex((r) => r['id'] === where['id'])
      const updated = { ...store.projectRepository[idx], ...data }
      store.projectRepository[idx] = updated
      return Promise.resolve(updated)
    })
    ;(prisma.taskActivity.create as Mock).mockResolvedValue({ id: makeId() })
  })

  it('creates new repository connection', async () => {
    store.project.push({ id: 'proj-c1', name: 'P' })
    const repo = await connectRepository('proj-c1', { provider: 'GITHUB', owner: 'org', repository: 'repo', defaultBranch: 'main' })
    expect(repo.owner).toBe('org')
    expect(repo.status).toBe('CONNECTED')
  })

  it('reconnects existing repository', async () => {
    store.project.push({ id: 'proj-c2', name: 'P' })
    store.projectRepository.push({ id: 'repo-existing', projectId: 'proj-c2', owner: 'org', repository: 'repo', status: 'DISCONNECTED', provider: 'GITHUB', defaultBranch: 'main' })
    const repo = await connectRepository('proj-c2', { provider: 'GITHUB', owner: 'org', repository: 'repo', defaultBranch: 'main' })
    expect(repo.status).toBe('CONNECTED')
  })
})

// ─── 4. CODE ENTITY EXTRACTION ────────────────────────────────────────────────

describe('parseEntitiesFromContent', () => {
  it('extracts TypeScript interfaces', () => {
    const e = parseEntitiesFromContent('src/types.ts', 'export interface LoginResponse { token: string }')
    expect(e.some((x) => x.name === 'LoginResponse' && x.type === 'TYPE')).toBe(true)
  })
  it('extracts type aliases', () => {
    const e = parseEntitiesFromContent('src/types.ts', 'export type UserId = string')
    expect(e.some((x) => x.name === 'UserId' && x.type === 'TYPE')).toBe(true)
  })
  it('extracts classes', () => {
    const e = parseEntitiesFromContent('src/svc.ts', 'export class AuthService {}')
    expect(e.some((x) => x.name === 'AuthService' && x.type === 'MODEL')).toBe(true)
  })
  it('extracts Prisma models', () => {
    const e = parseEntitiesFromContent('schema.prisma', 'model User { id String @id }\nmodel Post { id String @id }')
    expect(e.some((x) => x.name === 'User' && x.type === 'MODEL')).toBe(true)
    expect(e.some((x) => x.name === 'Post' && x.type === 'MODEL')).toBe(true)
  })
  it('always includes FILE entity', () => {
    const e = parseEntitiesFromContent('src/empty.ts', '')
    expect(e.some((x) => x.type === 'FILE')).toBe(true)
  })
  it('extracts Fastify routes', () => {
    const e = parseEntitiesFromContent('src/routes.ts', "app.post('/api/login', async () => {})")
    expect(e.some((x) => x.type === 'API' && x.name.includes('/api/login'))).toBe(true)
  })
})

// ─── 5. ACTUAL SCOPE ANALYSIS ────────────────────────────────────────────────

describe('getActualScopeAnalysis', () => {
  beforeEach(() => {
    resetStore()
    vi.clearAllMocks()
    ;(prisma.task.findFirst as Mock).mockImplementation(() =>
      Promise.resolve(store.task[0] ?? null))
    ;(prisma.taskWorkIntent.findUnique as Mock).mockImplementation(() =>
      Promise.resolve(store.taskWorkIntent[0] ?? null))
    ;(prisma.taskActualChange.findMany as Mock).mockImplementation(() =>
      Promise.resolve(store.taskActualChange))
  })

  it('no deviation when declared == actual', async () => {
    store.task.push({ id: 't1', displayId: 'T-1', projectId: 'p1', status: 'IN_PROGRESS', title: 'T' })
    store.taskWorkIntent.push({ id: 'wi1', taskId: 't1', files: ['src/auth.ts'], apis: [], models: [], contracts: [] })
    store.taskActualChange.push({ id: 'ac1', taskId: 't1', filePath: 'src/auth.ts' })
    const r = await getActualScopeAnalysis('t1')
    expect(r.hasDeviation).toBe(false)
    expect(r.unexpectedFiles).toHaveLength(0)
  })

  it('detects extra undeclared files', async () => {
    store.task.push({ id: 't2', displayId: 'T-2', projectId: 'p1', status: 'IN_PROGRESS', title: 'T' })
    store.taskWorkIntent.push({ id: 'wi2', taskId: 't2', files: ['src/auth.ts'], apis: [], models: [], contracts: [] })
    store.taskActualChange.push(
      { id: 'ac2', taskId: 't2', filePath: 'src/auth.ts' },
      { id: 'ac3', taskId: 't2', filePath: 'src/user.ts' },
      { id: 'ac4', taskId: 't2', filePath: 'src/billing.ts' },
    )
    const r = await getActualScopeAnalysis('t2')
    expect(r.hasDeviation).toBe(true)
    expect(r.unexpectedFiles).toContain('src/user.ts')
    expect(r.unexpectedFiles).toContain('src/billing.ts')
  })

  it('detects missing declared files', async () => {
    store.task.push({ id: 't3', displayId: 'T-3', projectId: 'p1', status: 'IN_PROGRESS', title: 'T' })
    store.taskWorkIntent.push({ id: 'wi3', taskId: 't3', files: ['src/auth.ts', 'src/old.ts'], apis: [], models: [], contracts: [] })
    store.taskActualChange.push({ id: 'ac5', taskId: 't3', filePath: 'src/auth.ts' })
    const r = await getActualScopeAnalysis('t3')
    expect(r.hasDeviation).toBe(true)
    expect(r.missingDeclaredFiles).toContain('src/old.ts')
  })

  it('no deviation when no work intent', async () => {
    store.task.push({ id: 't4', displayId: 'T-4', projectId: 'p1', status: 'IN_PROGRESS', title: 'T' })
    store.taskActualChange.push({ id: 'ac6', taskId: 't4', filePath: 'src/new.ts' })
    const r = await getActualScopeAnalysis('t4')
    expect(r.hasDeviation).toBe(false)
  })

  it('deduplicates repeated push for same file', async () => {
    store.task.push({ id: 't5', displayId: 'T-5', projectId: 'p1', status: 'IN_PROGRESS', title: 'T' })
    store.taskWorkIntent.push({ id: 'wi5', taskId: 't5', files: ['src/auth.ts'], apis: [], models: [], contracts: [] })
    store.taskActualChange.push(
      { id: 'ac7', taskId: 't5', filePath: 'src/auth.ts' },
      { id: 'ac8', taskId: 't5', filePath: 'src/auth.ts' }, // duplicate
    )
    const r = await getActualScopeAnalysis('t5')
    expect(r.actualFiles).toHaveLength(1)
    expect(r.hasDeviation).toBe(false)
  })
})

// ─── 6. RISK ENGINE ───────────────────────────────────────────────────────────

describe('getProjectRisks', () => {
  beforeEach(() => {
    resetStore()
    vi.clearAllMocks()
    ;(prisma.coordinationRisk.findMany as Mock).mockImplementation(({ where }: { where?: Record<string, unknown> } = {}) => {
      const rows = store.coordinationRisk
      if (!where) return Promise.resolve(rows)
      return Promise.resolve(rows.filter((r) => !where['status'] || r['status'] === where['status']))
    })
  })

  it('returns open risks', async () => {
    store.coordinationRisk.push({ id: 'r1', projectId: 'p1', type: 'FILE_OVERLAP', severity: 'MEDIUM', confidence: 'HIGH', status: 'OPEN', sourceTask: null, affectedTask: null, sourceEntity: null })
    const risks = await getProjectRisks('p1', 'OPEN')
    expect(risks.length).toBeGreaterThanOrEqual(1)
    expect(risks[0]?.['type']).toBe('FILE_OVERLAP')
  })
})

describe('acknowledgeRisk', () => {
  beforeEach(() => {
    resetStore()
    vi.clearAllMocks()
    ;(prisma.coordinationRisk.findUnique as Mock).mockImplementation(({ where }: { where: Record<string, unknown> }) =>
      Promise.resolve(store.coordinationRisk.find((r) => r['id'] === where['id']) ?? null))
    ;(prisma.coordinationRisk.update as Mock).mockImplementation(({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const idx = store.coordinationRisk.findIndex((r) => r['id'] === where['id'])
      const updated = { ...store.coordinationRisk[idx], ...data }
      store.coordinationRisk[idx] = updated
      return Promise.resolve(updated)
    })
  })

  it('marks risk as ACKNOWLEDGED', async () => {
    store.coordinationRisk.push({ id: 'r-ack', projectId: 'p1', type: 'CONTRACT_CHANGE', severity: 'HIGH', confidence: 'HIGH', status: 'OPEN', resolvedAt: null })
    const updated = await acknowledgeRisk('r-ack', 'ACKNOWLEDGED')
    expect(updated['status']).toBe('ACKNOWLEDGED')
  })

  it('throws 404 for unknown risk', async () => {
    await expect(acknowledgeRisk('no-such', 'ACKNOWLEDGED')).rejects.toThrow('Risk not found')
  })

  it('suppresses duplicate risks (only one in store)', async () => {
    store.coordinationRisk.push({ id: 'r-dup', projectId: 'p1', type: 'SCOPE_EXPANSION', severity: 'HIGH', confidence: 'HIGH', status: 'OPEN', sourceTask: null, affectedTask: null, sourceEntity: null })
    const risks = await getProjectRisks('p1', 'OPEN')
    expect(risks.filter((r) => r['type'] === 'SCOPE_EXPANSION')).toHaveLength(1)
  })
})

// ─── 7. CONTEXT UPDATES ───────────────────────────────────────────────────────

describe('getContextUpdates', () => {
  beforeEach(() => {
    resetStore()
    vi.clearAllMocks()
    ;(prisma.task.findFirst as Mock).mockImplementation(() =>
      Promise.resolve(store.task[0] ?? null))
    ;(prisma.contextUpdate.findMany as Mock).mockImplementation(({ where }: { where?: Record<string, unknown> } = {}) => {
      if (!where) return Promise.resolve(store.contextUpdate)
      return Promise.resolve(store.contextUpdate.filter((u) =>
        (!where['affectedTaskId'] || u['affectedTaskId'] === where['affectedTaskId']),
      ))
    })
  })

  it('returns updates for affected task', async () => {
    store.task.push({ id: 'task-cu', displayId: 'T-CU', projectId: 'p1', status: 'IN_PROGRESS', title: 'T' })
    store.contextUpdate.push({ id: 'cu1', affectedTaskId: 'task-cu', type: 'CONTRACT_CHANGE', status: 'UNREAD', title: 'T', message: 'M', sourceTask: null, entity: null, createdAt: new Date() })
    const updates = await getContextUpdates('task-cu')
    expect(updates.length).toBeGreaterThanOrEqual(1)
    expect(updates[0]?.['type']).toBe('CONTRACT_CHANGE')
  })

  it('does not return updates for unrelated tasks', async () => {
    store.task.push({ id: 'task-unrelated', displayId: 'T-X', projectId: 'p1', status: 'IN_PROGRESS', title: 'T' })
    store.contextUpdate.push({ id: 'cu2', affectedTaskId: 'task-OTHER', type: 'CONTRACT_CHANGE', status: 'UNREAD', title: 'T', message: 'M', sourceTask: null, entity: null })
    const updates = await getContextUpdates('task-unrelated')
    expect(updates).toHaveLength(0)
  })
})

describe('acknowledgeContextUpdate', () => {
  beforeEach(() => {
    resetStore()
    vi.clearAllMocks()
    ;(prisma.contextUpdate.findUnique as Mock).mockImplementation(({ where }: { where: Record<string, unknown> }) =>
      Promise.resolve(store.contextUpdate.find((u) => u['id'] === where['id']) ?? null))
    ;(prisma.contextUpdate.update as Mock).mockImplementation(({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const idx = store.contextUpdate.findIndex((u) => u['id'] === where['id'])
      const updated = { ...store.contextUpdate[idx], ...data }
      store.contextUpdate[idx] = updated
      return Promise.resolve(updated)
    })
  })

  it('marks update as ACKNOWLEDGED', async () => {
    store.contextUpdate.push({ id: 'cu-ack', projectId: 'p1', sourceTaskId: 'ta', affectedTaskId: 'tb', type: 'CONTRACT_CHANGE', title: 'T', message: 'M', status: 'UNREAD', acknowledgedAt: null })
    const updated = await acknowledgeContextUpdate('cu-ack', 'ACKNOWLEDGED')
    expect(updated['status']).toBe('ACKNOWLEDGED')
    expect(updated['acknowledgedAt']).not.toBeNull()
  })

  it('throws 404 for unknown update', async () => {
    await expect(acknowledgeContextUpdate('no-such', 'ACKNOWLEDGED')).rejects.toThrow('Context update not found')
  })
})

// ─── 8. BRANCH DIVERGENCE ────────────────────────────────────────────────────

describe('checkBranchDivergence', () => {
  beforeEach(() => {
    resetStore()
    vi.clearAllMocks()
    ;(prisma.task.findFirst as Mock).mockImplementation(() =>
      Promise.resolve(store.task[0] ?? null))
    ;(prisma.taskGitLink.findFirst as Mock).mockImplementation(() =>
      Promise.resolve(store.taskGitLink[0] ?? null))
    ;(prisma.taskGitLink.update as Mock).mockResolvedValue({})
    ;(prisma.taskActualChange.findMany as Mock).mockResolvedValue([])
    ;(prisma.taskFileReservation.findMany as Mock).mockResolvedValue([])
    ;(prisma.coordinationRisk.findFirst as Mock).mockResolvedValue(null)
    ;(prisma.coordinationRisk.create as Mock).mockResolvedValue({ id: makeId() })
    ;(prisma.taskActivity.create as Mock).mockResolvedValue({ id: makeId() })
  })

  it('returns isDiverged=false when behindCount is 0 and no repo', async () => {
    store.task.push({ id: 'bd1', displayId: 'T-BD1', projectId: 'p1', status: 'IN_PROGRESS', title: 'T' })
    store.taskGitLink.push({ id: 'l1', taskId: 'bd1', repositoryId: null, branchName: 'feat', baseBranch: 'main', latestCommitSha: 'abc', aheadCount: 2, behindCount: 0, mergeStatus: 'NOT_STARTED', divergenceCheckedAt: null, updatedAt: new Date(), repository: null })
    const status = await checkBranchDivergence('bd1')
    expect(status.isDiverged).toBe(false)
  })

  it('returns stored behindCount when no live repo connection', async () => {
    store.task.push({ id: 'bd2', displayId: 'T-BD2', projectId: 'p1', status: 'IN_PROGRESS', title: 'T' })
    store.taskGitLink.push({ id: 'l2', taskId: 'bd2', repositoryId: null, branchName: 'feat', baseBranch: 'main', latestCommitSha: 'abc', aheadCount: 3, behindCount: 8, mergeStatus: 'NOT_STARTED', divergenceCheckedAt: new Date(), updatedAt: new Date(), repository: null })
    const status = await checkBranchDivergence('bd2')
    expect(status.behindCount).toBe(8)
  })

  it('returns null branchName when no git link', async () => {
    store.task.push({ id: 'bd3', displayId: 'T-BD3', projectId: 'p1', status: 'IN_PROGRESS', title: 'T' })
    const status = await checkBranchDivergence('bd3')
    expect(status.branchName).toBeNull()
    expect(status.isDiverged).toBe(false)
  })
})

// ─── 9. IMPACT ANALYSIS ──────────────────────────────────────────────────────

describe('getImpactAnalysis', () => {
  beforeEach(() => {
    resetStore()
    vi.clearAllMocks()
    ;(prisma.codeEntity.findUnique as Mock).mockImplementation(({ where }: { where: Record<string, unknown> }) =>
      Promise.resolve(store.codeEntity.find((e) => e['id'] === where['id']) ?? null))
    ;(prisma.codeRelationship.findMany as Mock).mockImplementation(() =>
      Promise.resolve(store.codeRelationship))
    ;(prisma.task.findMany as Mock).mockResolvedValue([])
  })

  it('throws 404 for unknown entity', async () => {
    await expect(getImpactAnalysis('no-such')).rejects.toThrow('Entity not found')
  })

  it('returns empty consumers for entity with no relationships', async () => {
    store.codeEntity.push({ id: 'ent1', projectId: 'p1', type: 'TYPE', name: 'IsolatedType', filePath: 'src/i.ts' })
    const analysis = await getImpactAnalysis('ent1')
    expect(analysis.changedEntity['name']).toBe('IsolatedType')
    expect(analysis.directConsumers).toHaveLength(0)
    expect(analysis.totalAffectedTasks).toBe(0)
  })

  it('identifies direct consumers', async () => {
    store.codeEntity.push(
      { id: 'ent2', projectId: 'p2', type: 'TYPE', name: 'LoginResponse', filePath: 'src/login.ts' },
      { id: 'ent3', projectId: 'p2', type: 'FILE', name: 'src/form.tsx', filePath: 'src/form.tsx' },
    )
    store.codeRelationship.push({
      id: 'rel1', projectId: 'p2', sourceEntityId: 'ent3', targetEntityId: 'ent2',
      relationship: 'CONSUMES', confidence: 'HIGH', source: 'DETERMINISTIC',
      sourceEntity: store.codeEntity[1],
    })
    const analysis = await getImpactAnalysis('ent2')
    expect(analysis.directConsumers).toHaveLength(1)
  })
})

// ─── 10. SECURITY ────────────────────────────────────────────────────────────

describe('security', () => {
  it('rejects signature that does not match secret', () => {
    const p = Buffer.from('{"test":true}')
    const wrongSig = `sha256=${createHmac('sha256', 'wrong-secret').update(p).digest('hex')}`
    expect(verifyGitHubSignature(p, wrongSig, 'correct-secret')).toBe(false)
  })

  it('blocks cross-project risk acknowledgement', async () => {
    resetStore()
    vi.clearAllMocks()
    store.coordinationRisk.push({ id: 'r-cross', projectId: 'proj-A', type: 'FILE_OVERLAP', severity: 'MEDIUM', confidence: 'HIGH', status: 'OPEN' })
    ;(prisma.coordinationRisk.findUnique as Mock).mockImplementation(({ where }: { where: Record<string, unknown> }) =>
      Promise.resolve(store.coordinationRisk.find((r) => r['id'] === where['id']) ?? null))
    await expect(acknowledgeRisk('r-cross', 'ACKNOWLEDGED', 'proj-B')).rejects.toThrow('Access denied')
  })

  it('blocks cross-project context update acknowledgement', async () => {
    resetStore()
    vi.clearAllMocks()
    store.contextUpdate.push({ id: 'cu-cross', projectId: 'proj-A', sourceTaskId: 'ta', affectedTaskId: 'tb', type: 'CONTRACT_CHANGE', title: 'T', message: 'M', status: 'UNREAD', acknowledgedAt: null })
    ;(prisma.contextUpdate.findUnique as Mock).mockImplementation(({ where }: { where: Record<string, unknown> }) =>
      Promise.resolve(store.contextUpdate.find((u) => u['id'] === where['id']) ?? null))
    await expect(acknowledgeContextUpdate('cu-cross', 'ACKNOWLEDGED', 'proj-B')).rejects.toThrow('Access denied')
  })
})
