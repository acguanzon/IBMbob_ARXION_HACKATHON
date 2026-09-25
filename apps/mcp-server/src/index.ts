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
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(API_KEY ? { 'x-internal-api-key': API_KEY } : {}),
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API ${response.status} ${response.statusText} — ${body}`);
  }
  return response.json() as Promise<T>;
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(API_KEY ? { 'x-internal-api-key': API_KEY } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${response.status} ${response.statusText} — ${text}`);
  }
  return response.json() as Promise<T>;
}

async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(API_KEY ? { 'x-internal-api-key': API_KEY } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${response.status} ${response.statusText} — ${text}`);
  }
  return response.json() as Promise<T>;
}

// ── MCP Server ────────────────────────────────────────────────────────────────

const server = new McpServer({
  name: 'arxion-mcp-server',
  version: '0.3.0',
});

// ── Tool: get_task ────────────────────────────────────────────────────────────

server.registerTool(
  'get_task',
  {
    description: `Retrieve a task and its full context from the Arxion collaboration platform.
Returns: task title, description, status, priority, assignee, dependencies, and project context.
Use this before starting work on any task.`,
    inputSchema: z.object({
      task_id: z.string().describe('The task ID (display ID like "T-102" or internal cuid).'),
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
          assignee: { id: string; name: string; email: string } | null;
          createdBy: { id: string; name: string; email: string };
          dependencies: Array<{
            dependsOn: { displayId: string; title: string; status: string };
          }>;
        };
      }>(`/tasks/${encodeURIComponent(task_id)}`);

      if (!response.success) {
        return { content: [{ type: 'text', text: `Task not found: ${task_id}` }], isError: true };
      }

      const task = response.data;
      const depLines =
        task.dependencies.length > 0
          ? task.dependencies
              .map((d) => `  - ${d.dependsOn.displayId}: ${d.dependsOn.title} [${d.dependsOn.status}]`)
              .join('\n')
          : '  (none)';

      return {
        content: [{
          type: 'text',
          text: `TASK: ${task.displayId} — ${task.title}
════════════════════════════════════════════════
Status:      ${task.status}
Priority:    ${task.priority}
Assignee:    ${task.assignee ? `${task.assignee.name} <${task.assignee.email}>` : 'Unassigned'}
Project:     ${task.projectId}
Created by:  ${task.createdBy.name}

Description:
${task.description ?? '(no description)'}

Dependencies:
${depLines}
════════════════════════════════════════════════
Task ID (internal): ${task.id}`.trim(),
        }],
      };
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

      return {
        content: [{
          type: 'text',
          text: `PROJECT: ${project.name}
════════════════════════════════════════════════
ID:          ${project.id}
Description: ${project.description ?? '(none)'}
Repository:  ${project.repositoryUrl ?? '(none)'}
Task count:  ${project._count.tasks}

Members:
${memberLines}
════════════════════════════════════════════════`.trim(),
        }],
      };
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
    description: `Retrieve the dependencies of a task — what tasks must be completed before this one.`,
    inputSchema: z.object({
      task_id: z.string().describe('The task ID (display ID like T-102 or internal cuid)'),
    }),
  },
  async ({ task_id }) => {
    try {
      const response = await apiGet<{
        success: boolean;
        data: Array<{
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
    description: `Claim a task and assign it to yourself.
This marks the task as IN_PROGRESS and sets you as the assignee.
Returns a conflict error if the task is already claimed by someone else.
Use begin_task instead if you want a full coordination preflight (recommended).`,
    inputSchema: z.object({
      task_id: z.string().describe('Task ID (display ID like "T-102" or internal cuid)'),
      user_id: z.string().describe('Your user ID'),
    }),
  },
  async ({ task_id, user_id }) => {
    try {
      const response = await apiPost<{
        success: boolean;
        data?: { id: string; displayId: string; title: string; status: string; assignee: { name: string } | null };
        error?: { code: string; message: string };
      }>(`/tasks/${encodeURIComponent(task_id)}/claim`, { userId: user_id });

      if (!response.success) {
        return {
          content: [{ type: 'text', text: `❌ Cannot claim task: ${response.error?.message ?? 'Unknown error'}` }],
          isError: true,
        };
      }

      const task = response.data!;
      return {
        content: [{
          type: 'text',
          text: `✅ Task claimed successfully.
Task:    ${task.displayId} — ${task.title}
Status:  ${task.status}
Assignee: ${task.assignee?.name ?? user_id}`,
        }],
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
    description: `Full coordination preflight before starting work on a task.
This is the recommended way to start working on a task. It will:
  1. Claim the task (atomic, conflict-safe)
  2. Start an agent session
  3. Report active teammates working on related tasks
  4. Detect file conflicts from any declared work intent
  5. Detect contract risks (e.g. you consume an API that another task modifies)
  6. Return a READY / READY_WITH_WARNINGS / BLOCKED coordination status

Always call this before reserving files or declaring contracts.`,
    inputSchema: z.object({
      task_id: z.string().describe('Task ID (display ID like "T-102" or internal cuid)'),
      user_id: z.string().describe('Your user ID'),
      agent_type: z
        .enum(['IBM_BOB', 'CURSOR', 'CLAUDE_CODE', 'OTHER'])
        .optional()
        .describe('Agent type (default: IBM_BOB)'),
    }),
  },
  async ({ task_id, user_id, agent_type }) => {
    try {
      const response = await apiPost<{
        success: boolean;
        data?: {
          task: { displayId: string; title: string; status: string };
          sessionId: string;
          coordinationStatus: string;
          dependencies: Array<{ task: { displayId: string; title: string; status: string }; isBlocked: boolean }>;
          activeTeammates: Array<{ userName: string; taskDisplayId: string; agentType: string; status: string }>;
          fileConflicts: Array<{ filePath: string; existingReservation: { userName: string; taskDisplayId: string } }>;
          contractRisks: Array<{ contractName: string; contractType: string; affectedTaskDisplayId: string; affectedRelationship: string }>;
        };
        error?: { code: string; message: string };
      }>('/coordination/begin', {
        taskId: task_id,
        userId: user_id,
        agentType: agent_type ?? 'IBM_BOB',
      });

      if (!response.success || !response.data) {
        return {
          content: [{ type: 'text', text: `❌ begin_task failed: ${response.error?.message ?? 'Unknown error'}` }],
          isError: true,
        };
      }

      const d = response.data;
      const statusEmoji = d.coordinationStatus === 'READY' ? '✅' : d.coordinationStatus === 'READY_WITH_WARNINGS' ? '⚠️' : '🚫';

      const blockedDeps = d.dependencies.filter((dep) => dep.isBlocked);
      const depLines = blockedDeps.length > 0
        ? blockedDeps.map((dep) => `  🔴 ${dep.task.displayId} — ${dep.task.title} [${dep.task.status}]`).join('\n')
        : '  (none)';

      const teammateLines = d.activeTeammates.length > 0
        ? d.activeTeammates.map((t) => `  👤 ${t.userName} → ${t.taskDisplayId} (${t.agentType}, ${t.status})`).join('\n')
        : '  (none)';

      const conflictLines = d.fileConflicts.length > 0
        ? d.fileConflicts.map((c) => `  ⚡ ${c.filePath} — held by ${c.existingReservation.userName} on ${c.existingReservation.taskDisplayId}`).join('\n')
        : '  (none)';

      const riskLines = d.contractRisks.length > 0
        ? d.contractRisks.map((r) => `  ⚠️  ${r.contractType} "${r.contractName}" — ${r.affectedTaskDisplayId} ${r.affectedRelationship}s it`).join('\n')
        : '  (none)';

      return {
        content: [{
          type: 'text',
          text: `${statusEmoji} COORDINATION STATUS: ${d.coordinationStatus}
════════════════════════════════════════════════
Task:       ${d.task.displayId} — ${d.task.title}
Session ID: ${d.sessionId}

Blocked Dependencies:
${depLines}

Active Teammates:
${teammateLines}

File Conflicts:
${conflictLines}

Contract Risks:
${riskLines}
════════════════════════════════════════════════
${d.coordinationStatus === 'BLOCKED' ? '🚫 Task is BLOCKED — resolve dependencies before proceeding.' : ''}
${d.coordinationStatus === 'READY_WITH_WARNINGS' ? '⚠️  Proceed with caution — coordinate with teammates about conflicts/risks.' : ''}
${d.coordinationStatus === 'READY' ? '✅ All clear — safe to proceed.' : ''}`.trim(),
        }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `begin_task failed: ${error instanceof Error ? error.message : String(error)}` }],
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
      files: z.array(z.string()).optional().default([]).describe('File paths you plan to modify'),
      apis: z.array(z.string()).optional().default([]).describe('API endpoints you plan to modify (e.g. ["POST /api/login"])'),
      models: z.array(z.string()).optional().default([]).describe('Data models you plan to modify (e.g. ["User"])'),
      contracts: z.array(z.string()).optional().default([]).describe('Contracts you intend to provide or change'),
      summary: z.string().optional().describe('Short summary of what you plan to implement'),
    }),
  },
  async ({ task_id, files, apis, models, contracts, summary }) => {
    try {
      const response = await apiPost<{ success: boolean; data: { files: string[]; apis: string[]; models: string[] }; error?: { message: string } }>(
        `/tasks/${encodeURIComponent(task_id)}/work-intent`,
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

// ── Tool: reserve_files ───────────────────────────────────────────────────────

server.registerTool(
  'reserve_files',
  {
    description: `Reserve files you plan to modify so teammates are aware of potential conflicts.
File reservations are advisory (soft locks) — they do not block others, but generate conflict warnings.
Include your agent session ID from begin_task for automatic lease management.`,
    inputSchema: z.object({
      task_id: z.string().describe('Task ID'),
      user_id: z.string().describe('Your user ID'),
      file_paths: z.array(z.string()).min(1).describe('List of file paths to reserve'),
      agent_session_id: z.string().optional().describe('Agent session ID from begin_task'),
      lease_duration_seconds: z.number().int().min(30).max(3600).optional().describe('Lease duration in seconds (default: 120)'),
    }),
  },
  async ({ task_id, user_id, file_paths, agent_session_id, lease_duration_seconds }) => {
    try {
      const response = await apiPost<{
        success: boolean;
        data?: { reserved: string[]; conflicts: Array<{ filePath: string; existingReservation: { userName: string; taskDisplayId: string } }> };
        error?: { code: string; message: string };
      }>(`/tasks/${encodeURIComponent(task_id)}/files/reserve`, {
        userId: user_id,
        filePaths: file_paths,
        agentSessionId: agent_session_id,
        leaseDurationSeconds: lease_duration_seconds ?? 120,
      });

      if (!response.success || !response.data) {
        return {
          content: [{ type: 'text', text: `❌ Failed to reserve files: ${response.error?.message ?? 'Unknown error'}` }],
          isError: true,
        };
      }

      const { reserved, conflicts } = response.data;
      const conflictLines = conflicts.length > 0
        ? '\n\n⚡ FILE CONFLICTS:\n' + conflicts.map(
            (c) => `  - ${c.filePath} is already held by ${c.existingReservation.userName} on ${c.existingReservation.taskDisplayId}`
          ).join('\n')
        : '';

      return {
        content: [{
          type: 'text',
          text: `${conflicts.length > 0 ? '⚠️' : '✅'} Reserved ${reserved.length} file(s):
${reserved.map((f) => `  - ${f}`).join('\n')}${conflictLines}`,
        }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Failed to reserve files: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

// ── Tool: release_files ───────────────────────────────────────────────────────

server.registerTool(
  'release_files',
  {
    description: `Release file reservations when you are done modifying those files.
Always release files after completing work or before ending your session.`,
    inputSchema: z.object({
      task_id: z.string().describe('Task ID'),
      user_id: z.string().describe('Your user ID'),
      file_paths: z.array(z.string()).min(1).describe('List of file paths to release'),
    }),
  },
  async ({ task_id, user_id, file_paths }) => {
    try {
      const response = await apiPost<{
        success: boolean;
        data?: { released: string[] };
        error?: { code: string; message: string };
      }>(`/tasks/${encodeURIComponent(task_id)}/files/release`, {
        userId: user_id,
        filePaths: file_paths,
      });

      if (!response.success || !response.data) {
        return {
          content: [{ type: 'text', text: `❌ Failed to release files: ${response.error?.message ?? 'Unknown error'}` }],
          isError: true,
        };
      }

      return {
        content: [{
          type: 'text',
          text: `✅ Released ${response.data.released.length} file(s):\n${response.data.released.map((f) => `  - ${f}`).join('\n')}`,
        }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Failed to release files: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

// ── Tool: report_progress ─────────────────────────────────────────────────────

server.registerTool(
  'report_progress',
  {
    description: `Report progress on a task. Posts a message to the activity feed visible on the dashboard.
Use this to keep teammates informed of what you are doing.`,
    inputSchema: z.object({
      task_id: z.string().describe('Task ID'),
      user_id: z.string().describe('Your user ID'),
      message: z.string().min(1).max(2000).describe('Progress message'),
      agent_session_id: z.string().optional().describe('Agent session ID from begin_task'),
    }),
  },
  async ({ task_id, user_id, message, agent_session_id }) => {
    try {
      await apiPost(`/tasks/${encodeURIComponent(task_id)}/progress`, {
        userId: user_id,
        message,
        agentSessionId: agent_session_id,
      });

      return {
        content: [{ type: 'text', text: `✅ Progress recorded: "${message}"` }],
      };
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
Call this every 20–30 seconds while actively working. Also extends file reservation leases.`,
    inputSchema: z.object({
      session_id: z.string().describe('Your agent session ID from begin_task'),
    }),
  },
  async ({ session_id }) => {
    try {
      await apiPost(`/agent-sessions/${encodeURIComponent(session_id)}/heartbeat`, {});
      return {
        content: [{ type: 'text', text: `💓 Heartbeat sent for session ${session_id}. File leases extended.` }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Heartbeat failed: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

// ── Tool: get_team_activity ───────────────────────────────────────────────────

server.registerTool(
  'get_team_activity',
  {
    description: `Get recent activity across the project — what teammates have been doing.
Shows task claims, file reservations, progress reports, agent sessions, and more.`,
    inputSchema: z.object({
      project_id: z.string().describe('Project ID'),
      limit: z.number().int().min(1).max(100).optional().describe('Number of events to return (default: 20)'),
    }),
  },
  async ({ project_id, limit }) => {
    try {
      const response = await apiGet<{
        success: boolean;
        data: Array<{
          id: string;
          type: string;
          message: string;
          createdAt: string;
          user: { name: string } | null;
          task: { displayId: string; title: string } | null;
        }>;
      }>(`/projects/${encodeURIComponent(project_id)}/activity?limit=${limit ?? 20}`);

      if (!response.data || response.data.length === 0) {
        return { content: [{ type: 'text', text: 'No recent activity.' }] };
      }

      const lines = response.data.map((a) => {
        const who = a.user?.name ?? 'System';
        const where = a.task ? ` on ${a.task.displayId}` : '';
        const when = new Date(a.createdAt).toLocaleTimeString();
        return `  [${when}] ${who}${where}: ${a.message}`;
      }).join('\n');

      return {
        content: [{ type: 'text', text: `Recent activity (${response.data.length} events):\n${lines}` }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Failed to retrieve activity: ${error instanceof Error ? error.message : String(error)}` }],
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
Use this to see which files teammates are working on before making changes.`,
    inputSchema: z.object({
      project_id: z.string().describe('Project ID'),
    }),
  },
  async ({ project_id }) => {
    try {
      const response = await apiGet<{
        success: boolean;
        data: Array<{
          id: string;
          filePath: string;
          status: string;
          leaseExpiresAt: string | null;
          user: { name: string };
          task: { displayId: string; title: string };
        }>;
      }>(`/projects/${encodeURIComponent(project_id)}/files/active`);

      if (!response.data || response.data.length === 0) {
        return { content: [{ type: 'text', text: 'No active file reservations.' }] };
      }

      const lines = response.data.map((r) => {
        const expiry = r.leaseExpiresAt
          ? ` (expires ${new Date(r.leaseExpiresAt).toLocaleTimeString()})`
          : '';
        const conflict = r.status === 'CONFLICT' ? ' ⚡CONFLICT' : '';
        return `  ${r.filePath} — ${r.user.name} / ${r.task.displayId}${expiry}${conflict}`;
      }).join('\n');

      return {
        content: [{
          type: 'text',
          text: `Active file reservations (${response.data.length}):\n${lines}`,
        }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Failed to retrieve file reservations: ${error instanceof Error ? error.message : String(error)}` }],
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

// ── Tool: end_session ─────────────────────────────────────────────────────────

server.registerTool(
  'end_session',
  {
    description: `End your agent session when you are done working.
This releases all your active file reservations and marks the session as FINISHED.
Always call this when you finish working on a task.`,
    inputSchema: z.object({
      session_id: z.string().describe('Agent session ID from begin_task'),
    }),
  },
  async ({ session_id }) => {
    try {
      await apiPost(`/agent-sessions/${encodeURIComponent(session_id)}/end`, {});
      return {
        content: [{ type: 'text', text: `✅ Session ${session_id} ended. All file reservations released.` }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Failed to end session: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

// ── Start ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Arxion MCP Server v0.3.0 running on stdio');
  console.error(`Backend API: ${API_BASE_URL}`);
}

main().catch((error: unknown) => {
  console.error('Fatal MCP server error:', error);
  process.exit(1);
});
