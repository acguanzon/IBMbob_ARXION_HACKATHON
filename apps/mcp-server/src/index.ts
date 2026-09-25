#!/usr/bin/env node
/**
 * Arxion MCP Server
 *
 * This server is an ADAPTER only.
 * It exposes Arxion collaboration tools to AI coding agents (IBM Bob, etc.).
 * It MUST NOT access PostgreSQL or Prisma directly — all calls go through the backend REST API.
 *
 * Transport: stdio (spawned by the coding agent's MCP host)
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getEnv } from '@arxion/config';

// ── Configuration ─────────────────────────────────────────────────────────────

const API_BASE_URL = getEnv('MCP_API_BASE_URL', 'http://localhost:3001');
const API_KEY = process.env['MCP_API_KEY'] ?? '';

// ── API Client ────────────────────────────────────────────────────────────────

async function apiGet<T>(path: string): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(API_KEY ? { 'x-internal-api-key': API_KEY } : {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API request failed: ${response.status} ${response.statusText} — ${body}`);
  }

  return response.json() as Promise<T>;
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(API_KEY ? { 'x-internal-api-key': API_KEY } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API request failed: ${response.status} ${response.statusText} — ${text}`);
  }

  return response.json() as Promise<T>;
}

async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(API_KEY ? { 'x-internal-api-key': API_KEY } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API request failed: ${response.status} ${response.statusText} — ${text}`);
  }

  return response.json() as Promise<T>;
}

// ── MCP Server ────────────────────────────────────────────────────────────────

const server = new McpServer({
  name: 'arxion-mcp-server',
  version: '0.2.0',
});

// ── Tool: get_task ────────────────────────────────────────────────────────────

server.registerTool(
  'get_task',
  {
    description: `Retrieve a task and its full context from the Arxion collaboration platform.
Returns: task title, description, status, priority, assignee, dependencies, and project context.
Use this before starting work on any task.`,
    inputSchema: z.object({
      task_id: z
        .string()
        .describe('The task ID to retrieve. Can be the display ID (e.g. "T-102") or the internal cuid.'),
    }),
  },
  async ({ task_id }) => {
    try {
      const response = await apiGet<{
        success: boolean;
        data: {
          id: string;
          displayId: string;
          title: string;
          description: string | null;
          status: string;
          priority: string;
          projectId: string;
          assigneeId: string | null;
          createdAt: string;
          updatedAt: string;
          startedAt: string | null;
          completedAt: string | null;
          assignee: { id: string; name: string; email: string } | null;
          createdBy: { id: string; name: string; email: string };
          dependencies: Array<{
            id: string;
            dependsOnTaskId: string;
            dependsOn: { displayId: string; title: string; status: string };
          }>;
        };
      }>(`/tasks/${encodeURIComponent(task_id)}`);

      if (!response.success) {
        return { content: [{ type: 'text', text: `Task not found: ${task_id}` }], isError: true };
      }

      const task = response.data;
      const dependencyLines =
        task.dependencies.length > 0
          ? task.dependencies
              .map((d) => `  - ${d.dependsOn.displayId}: ${d.dependsOn.title} [${d.dependsOn.status}]`)
              .join('\n')
          : '  (none)';

      const summary = `
TASK: ${task.displayId} — ${task.title}
════════════════════════════════════════════════
Status:      ${task.status}
Priority:    ${task.priority}
Assignee:    ${task.assignee ? `${task.assignee.name} <${task.assignee.email}>` : 'Unassigned'}
Project:     ${task.projectId}
Created by:  ${task.createdBy.name}
Created at:  ${task.createdAt}

Description:
${task.description ?? '(no description)'}

Dependencies:
${dependencyLines}
════════════════════════════════════════════════
Task ID (internal): ${task.id}
`.trim();

      return { content: [{ type: 'text', text: summary }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Failed to retrieve task ${task_id}: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

// ── Tool: get_project_context ─────────────────────────────────────────────────

server.registerTool(
  'get_project_context',
  {
    description: `Retrieve the full context of a project: name, description, members, and task summary.
Use this to understand the project before starting work.`,
    inputSchema: z.object({
      project_id: z.string().describe('The project ID'),
    }),
  },
  async ({ project_id }) => {
    try {
      const response = await apiGet<{
        success: boolean;
        data: {
          id: string;
          name: string;
          description: string | null;
          repositoryUrl: string | null;
          members: Array<{ user: { name: string; email: string }; role: string }>;
          _count: { tasks: number };
        };
      }>(`/projects/${encodeURIComponent(project_id)}`);

      if (!response.success) {
        return { content: [{ type: 'text', text: `Project not found: ${project_id}` }], isError: true };
      }

      const project = response.data;
      const memberLines = project.members
        .map((m) => `  - ${m.user.name} <${m.user.email}> [${m.role}]`)
        .join('\n');

      const summary = `
PROJECT: ${project.name}
════════════════════════════════════════════════
ID:          ${project.id}
Description: ${project.description ?? '(none)'}
Repository:  ${project.repositoryUrl ?? '(none)'}
Task count:  ${project._count.tasks}

Members:
${memberLines}
════════════════════════════════════════════════
`.trim();

      return { content: [{ type: 'text', text: summary }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Failed to retrieve project ${project_id}: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

// ── Tool: get_task_dependencies ───────────────────────────────────────────────

server.registerTool(
  'get_task_dependencies',
  {
    description: `Retrieve the dependencies of a task — what tasks must be completed before this one.
Use this to understand blockers before starting work.`,
    inputSchema: z.object({
      task_id: z.string().describe('The task ID (display ID like T-102 or internal cuid)'),
    }),
  },
  async ({ task_id }) => {
    try {
      const response = await apiGet<{
        success: boolean;
        data: Array<{
          id: string;
          dependsOnTaskId: string;
          dependsOn: { displayId: string; title: string; status: string };
        }>;
      }>(`/tasks/${encodeURIComponent(task_id)}/dependencies`);

      if (!response.data || response.data.length === 0) {
        return { content: [{ type: 'text', text: `Task ${task_id} has no dependencies.` }] };
      }

      const lines = response.data
        .map((d) => `  - ${d.dependsOn.displayId}: ${d.dependsOn.title} [${d.dependsOn.status}]`)
        .join('\n');

      return { content: [{ type: 'text', text: `Dependencies for ${task_id}:\n${lines}` }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Failed to retrieve dependencies for ${task_id}: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

// ── Tool: get_task_blockers ───────────────────────────────────────────────────

server.registerTool(
  'get_task_blockers',
  {
    description: `Return only the unfinished (blocking) dependencies for a task.
Use this to know whether a task is actively blocked before starting.`,
    inputSchema: z.object({
      task_id: z.string().describe('The task ID (display ID like T-102 or internal cuid)'),
    }),
  },
  async ({ task_id }) => {
    try {
      const response = await apiGet<{
        success: boolean;
        data: Array<{ blockingTask: { displayId: string; title: string; status: string }; reason: string }>;
      }>(`/tasks/${encodeURIComponent(task_id)}/blockers`);

      if (!response.data || response.data.length === 0) {
        return { content: [{ type: 'text', text: `No active blockers for task ${task_id}. All dependencies are complete.` }] };
      }

      const lines = response.data
        .map((b) => `  ⚠ ${b.blockingTask.displayId} [${b.blockingTask.status}]: ${b.reason}`)
        .join('\n');

      return { content: [{ type: 'text', text: `BLOCKERS for ${task_id}:\n${lines}` }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Failed to retrieve blockers for ${task_id}: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

// ── Tool: claim_task ──────────────────────────────────────────────────────────

server.registerTool(
  'claim_task',
  {
    description: `Claim a task and assign it to a developer. Uses an atomic transaction — only one person can claim.
Returns the task or a conflict message if already claimed.`,
    inputSchema: z.object({
      task_id: z.string().describe('The task ID (e.g. T-102)'),
      user_id: z.string().describe('The user ID of the developer claiming the task'),
    }),
  },
  async ({ task_id, user_id }) => {
    try {
      const response = await apiPost<{ success: boolean; data?: { displayId: string; title: string; status: string; assignee?: { name: string } | null }; error?: { message: string } }>(
        `/tasks/${encodeURIComponent(task_id)}/claim`,
        { userId: user_id },
      );

      if (!response.success) {
        return { content: [{ type: 'text', text: `TASK_ALREADY_CLAIMED: ${response.error?.message ?? 'This task is already claimed.'}` }], isError: true };
      }

      const task = response.data!;
      return {
        content: [{ type: 'text', text: `✅ Task ${task.displayId} claimed successfully.\nStatus: ${task.status}\nAssigned to: ${task.assignee?.name ?? user_id}` }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Failed to claim task ${task_id}: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

// ── Tool: begin_task ──────────────────────────────────────────────────────────

server.registerTool(
  'begin_task',
  {
    description: `Begin working on a task — runs the full coordination preflight.
Returns:
- task details and assignee
- dependency status (DONE / blocked)
- active teammates and their tasks
- file conflicts (files already reserved by another task)
- contract risks (your task consumes something another task is modifying)
- coordination status: READY | READY_WITH_WARNINGS | BLOCKED
- your new agent session ID (use for heartbeat)

Always call this before starting work on a task.`,
    inputSchema: z.object({
      task_id: z.string().describe('The task ID (e.g. T-102)'),
      user_id: z.string().describe('Your user ID'),
      agent_type: z.enum(['IBM_BOB', 'CURSOR', 'CLAUDE_CODE', 'OTHER']).optional().default('IBM_BOB').describe('Your agent type'),
    }),
  },
  async ({ task_id, user_id, agent_type }) => {
    try {
      const response = await apiPost<{
        success: boolean;
        data: {
          task: { displayId: string; title: string; status: string; assignee?: { name: string } | null };
          sessionId: string;
          dependencies: Array<{ task: { displayId: string; title: string; status: string }; isBlocked: boolean }>;
          activeTeammates: Array<{ userName: string; taskDisplayId: string; agentType: string; status: string }>;
          fileConflicts: Array<{ filePath: string; existingReservation: { userName: string; taskDisplayId: string } }>;
          contractRisks: Array<{ contractName: string; contractType: string; sourceTaskDisplayId: string; sourceRelationship: string; affectedTaskDisplayId: string }>;
          coordinationStatus: 'READY' | 'READY_WITH_WARNINGS' | 'BLOCKED';
        };
        error?: { message: string };
      }>(
        '/coordination/begin',
        { taskId: task_id, userId: user_id, agentType: agent_type },
      );

      if (!response.success) {
        return { content: [{ type: 'text', text: `Failed to begin task: ${response.error?.message ?? 'Unknown error'}` }], isError: true };
      }

      const p = response.data;
      const statusIcon = { READY: '✅', READY_WITH_WARNINGS: '⚠️', BLOCKED: '🚫' }[p.coordinationStatus] ?? '?';

      const depLines = p.dependencies.length > 0
        ? p.dependencies.map((d) => `  ${d.isBlocked ? '⚠ BLOCKING' : '✓'} ${d.task.displayId} [${d.task.status}] ${d.task.title}`).join('\n')
        : '  No dependencies';

      const teammateLines = p.activeTeammates.length > 0
        ? p.activeTeammates.map((t) => `  - ${t.userName} → ${t.taskDisplayId} [${t.status}] (${t.agentType})`).join('\n')
        : '  No active teammates';

      const conflictLines = p.fileConflicts.length > 0
        ? p.fileConflicts.map((c) => `  ⚠ ${c.filePath}\n    Reserved by: ${c.existingReservation.userName} / ${c.existingReservation.taskDisplayId}`).join('\n')
        : '  No file conflicts';

      const riskLines = p.contractRisks.length > 0
        ? p.contractRisks.map((r) => `  ⚠ CONTRACT RISK: ${r.contractType} "${r.contractName}"\n    ${r.sourceTaskDisplayId} ${r.sourceRelationship}s it; this task is affected.`).join('\n')
        : '  No contract risks';

      const report = `
COORDINATION PREFLIGHT — ${p.task.displayId}: ${p.task.title}
════════════════════════════════════════════════
Status:   ${statusIcon} ${p.coordinationStatus}
Assignee: ${p.task.assignee?.name ?? user_id}
Session:  ${p.sessionId}

DEPENDENCIES:
${depLines}

ACTIVE TEAMMATES:
${teammateLines}

FILE CONFLICTS:
${conflictLines}

CONTRACT RISKS:
${riskLines}
════════════════════════════════════════════════
${p.coordinationStatus === 'BLOCKED' ? '🚫 Task is blocked — complete dependencies before proceeding.' : ''}
${p.coordinationStatus === 'READY_WITH_WARNINGS' ? '⚠️  Proceed with caution — review warnings above before modifying shared files or contracts.' : ''}
${p.coordinationStatus === 'READY' ? '✅ Clear to proceed.' : ''}

Next steps:
1. declare_work_intent — list files/APIs you plan to modify
2. reserve_files — reserve files you will edit
3. Use session ID ${p.sessionId} for heartbeat calls
`.trim();

      return { content: [{ type: 'text', text: report }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Failed to begin task ${task_id}: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

// ── Tool: declare_work_intent ─────────────────────────────────────────────────

server.registerTool(
  'declare_work_intent',
  {
    description: `Declare what files, APIs, models, and contracts you plan to work on before writing any code.
This enables conflict detection and makes your plan visible to teammates.
Call this after begin_task and before reserve_files.`,
    inputSchema: z.object({
      task_id: z.string().describe('The task ID (e.g. T-102)'),
      files: z.array(z.string()).optional().default([]).describe('File paths you plan to modify (e.g. ["src/auth/AuthService.ts"])'),
      apis: z.array(z.string()).optional().default([]).describe('API endpoints you plan to modify (e.g. ["POST /api/login"])'),
      models: z.array(z.string()).optional().default([]).describe('Data models you plan to modify (e.g. ["User"])'),
      contracts: z.array(z.string()).optional().default([]).describe('Contracts you intend to provide or change'),
      summary: z.string().optional().describe('Short summary of what you plan to implement'),
    }),
  },
  async ({ task_id, files, apis, models, contracts, summary }) => {
    try {
      const response = await apiPost<{ success: boolean; data: { files: string[]; apis: string[]; models: string[] }; error?: { message: string } }>(
        `/tasks/${encodeURIComponent(task_id)}/intent`,
        { files, apis, models, contracts, summary },
      );

      if (!response.success) {
        return { content: [{ type: 'text', text: `Failed to declare intent: ${response.error?.message}` }], isError: true };
      }

      const lines = [
        files.length > 0 ? `Files:     ${files.join(', ')}` : null,
        apis.length > 0 ? `APIs:      ${apis.join(', ')}` : null,
        models.length > 0 ? `Models:    ${models.join(', ')}` : null,
        contracts.length > 0 ? `Contracts: ${contracts.join(', ')}` : null,
        summary ? `Summary:   ${summary}` : null,
      ].filter(Boolean).join('\n');

      return { content: [{ type: 'text', text: `✅ Work intent declared for ${task_id}:\n${lines}\n\nNext: call reserve_files to claim ownership of the files you will edit.` }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Failed to declare work intent: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

// ── Tool: reserve_files ────────────────────────────────────────────────────────

server.registerTool(
  'reserve_files',
  {
    description: `Reserve files you plan to modify so teammates are warned of potential overlap.
Reservations are advisory (soft) — you can still proceed even if a conflict exists.
Returns: reserved files and any conflict warnings.`,
    inputSchema: z.object({
      task_id: z.string().describe('The task ID (e.g. T-102)'),
      user_id: z.string().describe('Your user ID'),
      file_paths: z.array(z.string()).min(1).describe('List of file paths to reserve'),
      agent_session_id: z.string().optional().describe('Your agent session ID from begin_task'),
      lease_duration_seconds: z.number().int().min(30).max(3600).optional().default(120).describe('How long to hold the reservation (seconds)'),
    }),
  },
  async ({ task_id, user_id, file_paths, agent_session_id, lease_duration_seconds }) => {
    try {
      const response = await apiPost<{
        success: boolean;
        data: {
          reserved: string[];
          conflicts: Array<{ filePath: string; existingReservation: { userName: string; taskDisplayId: string; leaseExpiresAt: string | null } }>;
        };
        error?: { message: string };
      }>(
        `/tasks/${encodeURIComponent(task_id)}/files/reserve`,
        { userId: user_id, filePaths: file_paths, agentSessionId: agent_session_id, leaseDurationSeconds: lease_duration_seconds },
      );

      if (!response.success) {
        return { content: [{ type: 'text', text: `Failed to reserve files: ${response.error?.message}` }], isError: true };
      }

      const { reserved, conflicts } = response.data;
      const reservedLines = reserved.map((f) => `  ✓ ${f}`).join('\n');
      const conflictLines = conflicts.length > 0
        ? '\n\n⚠️  CONFLICTS DETECTED (you may still proceed):\n' +
          conflicts.map((c) => `  ⚠ ${c.filePath}\n    Currently held by: ${c.existingReservation.userName} / ${c.existingReservation.taskDisplayId}`).join('\n')
        : '';

      return {
        content: [{ type: 'text', text: `File reservations for ${task_id}:\n${reservedLines}${conflictLines}` }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Failed to reserve files: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

// ── Tool: release_files ────────────────────────────────────────────────────────

server.registerTool(
  'release_files',
  {
    description: `Release file reservations when you no longer need them.
Call this when you finish editing a file or before ending your session.`,
    inputSchema: z.object({
      task_id: z.string().describe('The task ID (e.g. T-102)'),
      user_id: z.string().describe('Your user ID'),
      file_paths: z.array(z.string()).min(1).describe('File paths to release'),
    }),
  },
  async ({ task_id, user_id, file_paths }) => {
    try {
      const response = await apiPost<{ success: boolean; data: { released: string[] }; error?: { message: string } }>(
        `/tasks/${encodeURIComponent(task_id)}/files/release`,
        { userId: user_id, filePaths: file_paths },
      );

      if (!response.success) {
        return { content: [{ type: 'text', text: `Failed to release files: ${response.error?.message}` }], isError: true };
      }

      const lines = response.data.released.map((f) => `  ✓ released: ${f}`).join('\n');
      return { content: [{ type: 'text', text: `Files released for ${task_id}:\n${lines}` }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Failed to release files: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

// ── Tool: get_active_file_reservations ────────────────────────────────────────

server.registerTool(
  'get_active_file_reservations',
  {
    description: `Get all currently active file reservations for a project.
Use this to understand what files teammates are working on.`,
    inputSchema: z.object({
      project_id: z.string().describe('The project ID'),
    }),
  },
  async ({ project_id }) => {
    try {
      const response = await apiGet<{
        success: boolean;
        data: Array<{
          filePath: string;
          status: string;
          user: { name: string };
          task: { displayId: string; title: string };
          leaseExpiresAt: string | null;
        }>;
      }>(`/projects/${encodeURIComponent(project_id)}/files/active`);

      if (!response.data || response.data.length === 0) {
        return { content: [{ type: 'text', text: 'No active file reservations in this project.' }] };
      }

      const lines = response.data
        .map((r) => `  ${r.status === 'CONFLICT' ? '⚠' : '✓'} ${r.filePath}\n    ${r.user.name} / ${r.task.displayId}: ${r.task.title}`)
        .join('\n');

      return { content: [{ type: 'text', text: `Active file reservations:\n${lines}` }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Failed to get file reservations: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

// ── Tool: report_progress ─────────────────────────────────────────────────────

server.registerTool(
  'report_progress',
  {
    description: `Report progress on a task. Updates the activity feed and broadcasts to the dashboard.
Call this when you complete a significant step.`,
    inputSchema: z.object({
      task_id: z.string().describe('The task ID (e.g. T-102)'),
      user_id: z.string().describe('Your user ID'),
      message: z.string().describe('Progress message (e.g. "Authentication endpoint complete. Adding tests.")'),
      agent_session_id: z.string().optional().describe('Your agent session ID'),
    }),
  },
  async ({ task_id, user_id, message, agent_session_id }) => {
    try {
      const response = await apiPost<{ success: boolean; data: { recorded: boolean }; error?: { message: string } }>(
        `/tasks/${encodeURIComponent(task_id)}/progress`,
        { userId: user_id, message, agentSessionId: agent_session_id },
      );

      if (!response.success) {
        return { content: [{ type: 'text', text: `Failed to report progress: ${response.error?.message}` }], isError: true };
      }

      return { content: [{ type: 'text', text: `✅ Progress reported for ${task_id}: "${message}"` }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Failed to report progress: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

// ── Tool: heartbeat ───────────────────────────────────────────────────────────

server.registerTool(
  'heartbeat',
  {
    description: `Send a heartbeat for your agent session to prevent it from being marked as stale.
Call this every 20-30 seconds while actively working. Also extends file reservation leases.`,
    inputSchema: z.object({
      session_id: z.string().describe('Your agent session ID from begin_task'),
    }),
  },
  async ({ session_id }) => {
    try {
      const response = await apiPost<{ success: boolean; data: { ok: boolean; sessionId: string }; error?: { message: string } }>(
        `/agent-sessions/${encodeURIComponent(session_id)}/heartbeat`,
        {},
      );

      if (!response.success) {
        return { content: [{ type: 'text', text: `Heartbeat failed: ${response.error?.message}` }], isError: true };
      }

      return { content: [{ type: 'text', text: `💓 Heartbeat sent for session ${session_id}. File leases extended.` }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Heartbeat failed: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

// ── Tool: end_task_session ────────────────────────────────────────────────────

server.registerTool(
  'end_task_session',
  {
    description: `End your agent session and automatically release all active file reservations.
Call this when you are done working, before stopping.`,
    inputSchema: z.object({
      session_id: z.string().describe('Your agent session ID from begin_task'),
    }),
  },
  async ({ session_id }) => {
    try {
      const response = await apiPost<{ success: boolean; data: { id: string; taskId: string | null }; error?: { message: string } }>(
        `/agent-sessions/${encodeURIComponent(session_id)}/end`,
        {},
      );

      if (!response.success) {
        return { content: [{ type: 'text', text: `Failed to end session: ${response.error?.message}` }], isError: true };
      }

      return { content: [{ type: 'text', text: `✅ Agent session ${session_id} ended. All file reservations released.` }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Failed to end session: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

// ── Tool: get_team_activity ───────────────────────────────────────────────────

server.registerTool(
  'get_team_activity',
  {
    description: `Get recent activity across the project: task claims, agent events, file reservations, progress updates.
Use this to understand what teammates are doing.`,
    inputSchema: z.object({
      project_id: z.string().describe('The project ID'),
      limit: z.number().int().min(1).max(50).optional().default(20).describe('Number of recent events to return'),
    }),
  },
  async ({ project_id, limit }) => {
    try {
      const response = await apiGet<{
        success: boolean;
        data: Array<{
          type: string;
          message: string;
          createdAt: string;
          user?: { name: string } | null;
          task?: { displayId: string; title: string } | null;
        }>;
      }>(`/projects/${encodeURIComponent(project_id)}/activity?limit=${limit}`);

      if (!response.data || response.data.length === 0) {
        return { content: [{ type: 'text', text: 'No recent activity in this project.' }] };
      }

      const lines = response.data
        .map((a) => {
          const time = new Date(a.createdAt).toLocaleTimeString();
          const who = a.user?.name ?? 'System';
          const task = a.task ? ` [${a.task.displayId}]` : '';
          return `${time} ${who}${task}: ${a.message}`;
        })
        .join('\n');

      return { content: [{ type: 'text', text: `Recent team activity:\n${lines}` }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Failed to get team activity: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

// ── Tool: get_coordination_risks ──────────────────────────────────────────────

server.registerTool(
  'get_coordination_risks',
  {
    description: `Get all active contract risks for a project — cases where one task modifies a contract that another task consumes.
Use this to understand cross-task integration risks before they become Git conflicts.`,
    inputSchema: z.object({
      project_id: z.string().describe('The project ID'),
    }),
  },
  async ({ project_id }) => {
    try {
      const response = await apiGet<{
        success: boolean;
        data: Array<{
          contractName: string;
          contractType: string;
          sourceTaskDisplayId: string;
          sourceRelationship: string;
          affectedTaskDisplayId: string;
          affectedRelationship: string;
        }>;
      }>(`/projects/${encodeURIComponent(project_id)}/coordination/risks`);

      if (!response.data || response.data.length === 0) {
        return { content: [{ type: 'text', text: '✅ No active coordination risks detected.' }] };
      }

      const lines = response.data
        .map(
          (r) =>
            `⚠ CONTRACT RISK: ${r.contractType} "${r.contractName}"\n` +
            `   ${r.sourceTaskDisplayId} ${r.sourceRelationship}s it\n` +
            `   ${r.affectedTaskDisplayId} ${r.affectedRelationship}s it`,
        )
        .join('\n\n');

      return { content: [{ type: 'text', text: `COORDINATION RISKS:\n\n${lines}` }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Failed to get coordination risks: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

// ── Start ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Arxion MCP Server v0.2.0 running on stdio');
  console.error(`Backend API: ${API_BASE_URL}`);
}

main().catch((error: unknown) => {
  console.error('Fatal MCP server error:', error);
  process.exit(1);
});
