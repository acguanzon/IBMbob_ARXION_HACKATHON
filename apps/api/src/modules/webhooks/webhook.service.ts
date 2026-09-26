/**
 * Webhook Service — Phase 4
 *
 * Handles incoming GitHub webhook events:
 * - Signature verification
 * - Deduplication via ExternalEvent
 * - Dispatches to appropriate analysis pipeline
 */
import { createHash, createHmac, timingSafeEqual } from 'crypto'
import { prisma } from '@arxion/database'
import { emitEvent } from '../../lib/realtime.js'
import { processActualChanges } from './actual-changes.service.js'
import { createGitHubProvider } from '../../lib/git-provider.js'

// ─── Signature Verification ───────────────────────────────────────────────────

/**
 * Verify a GitHub webhook HMAC-SHA256 signature.
 * Returns true if valid, false if invalid.
 */
export function verifyGitHubSignature(
  payload: Buffer,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!signature) return false
  const expected = `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}

/**
 * Compute a SHA-256 hash of a payload for deduplication.
 */
function hashPayload(payload: Buffer): string {
  return createHash('sha256').update(payload).digest('hex')
}

// ─── Event Processing ─────────────────────────────────────────────────────────

interface GitHubPushPayload {
  ref: string
  after: string
  before: string
  repository: { id: number; full_name: string }
  commits: Array<{
    id: string
    added: string[]
    removed: string[]
    modified: string[]
  }>
  head_commit: { id: string } | null
}

/**
 * Process a single GitHub webhook delivery.
 * Idempotent — duplicate deliveries are ignored.
 */
export async function processGitHubWebhook(options: {
  repositoryId: string
  deliveryId: string
  eventType: string
  signature: string | undefined
  rawPayload: Buffer
}): Promise<{ status: 'PROCESSED' | 'IGNORED' | 'FAILED'; message: string }> {
  const { repositoryId, deliveryId, eventType, signature, rawPayload } = options

  // 1. Load the repository and verify secret
  const repo = await prisma.projectRepository.findUnique({ where: { id: repositoryId } })
  if (!repo) {
    return { status: 'FAILED', message: 'Repository not found.' }
  }

  // 2. Verify signature if a secret is configured
  if (repo.webhookSecret) {
    if (!verifyGitHubSignature(rawPayload, signature, repo.webhookSecret)) {
      return { status: 'FAILED', message: 'Invalid webhook signature.' }
    }
  }

  // 3. Deduplicate — check if we've already seen this delivery
  const payloadHash = hashPayload(rawPayload)
  const existingEvent = await prisma.externalEvent.findUnique({
    where: { provider_externalEventId: { provider: 'GITHUB', externalEventId: deliveryId } },
  })
  if (existingEvent) {
    return { status: 'IGNORED', message: `Duplicate delivery ${deliveryId}.` }
  }

  // 4. Record the event as RECEIVED
  const externalEvent = await prisma.externalEvent.create({
    data: {
      provider: 'GITHUB',
      externalEventId: deliveryId,
      eventType,
      repositoryId,
      payloadHash,
      status: 'RECEIVED',
    },
  })

  // 5. Only process supported events
  const SUPPORTED = new Set(['push', 'pull_request', 'create'])
  if (!SUPPORTED.has(eventType)) {
    await prisma.externalEvent.update({
      where: { id: externalEvent.id },
      data: { status: 'IGNORED', processedAt: new Date() },
    })
    return { status: 'IGNORED', message: `Event type "${eventType}" is not processed.` }
  }

  try {
    // 6. Dispatch
    const payload = JSON.parse(rawPayload.toString('utf8')) as unknown

    if (eventType === 'push') {
      await handlePushEvent(repo.projectId, repositoryId, payload as GitHubPushPayload, repo.owner, repo.repository)
    }

    // 7. Mark as PROCESSED
    await prisma.externalEvent.update({
      where: { id: externalEvent.id },
      data: { status: 'PROCESSED', processedAt: new Date() },
    })

    return { status: 'PROCESSED', message: `Event ${deliveryId} processed.` }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await prisma.externalEvent.update({
      where: { id: externalEvent.id },
      data: { status: 'FAILED', errorMessage: message, processedAt: new Date() },
    })
    return { status: 'FAILED', message }
  }
}

// ─── Push Event Handler ───────────────────────────────────────────────────────

async function handlePushEvent(
  projectId: string,
  repositoryId: string,
  payload: GitHubPushPayload,
  owner: string,
  repositoryName: string,
): Promise<void> {
  const branchRef = payload.ref // refs/heads/<branch>
  const branchName = branchRef.startsWith('refs/heads/')
    ? branchRef.slice('refs/heads/'.length)
    : branchRef

  const commitSha = payload.after

  emitEvent('git.push_received', projectId, {
    repositoryId,
    branch: branchName,
    commitSha,
  })

  // Find the task whose branch matches
  const gitLink = await prisma.taskGitLink.findFirst({
    where: { repositoryId, branchName },
    include: { task: true },
  })

  if (!gitLink) {
    // No task mapped to this branch — still record the push but no analysis
    return
  }

  // Update the task git link with the latest SHA
  await prisma.taskGitLink.update({
    where: { id: gitLink.id },
    data: { latestCommitSha: commitSha },
  })

  // Collect changed files from push commits
  const changedFiles: Array<{ path: string; type: 'ADDED' | 'MODIFIED' | 'DELETED' }> = []
  for (const commit of payload.commits) {
    for (const f of commit.added) changedFiles.push({ path: f, type: 'ADDED' })
    for (const f of commit.modified) changedFiles.push({ path: f, type: 'MODIFIED' })
    for (const f of commit.removed) changedFiles.push({ path: f, type: 'DELETED' })
  }

  // Deduplicate by path (last write wins)
  const fileMap = new Map<string, 'ADDED' | 'MODIFIED' | 'DELETED'>()
  for (const { path, type } of changedFiles) {
    fileMap.set(path, type)
  }

  emitEvent('git.change_detected', projectId, {
    taskId: gitLink.task.id,
    repositoryId,
    commitSha,
    files: Array.from(fileMap.entries()).map(([path, type]) => ({ path, type })),
  })

  // Run the actual change analysis pipeline
  const provider = createGitHubProvider()
  const filesWithContent = await Promise.all(Array.from(fileMap.entries()).map(async ([path, changeType]) => {
    let content: string | undefined
    if (changeType !== 'DELETED' && /\.(?:ts|tsx|prisma)$/.test(path)) {
      try { content = await provider.getFileContent(owner, repositoryName, path, commitSha) } catch { content = undefined }
    }
    return { filePath: path, changeType, additions: 0, deletions: 0, content }
  }))

  await processActualChanges({
    projectId,
    taskId: gitLink.task.id,
    repositoryId,
    commitSha,
    files: filesWithContent,
  })
}
