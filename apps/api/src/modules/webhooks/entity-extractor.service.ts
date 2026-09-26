/**
 * Entity Extractor Service — Phase 4
 *
 * Deterministic code entity extraction from file content.
 * Supported formats (Phase 4 v1):
 *   - TypeScript: exported interfaces, types, classes, functions
 *   - Prisma: model definitions
 *   - OpenAPI-style route comments / decorators
 *
 * AI is NOT used here. All extraction is pattern-based.
 */
import { prisma } from '@arxion/database'
import type { ActualChangeInput } from './actual-changes.service.js'

// ─── Deterministic parsers ────────────────────────────────────────────────────

interface ExtractedEntity {
  type: 'TYPE' | 'MODEL' | 'API' | 'FILE'
  name: string
  filePath: string
  symbolName?: string
}

/**
 * Extract TypeScript exported interfaces and type aliases from source content.
 */
function extractTypeScriptEntities(filePath: string, content: string): ExtractedEntity[] {
  const entities: ExtractedEntity[] = []

  // Match: export interface Foo / export type Foo / export class Foo / export function foo
  const INTERFACE_RE = /export\s+(?:default\s+)?interface\s+(\w+)/g
  const TYPE_RE = /export\s+(?:type\s+)(\w+)\s*[=<{]/g
  const CLASS_RE = /export\s+(?:default\s+)?(?:abstract\s+)?class\s+(\w+)/g
  const FUNC_RE = /export\s+(?:async\s+)?function\s+(\w+)/g

  for (const match of content.matchAll(INTERFACE_RE)) {
    entities.push({ type: 'TYPE', name: match[1]!, filePath, symbolName: match[1] })
  }
  for (const match of content.matchAll(TYPE_RE)) {
    entities.push({ type: 'TYPE', name: match[1]!, filePath, symbolName: match[1] })
  }
  for (const match of content.matchAll(CLASS_RE)) {
    entities.push({ type: 'MODEL', name: match[1]!, filePath, symbolName: match[1] })
  }
  for (const match of content.matchAll(FUNC_RE)) {
    entities.push({ type: 'MODEL', name: match[1]!, filePath, symbolName: match[1] })
  }

  // Route patterns: @Get('/path'), @Post, router.get, app.post, fastify.get
  const ROUTE_RE = /(?:@(?:Get|Post|Put|Patch|Delete|Head)\s*\(\s*['"`]([^'"`]+)['"`]\s*\)|(?:router|app|fastify)\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`])/gi
  for (const match of content.matchAll(ROUTE_RE)) {
    const method = match[2] ?? (match[0].match(/@(\w+)/)?.[1] ?? 'GET')
    const path = match[1] ?? match[3] ?? ''
    if (path) {
      const apiName = `${method.toUpperCase()} ${path}`
      entities.push({ type: 'API', name: apiName, filePath, symbolName: apiName })
    }
  }

  return entities
}

/**
 * Extract Prisma model names from a schema file.
 */
function extractPrismaEntities(filePath: string, content: string): ExtractedEntity[] {
  const entities: ExtractedEntity[] = []
  const MODEL_RE = /^model\s+(\w+)\s*\{/gm
  const ENUM_RE = /^enum\s+(\w+)\s*\{/gm

  for (const match of content.matchAll(MODEL_RE)) {
    entities.push({ type: 'MODEL', name: match[1]!, filePath, symbolName: match[1] })
  }
  for (const match of content.matchAll(ENUM_RE)) {
    entities.push({ type: 'TYPE', name: match[1]!, filePath, symbolName: match[1] })
  }

  return entities
}

/**
 * Extract entities from a file based on its extension/path.
 */
function extractFromContent(filePath: string, content: string): ExtractedEntity[] {
  const lower = filePath.toLowerCase()

  // Always record the file-level entity
  const entities: ExtractedEntity[] = [{ type: 'FILE', name: filePath, filePath }]

  if (lower.endsWith('.ts') || lower.endsWith('.tsx')) {
    entities.push(...extractTypeScriptEntities(filePath, content))
  } else if (lower.endsWith('.prisma')) {
    entities.push(...extractPrismaEntities(filePath, content))
  }

  return entities
}

// ─── Database operations ──────────────────────────────────────────────────────

/**
 * Upsert extracted entities into the database.
 * We cannot read actual file content from inside the API (no git clone),
 * so we record file-level entities deterministically, and rely on
 * content provided through the webhook payload metadata.
 */
export async function extractEntitiesFromFiles(opts: {
  projectId: string
  taskId: string
  repositoryId: string
  files: ActualChangeInput[]
}): Promise<void> {
  const { projectId, taskId, repositoryId, files } = opts

  for (const file of files) {
    if (file.changeType === 'DELETED') {
      // Don't index deleted files — mark existing as stale by preserving them
      continue
    }

    // For Phase 4 v1: record file-level entities from path analysis
    // Content-based extraction requires file content to be passed via metadata
    const content = (file as ActualChangeInput & { content?: string }).content ?? ''
    const entities = extractFromContent(file.filePath, content)

    for (const entity of entities) {
      // Upsert by unique constraint: projectId + filePath + name + type
      const stored = await prisma.codeEntity.upsert({
        where: {
          projectId_filePath_name_type: {
            projectId,
            filePath: entity.filePath,
            name: entity.name,
            type: entity.type,
          },
        },
        create: {
          projectId,
          type: entity.type,
          name: entity.name,
          filePath: entity.filePath,
          symbolName: entity.symbolName ?? null,
        },
        update: {
          symbolName: entity.symbolName ?? null,
          repositoryId,
        },
      })
      if (prisma.taskCodeEntity) {
        await prisma.taskCodeEntity.upsert({
          where: { taskId_entityId: { taskId, entityId: stored.id } },
          create: { projectId, taskId, entityId: stored.id },
          update: { lastSeenAt: new Date() },
        })
      }
    }

    if (content) await persistImportRelationships(projectId, file.filePath, content)
  }
}

async function persistImportRelationships(projectId: string, filePath: string, content: string): Promise<void> {
  const source = await prisma.codeEntity.findFirst({ where: { projectId, filePath, type: 'FILE' } })
  if (!source) return
  const names = new Set<string>()
  for (const match of content.matchAll(/import\s+(?:type\s+)?\{([^}]+)\}\s+from/g)) {
    for (const part of match[1]!.split(',')) names.add(part.trim().split(/\s+as\s+/)[0]!)
  }
  if (names.size === 0) return
  const targets = await prisma.codeEntity.findMany({ where: { projectId, name: { in: [...names] } } })
  for (const target of targets) {
    if (target.id === source.id) continue
    await prisma.codeRelationship.upsert({
      where: { sourceEntityId_targetEntityId_relationship: { sourceEntityId: source.id, targetEntityId: target.id, relationship: 'IMPORTS' } },
      create: { projectId, sourceEntityId: source.id, targetEntityId: target.id, relationship: 'IMPORTS', confidence: 'HIGH', source: 'DETERMINISTIC' },
      update: { confidence: 'HIGH' },
    })
  }
}

/**
 * Extract entities from file content directly (for testing / manual indexing).
 */
export function parseEntitiesFromContent(
  filePath: string,
  content: string,
): ExtractedEntity[] {
  return extractFromContent(filePath, content)
}
