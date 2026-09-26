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
  version: '0.4.0',
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
          // Phase 4
          contextUpdates?: Array<{ id: string; type: string; title: string; message: string; status: string; sourceTask: { displayId: string } | null }>;
          activeRisks?: Array<{ id: string; type: string; severity: string; title: string; description: string; sourceTask: { displayId: string } | null }>;
          gitLink?: { branchName: string | null; baseBranch: string | null; latestCommitSha: string | null; aheadCount: number | null; behindCount: number | null } | null;
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

      // Phase 4 sections
      const contextUpdateLines = (d.contextUpdates ?? []).length > 0
        ? (d.contextUpdates!).map((u) => `  📬 [${u.id.slice(-6)}] ${u.type} ${u.sourceTask ? `from ${u.sourceTask.displayId}` : ''}: ${u.title}`).join('\n')
        : '  (none)';

      const activeRiskLines = (d.activeRisks ?? []).length > 0
        ? (d.activeRisks!).map((r) => `  🔴 [${r.severity}] ${r.type}: ${r.title} ${r.sourceTask ? `(from ${r.sourceTask.displayId})` : ''}`).join('\n')
        : '  (none)';

      const branchLine = d.gitLink
        ? `${d.gitLink.branchName ?? '(not set)'} | behind: ${d.gitLink.behindCount ?? 'N/A'} | commit: ${d.gitLink.latestCommitSha?.slice(0, 7) ?? 'unknown'}`
        : '(not configured)';

      // Phase 5: readiness + pending handoffs (fetched separately — begin_task is a Phase 2 endpoint)
      let readinessLine = '';
      let handoffWarning = '';
      try {
        const readiness = await apiGet<{ state: string; reasons: string[] }>(`/tasks/${d.task.displayId}/readiness`);
        readinessLine = `\n📊 Task Readiness: ${readiness.state}\n  ${readiness.reasons[0] ?? ''}`;
        if (readiness.state === 'WAITING_FOR_CONTEXT' || readiness.state === 'INTERRUPTED') {
          const handoffs = await apiGet<Array<{ id: string; status: string; summary: string }>>(`/tasks/${d.task.displayId}/handoffs`);
          const pending = handoffs.filter((h) => h.status === 'PENDING' || h.status === 'DELIVERED');
          if (pending.length > 0) {
            handoffWarning = `\n\n🤝 PENDING HANDOFFS (${pending.length}) — acknowledgement required:\n${pending.map((h) => `  • ${h.id.slice(-8)}: ${h.summary}`).join('\n')}\n  → Call acknowledge_handoff to proceed.`;
          }
        }
      } catch {
        // non-fatal
      }

      return {
        content: [{
          type: 'text',
          text: `${statusEmoji} COORDINATION STATUS: ${d.coordinationStatus}
════════════════════════════════════════════════
Task:       ${d.task.displayId} — ${d.task.title}
Session ID: ${d.sessionId}${readinessLine}

Blocked Dependencies:
${depLines}

Active Teammates:
${teammateLines}

File Conflicts:
${conflictLines}

Contract Risks:
${riskLines}

⚡ Active Coordination Risks (Phase 4):
${activeRiskLines}

📬 Unread Context Updates (Phase 4):
${contextUpdateLines}

🌿 Branch Status:
  ${branchLine}${handoffWarning}
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

// ── Phase 3 Tools ─────────────────────────────────────────────────────────────

server.registerTool(
  'submit_completion_report',
  {
    description: `Submit a completion report for a task before requesting review.
The report is required evidence: files changed, contracts changed, test results, revision, and known issues.
Must be called while the task is IN_PROGRESS with an active agent session.`,
    inputSchema: z.object({
      task_id: z.string().describe('Task ID (display ID like "T-102" or internal cuid)'),
      user_id: z.string().describe('Your user ID'),
      agent_session_id: z.string().optional().describe('Agent session ID from begin_task'),
      summary: z.string().min(1).describe('Summary of what was implemented'),
      files_changed: z.array(z.string()).optional().default([]).describe('List of files modified'),
      contracts_changed: z.array(z.string()).optional().default([]).describe('Contracts added or changed (e.g. "POST /api/login", "LoginResponse v2")'),
      tests_run: z.number().int().min(0).optional().default(0).describe('Total number of tests run'),
      tests_passed: z.number().int().min(0).optional().default(0).describe('Number of tests passed'),
      tests_failed: z.number().int().min(0).optional().default(0).describe('Number of tests failed'),
      known_issues: z.string().optional().describe('Any known issues or limitations'),
      scope_changes: z.string().optional().describe('Any scope changes from original intent'),
      work_revision: z.string().describe('Git commit SHA or revision identifier for this work'),
    }),
  },
  async ({ task_id, user_id, agent_session_id, summary, files_changed, contracts_changed, tests_run, tests_passed, tests_failed, known_issues, scope_changes, work_revision }) => {
    try {
      const report = await apiPost<{ id: string; taskId: string; workRevision: string }>(
        `/tasks/${encodeURIComponent(task_id)}/completion-report`,
        {
          userId: user_id,
          agentSessionId: agent_session_id,
          summary,
          filesChanged: files_changed,
          contractsChanged: contracts_changed,
          testsRun: tests_run,
          testsPassed: tests_passed,
          testsFailed: tests_failed,
          knownIssues: known_issues,
          scopeChanges: scope_changes,
          workRevision: work_revision,
        },
      );

      const lines = [
        `✅ Completion report submitted for task ${task_id}`,
        `Report ID: ${report.id}`,
        `Revision:  ${report.workRevision}`,
        `Tests:     ${tests_passed}/${tests_run} passed`,
        tests_failed > 0 ? `⚠️  ${tests_failed} test(s) failed` : '',
        known_issues ? `⚠️  Known issues: ${known_issues}` : '',
        '',
        'You can now call request_review to initiate a review.',
      ].filter(Boolean);

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Failed to submit completion report: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

server.registerTool(
  'request_review',
  {
    description: `Request a human review for a completed task.
Runs a full review preflight check before creating the review.
Will be BLOCKED if: task is not IN_PROGRESS, no completion report, or unfinished dependencies.
Will return READY_WITH_WARNINGS for scope deviations, test failures, or contract risks.
Only BLOCKED prevents review creation.`,
    inputSchema: z.object({
      task_id: z.string().describe('Task ID (display ID like "T-102" or internal cuid)'),
      user_id: z.string().describe('Your user ID'),
      agent_session_id: z.string().optional().describe('Agent session ID from begin_task'),
    }),
  },
  async ({ task_id, user_id, agent_session_id }) => {
    try {
      const result = await apiPost<{
        review: { id: string; reviewVersion: number; reviewRevision: string | null; status: string };
        preflight: { status: string; warnings: string[]; blockers: string[]; scopeDeviations: Array<{ file: string; reason: string; severity: string }> };
      }>(
        `/tasks/${encodeURIComponent(task_id)}/request-review`,
        { userId: user_id, agentSessionId: agent_session_id },
      );

      const { review, preflight } = result;
      const lines = [
        `✅ Review v${review.reviewVersion} created for task ${task_id}`,
        `Review ID:  ${review.id}`,
        `Status:     ${review.status}`,
        `Revision:   ${review.reviewRevision ?? 'N/A'}`,
        preflight.warnings.length > 0 ? `\n⚠️  Warnings:` : '',
        ...preflight.warnings.map((w) => `   • ${w}`),
        preflight.scopeDeviations.length > 0 ? `\n📋 Scope deviations:` : '',
        ...preflight.scopeDeviations.map((d) => `   • ${d.file} — ${d.reason} (${d.severity})`),
        '',
        'The reviewer will receive an AI-assisted review summary. Await human approval.',
      ].filter(Boolean);

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Failed to request review: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

server.registerTool(
  'get_review',
  {
    description: `Get the current review status and findings for a task.
Returns the latest review with its status, findings, snapshot, and approval state.`,
    inputSchema: z.object({
      task_id: z.string().describe('Task ID (display ID like "T-102" or internal cuid)'),
    }),
  },
  async ({ task_id }) => {
    try {
      const reviews = await apiGet<Array<{
        id: string;
        status: string;
        reviewVersion: number;
        reviewRevision: string | null;
        approvedAt: string | null;
        approvedById: string | null;
        findings: Array<{ id: string; title: string; severity: string; source: string; status: string; isBlocking: boolean }>;
      }>>(`/tasks/${encodeURIComponent(task_id)}/reviews`);

      if (reviews.length === 0) {
        return { content: [{ type: 'text', text: `No reviews found for task ${task_id}.` }] };
      }

      const latest = reviews[0]!;
      const blockingOpen = latest.findings.filter((f) => f.isBlocking && f.status === 'OPEN');
      const lines = [
        `Review v${latest.reviewVersion} — ${latest.status}`,
        `Review ID:  ${latest.id}`,
        `Revision:   ${latest.reviewRevision ?? 'N/A'}`,
        latest.approvedAt ? `Approved:   ${latest.approvedAt}` : '',
        ``,
        `Findings (${latest.findings.length} total, ${blockingOpen.length} blocking open):`,
        ...latest.findings.map((f) => `  [${f.source}] ${f.severity} — ${f.title} (${f.status})${f.isBlocking ? ' 🔴 BLOCKING' : ''}`),
      ].filter((l) => l !== undefined);

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Failed to get review: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

server.registerTool(
  'run_ai_review',
  {
    description: `Trigger an AI-assisted review for a review in progress.
The AI review analyses the completion report, test results, scope deviations, contract risks, and dependency completeness.
AI review NEVER approves the review — it only creates findings to assist the human reviewer.`,
    inputSchema: z.object({
      review_id: z.string().describe('Review ID from request_review or get_review'),
    }),
  },
  async ({ review_id }) => {
    try {
      const result = await apiPost<{ findings: unknown[]; findingsCreated: number }>(
        `/reviews/${encodeURIComponent(review_id)}/ai-review`,
        {},
      );
      return {
        content: [{
          type: 'text',
          text: `✅ AI review completed for review ${review_id}.\n${result.findingsCreated} finding(s) created.\nThe human reviewer will see these findings on the review page.`,
        }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Failed to run AI review: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

server.registerTool(
  'get_review_feedback',
  {
    description: `Get all findings (feedback) for a review — from AI, humans, or the system.
Use this to see what needs to be addressed before the review can be approved.`,
    inputSchema: z.object({
      review_id: z.string().describe('Review ID'),
    }),
  },
  async ({ review_id }) => {
    try {
      const findings = await apiGet<Array<{
        id: string;
        source: string;
        severity: string;
        category: string;
        title: string;
        description: string;
        status: string;
        isBlocking: boolean;
        filePath: string | null;
        contractName: string | null;
      }>>(`/reviews/${encodeURIComponent(review_id)}/findings`);

      if (findings.length === 0) {
        return { content: [{ type: 'text', text: `No findings for review ${review_id}.` }] };
      }

      const blocking = findings.filter((f) => f.isBlocking && f.status === 'OPEN');
      const lines = [
        `Findings for review ${review_id} (${findings.length} total, ${blocking.length} blocking open):`,
        '',
        ...findings.map((f) =>
          `[${f.id.slice(-6)}] [${f.source}] ${f.severity}/${f.category} — ${f.title}\n  Status: ${f.status}${f.isBlocking ? ' 🔴 BLOCKING' : ''}${f.filePath ? `\n  File: ${f.filePath}` : ''}`,
        ),
      ];
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Failed to get review feedback: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

server.registerTool(
  'resolve_review_feedback',
  {
    description: `Mark a review finding as RESOLVED or DISMISSED.
Use RESOLVED when you have addressed the issue.
Use DISMISSED when the finding is not applicable.
Never deletes findings — preserves audit history.`,
    inputSchema: z.object({
      finding_id: z.string().describe('Finding ID from get_review_feedback'),
      status: z.enum(['RESOLVED', 'DISMISSED']).describe('New status for the finding'),
      resolved_by_id: z.string().optional().describe('Your user ID'),
    }),
  },
  async ({ finding_id, status, resolved_by_id }) => {
    try {
      await apiPatch(`/findings/${encodeURIComponent(finding_id)}/resolve`, {
        status,
        resolvedById: resolved_by_id,
      });
      return {
        content: [{ type: 'text', text: `✅ Finding ${finding_id} marked as ${status}.` }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Failed to resolve finding: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

server.registerTool(
  'get_merge_readiness',
  {
    description: `Check whether a task is ready to merge.
Returns READY_TO_MERGE, READY_WITH_WARNINGS, or NOT_READY.
Checks: approved review, revision match, no blocking findings, completed dependencies, merge status.`,
    inputSchema: z.object({
      task_id: z.string().describe('Task ID (display ID like "T-102" or internal cuid)'),
    }),
  },
  async ({ task_id }) => {
    try {
      const readiness = await apiGet<{
        status: string;
        warnings: string[];
        blockers: string[];
        approvedRevision: string | null;
        currentRevision: string | null;
        revisionsMatch: boolean;
      }>(`/tasks/${encodeURIComponent(task_id)}/merge-readiness`);

      const icon = readiness.status === 'READY_TO_MERGE' ? '✅' : readiness.status === 'READY_WITH_WARNINGS' ? '⚠️' : '❌';
      const lines = [
        `${icon} Merge Readiness: ${readiness.status}`,
        `Approved revision: ${readiness.approvedRevision ?? 'N/A'}`,
        `Current revision:  ${readiness.currentRevision ?? 'N/A'}`,
        `Revisions match:   ${readiness.revisionsMatch ? 'Yes' : 'No'}`,
        readiness.blockers.length > 0 ? `\n🚫 Blockers:` : '',
        ...readiness.blockers.map((b) => `   • ${b}`),
        readiness.warnings.length > 0 ? `\n⚠️  Warnings:` : '',
        ...readiness.warnings.map((w) => `   • ${w}`),
      ].filter(Boolean);

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Failed to get merge readiness: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

server.registerTool(
  'complete_task',
  {
    description: `Mark a task as DONE after it has been approved and merged.
This is idempotent — calling twice has no duplicate side effects.

Completion requires:
- An approved review
- No blocking findings remaining
- Merge confirmed (or no git link)

On success:
- Task → DONE
- All file reservations released
- All agent sessions ended
- Draft contract versions → ACTIVE
- Dependent tasks re-evaluated (blocked → ready if all deps DONE)
- Activity recorded and events emitted`,
    inputSchema: z.object({
      task_id: z.string().describe('Task ID (display ID like "T-102" or internal cuid)'),
      user_id: z.string().describe('Your user ID'),
    }),
  },
  async ({ task_id, user_id }) => {
    try {
      const result = await apiPost<{
        task: { id: string; displayId: string; status: string; completedAt: string | null };
        alreadyDone: boolean;
      }>(
        `/tasks/${encodeURIComponent(task_id)}/complete`,
        { userId: user_id },
      );

      if (result.alreadyDone) {
        return {
          content: [{ type: 'text', text: `ℹ️  Task ${task_id} was already DONE. No changes made.` }],
        };
      }

      return {
        content: [{
          type: 'text',
          text: [
            `✅ Task ${result.task.displayId} marked as DONE.`,
            `Completed at: ${result.task.completedAt ?? 'now'}`,
            '',
            'The following happened automatically:',
            '• File reservations released',
            '• Agent sessions ended',
            '• Draft contracts activated',
            '• Dependent tasks re-evaluated',
          ].join('\n'),
        }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Failed to complete task: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

server.registerTool(
  'get_project_decisions',
  {
    description: `Retrieve all project decisions recorded for a project.
Use this during begin_task to understand prior architectural and design decisions that should guide your work.`,
    inputSchema: z.object({
      project_id: z.string().describe('The project ID'),
    }),
  },
  async ({ project_id }) => {
    try {
      const decisions = await apiGet<Array<{
        id: string;
        title: string;
        decision: string;
        reason: string | null;
        status: string;
        createdAt: string;
        createdBy: { name: string };
        task: { displayId: string; title: string } | null;
      }>>(`/projects/${encodeURIComponent(project_id)}/decisions`);

      if (decisions.length === 0) {
        return { content: [{ type: 'text', text: `No project decisions recorded for project ${project_id}.` }] };
      }

      const lines = [
        `Project Decisions (${decisions.length}):`,
        '',
        ...decisions.map((d) => [
          `[${d.id.slice(-6)}] ${d.title} — ${d.status}`,
          `  Decision: ${d.decision}`,
          d.reason ? `  Reason: ${d.reason}` : '',
          d.task ? `  Task: ${d.task.displayId} — ${d.task.title}` : '',
          `  By: ${d.createdBy.name} on ${new Date(d.createdAt).toLocaleDateString()}`,
        ].filter(Boolean).join('\n')),
      ];

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Failed to get project decisions: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

server.registerTool(
  'record_project_decision',
  {
    description: `Record an architectural or design decision for the project.
Decisions are stored in the project decision log and provided to future agents during begin_task preflight.
Use this to capture important choices that will inform the rest of the project.`,
    inputSchema: z.object({
      project_id: z.string().describe('The project ID'),
      title: z.string().describe('Short title for the decision (e.g. "Use JWT for auth")'),
      decision: z.string().describe('Full decision text'),
      reason: z.string().optional().describe('Why this decision was made'),
      created_by_id: z.string().describe('Your user ID'),
      task_id: z.string().optional().describe('Related task ID if applicable'),
      agent_session_id: z.string().optional().describe('Agent session ID from begin_task'),
    }),
  },
  async ({ project_id, title, decision, reason, created_by_id, task_id, agent_session_id }) => {
    try {
      const dec = await apiPost<{ id: string; title: string; status: string }>(
        `/projects/${encodeURIComponent(project_id)}/decisions`,
        {
          title,
          decision,
          reason,
          createdById: created_by_id,
          taskId: task_id,
          agentSessionId: agent_session_id,
        },
      );
      return {
        content: [{
          type: 'text',
          text: `✅ Project decision recorded.\nID: ${dec.id}\nTitle: ${dec.title}\nStatus: ${dec.status}`,
        }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Failed to record decision: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

// ── Phase 4 Tools ─────────────────────────────────────────────────────────────

server.registerTool(
  'get_git_status',
  {
    description: `Get the Git status of a task — branch name, latest commit, divergence from base branch.
Returns ahead/behind counts so you know if your branch is stale relative to main/develop.`,
    inputSchema: z.object({
      task_id: z.string().describe('Task ID (display ID like "T-102" or internal cuid)'),
    }),
  },
  async ({ task_id }) => {
    try {
      const response = await apiGet<{ success: boolean; data: {
        taskId: string;
        branchName: string | null;
        baseBranch: string | null;
        aheadCount: number | null;
        behindCount: number | null;
        latestCommitSha: string | null;
        isDiverged: boolean;
      } }>(`/tasks/${encodeURIComponent(task_id)}/branch-status`);

      const s = response.data;
      const divergenceMsg = s.isDiverged
        ? `⚠️  BRANCH DIVERGED — ${s.behindCount} commit(s) behind ${s.baseBranch}`
        : '✅ Branch is up to date.';

      return {
        content: [{
          type: 'text',
          text: `GIT STATUS for ${task_id}
════════════════════════════════════════════════
Branch:         ${s.branchName ?? '(not set)'}
Base Branch:    ${s.baseBranch ?? '(not set)'}
Latest Commit:  ${s.latestCommitSha ?? '(unknown)'}
Ahead:          ${s.aheadCount ?? 'N/A'}
Behind:         ${s.behindCount ?? 'N/A'}
${divergenceMsg}`,
        }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Failed to get git status: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

server.registerTool(
  'get_actual_changes',
  {
    description: `Get the actual files changed by a task as recorded from Git pushes.
Compares declared work intent vs actual Git changes to detect scope deviations.`,
    inputSchema: z.object({
      task_id: z.string().describe('Task ID (display ID like "T-102" or internal cuid)'),
    }),
  },
  async ({ task_id }) => {
    try {
      const [changesRes, scopeRes] = await Promise.all([
        apiGet<{ success: boolean; data: Array<{ filePath: string; changeType: string; additions: number; deletions: number; commitSha: string }> }>(
          `/tasks/${encodeURIComponent(task_id)}/actual-changes`,
        ),
        apiGet<{ success: boolean; data: { declaredFiles: string[]; actualFiles: string[]; unexpectedFiles: string[]; missingDeclaredFiles: string[]; hasDeviation: boolean } }>(
          `/tasks/${encodeURIComponent(task_id)}/scope-analysis`,
        ),
      ]);

      const changes = changesRes.data;
      const scope = scopeRes.data;

      if (changes.length === 0) {
        return { content: [{ type: 'text', text: `No actual Git changes recorded for task ${task_id} yet. Changes are recorded when a Git push arrives for the task's branch.` }] };
      }

      const changeLines = changes.map(
        (c) => `  [${c.changeType}] ${c.filePath} (+${c.additions}/-${c.deletions}) @ ${c.commitSha.slice(0, 7)}`,
      ).join('\n');

      const deviationBlock = scope.hasDeviation
        ? `\n⚠️  SCOPE DEVIATION DETECTED\nUnexpected files:\n${scope.unexpectedFiles.map((f) => `  ⚡ ${f}`).join('\n')}\nMissing declared files:\n${scope.missingDeclaredFiles.map((f) => `  ? ${f}`).join('\n')}`
        : '\n✅ Actual scope matches declared work intent.';

      return {
        content: [{
          type: 'text',
          text: `ACTUAL CHANGES for ${task_id} (${changes.length} file(s)):
${changeLines}
${deviationBlock}`,
        }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Failed to get actual changes: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

server.registerTool(
  'get_context_updates',
  {
    description: `Get context updates for a task — notifications about upstream changes that affect your work.
Context updates are generated when another task modifies a contract or type your task consumes.
Always check for unread context updates at the start of a work session via begin_task.`,
    inputSchema: z.object({
      task_id: z.string().describe('Task ID (display ID like "T-102" or internal cuid)'),
      status: z.enum(['UNREAD', 'READ', 'ACKNOWLEDGED', 'RESOLVED']).optional().describe('Filter by status (default: all)'),
    }),
  },
  async ({ task_id, status }) => {
    try {
      const qs = status ? `?status=${status}` : '';
      const response = await apiGet<{ success: boolean; data: Array<{
        id: string;
        type: string;
        title: string;
        message: string;
        status: string;
        createdAt: string;
        sourceTask: { displayId: string; title: string } | null;
        entity: { name: string; type: string } | null;
      }> }>(`/tasks/${encodeURIComponent(task_id)}/context-updates${qs}`);

      if (response.data.length === 0) {
        return { content: [{ type: 'text', text: `✅ No context updates for task ${task_id}.` }] };
      }

      const lines = response.data.map((u) => {
        const from = u.sourceTask ? `from ${u.sourceTask.displayId}` : '';
        const entity = u.entity ? ` [${u.entity.type}: ${u.entity.name}]` : '';
        return `[${u.id.slice(-6)}] ${u.status} | ${u.type}${entity} ${from}\n  ${u.message}`;
      }).join('\n\n');

      return {
        content: [{
          type: 'text',
          text: `CONTEXT UPDATES for ${task_id} (${response.data.length}):
════════════════════════════════════════════════
${lines}
════════════════════════════════════════════════
Use acknowledge_context_update to mark updates as ACKNOWLEDGED after reviewing.`,
        }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Failed to get context updates: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

server.registerTool(
  'acknowledge_context_update',
  {
    description: `Acknowledge a context update after you have reviewed it and adapted your work accordingly.
Use status ACKNOWLEDGED when you have acted on the update, RESOLVED when it is no longer relevant.`,
    inputSchema: z.object({
      update_id: z.string().describe('Context update ID from get_context_updates'),
      status: z.enum(['READ', 'ACKNOWLEDGED', 'RESOLVED']).describe('New status for the update'),
    }),
  },
  async ({ update_id, status }) => {
    try {
      await apiPatch(`/context-updates/${encodeURIComponent(update_id)}/acknowledge`, { status });
      return {
        content: [{ type: 'text', text: `✅ Context update ${update_id} marked as ${status}.` }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Failed to acknowledge context update: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

server.registerTool(
  'acknowledge_risk',
  {
    description: `Acknowledge or dismiss a coordination risk.
Use ACKNOWLEDGED when you are aware of the risk and proceeding carefully.
Use DISMISSED when the risk is not applicable to your work.`,
    inputSchema: z.object({
      risk_id: z.string().describe('Risk ID from get_task_risks or begin_task active risks'),
      status: z.enum(['ACKNOWLEDGED', 'DISMISSED']).describe('New status for the risk'),
    }),
  },
  async ({ risk_id, status }) => {
    try {
      await apiPatch(`/risks/${encodeURIComponent(risk_id)}/acknowledge`, { status });
      return {
        content: [{ type: 'text', text: `✅ Risk ${risk_id} marked as ${status}.` }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Failed to acknowledge risk: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

server.registerTool(
  'get_impact_analysis',
  {
    description: `Get the impact analysis for a code entity — who consumes it and which active tasks are affected.
Use the entity ID from get_actual_changes or get_active_contract.`,
    inputSchema: z.object({
      entity_id: z.string().describe('Code entity ID'),
    }),
  },
  async ({ entity_id }) => {
    try {
      const response = await apiGet<{ success: boolean; data: {
        changedEntity: { id: string; name: string; type: string; filePath: string };
        directConsumers: Array<{
          entity: { id: string; name: string; filePath: string };
          relationship: string;
          confidence: string;
          activeTasks: Array<{ taskId: string; taskDisplayId: string; taskTitle: string }>;
        }>;
        totalAffectedTasks: number;
      } }>(`/entities/${encodeURIComponent(entity_id)}/impact`);

      const d = response.data;
      const consumerLines = d.directConsumers.map((c) => {
        const taskLines = c.activeTasks.length > 0
          ? c.activeTasks.map((t) => `      → ${t.taskDisplayId}: ${t.taskTitle}`).join('\n')
          : '      (no active tasks)';
        return `  • ${c.entity.name} (${c.entity.filePath}) [${c.relationship}, ${c.confidence}]\n${taskLines}`;
      }).join('\n');

      return {
        content: [{
          type: 'text',
          text: `IMPACT ANALYSIS for ${d.changedEntity.type} "${d.changedEntity.name}"
${d.changedEntity.filePath}
════════════════════════════════════════════════
Direct Consumers (${d.directConsumers.length}):
${consumerLines || '  (none found)'}

Total Affected Active Tasks: ${d.totalAffectedTasks}`,
        }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Failed to get impact analysis: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

server.registerTool(
  'get_active_contract',
  {
    description: `Get the active declared contracts for a task — what APIs, types, or models it provides, modifies, or consumes.`,
    inputSchema: z.object({
      task_id: z.string().describe('Task ID (display ID like "T-102" or internal cuid)'),
    }),
  },
  async ({ task_id }) => {
    try {
      const response = await apiGet<Array<{
        id: string;
        type: string;
        name: string;
        relationship: string;
        createdAt: string;
      }>>(`/tasks/${encodeURIComponent(task_id)}/contracts`);

      if (response.length === 0) {
        return { content: [{ type: 'text', text: `No contracts declared for task ${task_id}.` }] };
      }

      const lines = response.map(
        (c) => `  [${c.id.slice(-6)}] ${c.relationship} ${c.type} "${c.name}"`,
      ).join('\n');

      return { content: [{ type: 'text', text: `Contracts for ${task_id}:\n${lines}` }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Failed to get contracts: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

server.registerTool(
  'get_contract_consumers',
  {
    description: `Get all tasks that consume a given contract name across the project.
Useful for understanding blast radius before modifying a shared type, API, or model.`,
    inputSchema: z.object({
      project_id: z.string().describe('The project ID'),
      contract_name: z.string().describe('Contract name to search for (e.g. "LoginResponse", "POST /api/login")'),
    }),
  },
  async ({ project_id, contract_name }) => {
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

      const relevant = response.data.filter(
        (r) => r.contractName.toLowerCase() === contract_name.toLowerCase(),
      );

      if (relevant.length === 0) {
        return { content: [{ type: 'text', text: `No active contract risks found for "${contract_name}".` }] };
      }

      const lines = relevant.map(
        (r) => `  ${r.sourceTaskDisplayId} ${r.sourceRelationship}s "${r.contractName}" — affects ${r.affectedTaskDisplayId} (${r.affectedRelationship}s it)`,
      ).join('\n');

      return { content: [{ type: 'text', text: `Contract consumers for "${contract_name}":\n${lines}` }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Failed to get contract consumers: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

server.registerTool(
  'get_branch_status',
  {
    description: `Get branch divergence status for a task — how far ahead/behind its branch is from the base branch.
Triggers a live check against the GitHub API if a repository is connected.`,
    inputSchema: z.object({
      task_id: z.string().describe('Task ID (display ID like "T-102" or internal cuid)'),
    }),
  },
  async ({ task_id }) => {
    try {
      const response = await apiGet<{ success: boolean; data: {
        branchName: string | null;
        baseBranch: string | null;
        aheadCount: number | null;
        behindCount: number | null;
        latestCommitSha: string | null;
        isDiverged: boolean;
      } }>(`/tasks/${encodeURIComponent(task_id)}/branch-status`);

      const s = response.data;
      const icon = s.isDiverged ? '⚠️' : '✅';
      return {
        content: [{
          type: 'text',
          text: `${icon} Branch Status for ${task_id}
Branch: ${s.branchName ?? 'not set'} → base: ${s.baseBranch ?? 'not set'}
Ahead: ${s.aheadCount ?? 'N/A'}  Behind: ${s.behindCount ?? 'N/A'}
Latest commit: ${s.latestCommitSha ?? 'unknown'}
${s.isDiverged ? `⚠️  ${s.behindCount} commit(s) behind base — rebase recommended.` : '✅ Up to date.'}`,
        }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Failed to get branch status: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

// ── Phase 5 Tools ─────────────────────────────────────────────────────────────

server.registerTool(
  'get_task_handoffs',
  {
    description: `Get all pending/delivered handoffs for a task.
A handoff contains structured context from a completed upstream task — contracts, decisions, changes, remaining risks.
Call this via begin_task automatically, or explicitly when resuming work on a task.`,
    inputSchema: {
      task_id: z.string().describe('Task ID or display ID (e.g. "T-103")'),
    },
  },
  async ({ task_id }) => {
    try {
      const handoffs = await apiGet<Array<Record<string, unknown>>>(`/tasks/${task_id}/handoffs`);
      if (handoffs.length === 0) {
        return { content: [{ type: 'text', text: `No pending handoffs for task ${task_id}.` }] };
      }
      const lines = handoffs.map((h) => {
        const payload = h['payload'] as Record<string, unknown> | undefined;
        const contracts = (payload?.['finalContracts'] as unknown[] | undefined) ?? [];
        return `[${String(h['status'])}] ${String(h['id']).slice(-8)} — from ${String(payload?.['sourceTaskDisplayId'] ?? '?')} → ${String(payload?.['targetTaskDisplayId'] ?? '?')}
  Summary: ${String(h['summary'])}
  Contracts: ${contracts.length > 0 ? contracts.map((c) => String((c as Record<string, unknown>)['name'])).join(', ') : 'none'}
  Revision: ${String(h['sourceRevision'] ?? 'unknown')}`;
      }).join('\n\n');
      return { content: [{ type: 'text', text: `HANDOFFS FOR ${task_id}:\n\n${lines}` }] };
    } catch (error) {
      return { content: [{ type: 'text', text: `get_task_handoffs failed: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
  },
);

server.registerTool(
  'get_handoff',
  {
    description: 'Get full details of a specific handoff by ID.',
    inputSchema: {
      handoff_id: z.string().describe('Handoff ID'),
    },
  },
  async ({ handoff_id }) => {
    try {
      const h = await apiGet<Record<string, unknown>>(`/handoffs/${handoff_id}`);
      const payload = h['payload'] as Record<string, unknown> | undefined;
      return {
        content: [{
          type: 'text',
          text: `HANDOFF ${handoff_id}
Status: ${String(h['status'])}
Summary: ${String(h['summary'])}
Revision: ${String(h['sourceRevision'] ?? 'unknown')}

Final Contracts:
${((payload?.['finalContracts'] as unknown[]) ?? []).map((c) => `  • ${String((c as Record<string, unknown>)['name'])} (${String((c as Record<string, unknown>)['type'])})`).join('\n') || '  (none)'}

Relevant Decisions:
${((payload?.['relevantDecisions'] as unknown[]) ?? []).map((d) => `  • ${String((d as Record<string, unknown>)['title'])}: ${String((d as Record<string, unknown>)['decision'])}`).join('\n') || '  (none)'}

Relevant Changes:
${((payload?.['relevantChanges'] as unknown[]) ?? []).map((c) => `  • [${String((c as Record<string, unknown>)['changeType'])}] ${String((c as Record<string, unknown>)['filePath'])}`).join('\n') || '  (none)'}

Remaining Risks:
${((payload?.['remainingRisks'] as unknown[]) ?? []).map((r) => `  • [${String((r as Record<string, unknown>)['severity'])}] ${String((r as Record<string, unknown>)['title'])}`).join('\n') || '  (none)'}

Recommended Next Check:
  ${String(payload?.['recommendedNextCheck'] ?? 'none')}`,
        }],
      };
    } catch (error) {
      return { content: [{ type: 'text', text: `get_handoff failed: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
  },
);

server.registerTool(
  'acknowledge_handoff',
  {
    description: `Acknowledge a handoff to confirm you have received and understood the upstream context.
Required before a task transitions from WAITING_FOR_CONTEXT to READY.
Stores your agent session ID as proof of receipt.`,
    inputSchema: {
      handoff_id: z.string().describe('Handoff ID to acknowledge'),
      agent_session_id: z.string().optional().describe('Your current agent session ID from begin_task'),
    },
  },
  async ({ handoff_id, agent_session_id }) => {
    try {
      const result = await apiPost<Record<string, unknown>>(`/handoffs/${handoff_id}/acknowledge`, { agentSessionId: agent_session_id });
      return { content: [{ type: 'text', text: `✅ Handoff ${handoff_id} acknowledged. Status: ${String(result['status'])}` }] };
    } catch (error) {
      return { content: [{ type: 'text', text: `acknowledge_handoff failed: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
  },
);

server.registerTool(
  'get_task_readiness',
  {
    description: `Get the calculated readiness state for a task.
States: READY | BLOCKED_BY_DEPENDENCY | AT_RISK | WAITING_FOR_REVIEW | WAITING_FOR_CONTEXT | INTERRUPTED
Always includes structured reasons — never an unexplained label.`,
    inputSchema: {
      task_id: z.string().describe('Task ID or display ID'),
      recalculate: z.boolean().optional().describe('Force recalculation (default: use cached)'),
    },
  },
  async ({ task_id, recalculate }) => {
    try {
      const endpoint = recalculate
        ? `/tasks/${task_id}/readiness/recalculate`
        : `/tasks/${task_id}/readiness`;
      const r = await (recalculate
        ? apiPost<Record<string, unknown>>(endpoint, {})
        : apiGet<Record<string, unknown>>(endpoint));
      const reasons = (r['reasons'] as string[] | undefined) ?? [];
      return {
        content: [{
          type: 'text',
          text: `READINESS: ${String(r['state'])}
Task: ${task_id}
Reasons:
${reasons.map((reason) => `  • ${reason}`).join('\n') || '  (none)'}
Evaluated: ${String(r['evaluatedAt'] ?? r['sourceRevision'] ?? 'N/A')}`,
        }],
      };
    } catch (error) {
      return { content: [{ type: 'text', text: `get_task_readiness failed: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
  },
);

server.registerTool(
  'get_recovery_context',
  {
    description: `Get recovery context for an interrupted task.
Returns the latest recovery snapshot plus a delta of what changed while the agent was away.
Call this after resume_task to understand what work is pending.`,
    inputSchema: {
      task_id: z.string().describe('Task ID or display ID'),
    },
  },
  async ({ task_id }) => {
    try {
      const ctx = await apiGet<{
        snapshot: Record<string, unknown>;
        delta: { newDecisions: unknown[]; newRisks: unknown[]; branchAdvancedBy: number; newContextUpdates: unknown[]; newHandoffs: unknown[] };
        currentContext: Record<string, unknown>;
      }>(`/tasks/${task_id}/recovery`);

      const s = ctx.snapshot;
      const d = ctx.delta;

      return {
        content: [{
          type: 'text',
          text: `RECOVERY CONTEXT — ${task_id}
Trigger: ${String(s['trigger'])}
Last Revision: ${String(s['lastKnownRevision'] ?? 'unknown')}
Last Progress: ${String(s['lastProgressMessage'] ?? '(none)')}

WHILE YOU WERE AWAY:
  Branch advanced by: ${d.branchAdvancedBy} commit(s)
  New decisions: ${d.newDecisions.length}
  New risks: ${d.newRisks.length}
  New context updates: ${d.newContextUpdates.length}
  New handoffs: ${d.newHandoffs.length}
${d.newDecisions.length > 0 ? '\nNew Decisions:\n' + d.newDecisions.map((dec) => `  • ${String((dec as Record<string, unknown>)['title'])}`).join('\n') : ''}
${d.newRisks.length > 0 ? '\nNew Risks:\n' + d.newRisks.map((r) => `  • [${String((r as Record<string, unknown>)['severity'])}] ${String((r as Record<string, unknown>)['title'])}`).join('\n') : ''}`,
        }],
      };
    } catch (error) {
      return { content: [{ type: 'text', text: `get_recovery_context failed: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
  },
);

server.registerTool(
  'resume_task',
  {
    description: `Resume an interrupted task. Creates a new agent session and returns recovery context + delta.
Stale reservations are NOT inherited — you will need to re-reserve files you need.
Call get_recovery_context after this to see what changed while the previous session was away.`,
    inputSchema: {
      task_id: z.string().describe('Task ID or display ID to resume'),
      user_id: z.string().describe('Developer user ID'),
      agent_type: z.string().optional().describe('Agent type (default: IBM_BOB)'),
    },
  },
  async ({ task_id, user_id, agent_type }) => {
    try {
      const result = await apiPost<{
        session: Record<string, unknown>;
        snapshot: Record<string, unknown> | null;
        delta: Record<string, unknown> | null;
        contextPackage: Record<string, unknown>;
      }>(`/tasks/${task_id}/resume`, { userId: user_id, agentType: agent_type });

      const sessionId = String(result.session['id']);
      const hasDelta = !!result.delta;
      const readiness = (result.contextPackage['content'] as Record<string, unknown> | undefined)?.['readiness'] as Record<string, unknown> | undefined;

      return {
        content: [{
          type: 'text',
          text: `✅ Task ${task_id} resumed.
New Session ID: ${sessionId}
Readiness: ${String(readiness?.['state'] ?? 'UNKNOWN')}
Recovery snapshot: ${result.snapshot ? 'available' : 'none'}
Delta available: ${hasDelta ? 'yes — call get_recovery_context for details' : 'no'}

⚠️  Stale reservations were NOT inherited. Re-reserve files you need via reserve_files.`,
        }],
      };
    } catch (error) {
      return { content: [{ type: 'text', text: `resume_task failed: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
  },
);

server.registerTool(
  'get_parallel_safety',
  {
    description: `Check whether two tasks can safely proceed in parallel.
States: SAFE | SAFE_WITH_WARNINGS | UNSAFE | UNKNOWN
All states include structured reasons. This is an advisory tool — humans make scheduling decisions.`,
    inputSchema: {
      project_id: z.string().describe('Project ID'),
      task_a_id: z.string().describe('First task ID or display ID'),
      task_b_id: z.string().describe('Second task ID or display ID'),
    },
  },
  async ({ project_id, task_a_id, task_b_id }) => {
    try {
      const result = await apiGet<{
        state: string;
        reasons: string[];
        warnings: string[];
      }>(`/projects/${project_id}/parallel-safety?taskAId=${task_a_id}&taskBId=${task_b_id}`);

      const emoji = result.state === 'SAFE' ? '✅' : result.state === 'SAFE_WITH_WARNINGS' ? '⚠️' : result.state === 'UNSAFE' ? '🚫' : '❓';
      return {
        content: [{
          type: 'text',
          text: `${emoji} PARALLEL SAFETY: ${result.state}
Tasks: ${task_a_id} + ${task_b_id}

Reasons:
${result.reasons.map((r) => `  • ${r}`).join('\n') || '  (none)'}
${result.warnings.length > 0 ? `\nWarnings:\n${result.warnings.map((w) => `  ⚠️  ${w}`).join('\n')}` : ''}`,
        }],
      };
    } catch (error) {
      return { content: [{ type: 'text', text: `get_parallel_safety failed: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
  },
);

server.registerTool(
  'get_safe_parallel_tasks',
  {
    description: `Get all task pairs that can safely proceed in parallel for a project.
Returns pairs classified as SAFE or SAFE_WITH_WARNINGS.
This is advisory — use it to identify parallelizable work.`,
    inputSchema: {
      project_id: z.string().describe('Project ID'),
    },
  },
  async ({ project_id }) => {
    try {
      const pairs = await apiGet<Array<{
        taskA: { displayId: string; title: string };
        taskB: { displayId: string; title: string };
        safety: { state: string; warnings: string[] };
      }>>(`/projects/${project_id}/safe-parallel-tasks`);

      if (pairs.length === 0) {
        return { content: [{ type: 'text', text: `No safe parallel task pairs found for project ${project_id}.` }] };
      }

      const lines = pairs.map((p) =>
        `${p.safety.state === 'SAFE' ? '✅' : '⚠️'} ${p.taskA.displayId} + ${p.taskB.displayId}${p.safety.warnings.length > 0 ? ` (warning: ${p.safety.warnings[0]})` : ''}`,
      ).join('\n');

      return { content: [{ type: 'text', text: `SAFE PARALLEL PAIRS (${pairs.length}):\n${lines}` }] };
    } catch (error) {
      return { content: [{ type: 'text', text: `get_safe_parallel_tasks failed: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
  },
);

server.registerTool(
  'get_coordinator_summary',
  {
    description: `Get a project-level coordination summary.
Shows: ready tasks, waiting tasks (with reasons), interrupted tasks (with recovery availability),
safe parallel work groups, and high/critical risks.
Does not make assignments or scheduling decisions.`,
    inputSchema: {
      project_id: z.string().describe('Project ID'),
    },
  },
  async ({ project_id }) => {
    try {
      const s = await apiGet<{
        readyTasks: Array<{ displayId: string; title: string }>;
        waitingTasks: Array<{ displayId: string; title: string; reason: string }>;
        interruptedTasks: Array<{ displayId: string; title: string; hasRecovery: boolean }>;
        safeParallelGroups: Array<Array<{ displayId: string; title: string }>>;
        highRisks: Array<{ title: string; severity: string }>;
        generatedAt: string;
      }>(`/projects/${project_id}/coordinator-summary`);

      const readyLines = s.readyTasks.length > 0
        ? s.readyTasks.map((t) => `  ✅ ${t.displayId} — ${t.title}`).join('\n')
        : '  (none)';

      const waitingLines = s.waitingTasks.length > 0
        ? s.waitingTasks.map((t) => `  ⏳ ${t.displayId} — ${t.title}\n     Reason: ${t.reason}`).join('\n')
        : '  (none)';

      const interruptedLines = s.interruptedTasks.length > 0
        ? s.interruptedTasks.map((t) => `  🔴 ${t.displayId} — ${t.title} ${t.hasRecovery ? '[recovery available]' : '[no snapshot]'}`).join('\n')
        : '  (none)';

      const parallelLines = s.safeParallelGroups.length > 0
        ? s.safeParallelGroups.map((g, i) => `  Group ${i + 1}: ${g.map((t) => t.displayId).join(' + ')}`).join('\n')
        : '  (none)';

      const riskLines = s.highRisks.length > 0
        ? s.highRisks.map((r) => `  🔴 [${r.severity}] ${r.title}`).join('\n')
        : '  (none)';

      return {
        content: [{
          type: 'text',
          text: `PROJECT COORDINATION SUMMARY
Generated: ${s.generatedAt}

READY TASKS:
${readyLines}

WAITING TASKS:
${waitingLines}

INTERRUPTED TASKS:
${interruptedLines}

SAFE PARALLEL GROUPS:
${parallelLines}

HIGH/CRITICAL RISKS:
${riskLines}`,
        }],
      };
    } catch (error) {
      return { content: [{ type: 'text', text: `get_coordinator_summary failed: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
  },
);

// ── Launch Queue Tools ────────────────────────────────────────────────────────

server.registerTool(
  'get_pending_launch_requests',
  {
    description: `Get all PENDING agent launch requests for a project.
An agent should poll this at startup to check whether it has been asked to begin work on a task.
Each request contains the task to work on, the requesting user, and a context package ID.`,
    inputSchema: z.object({
      project_id: z.string().describe('The project ID to check for pending launch requests'),
    }),
  },
  async ({ project_id }) => {
    try {
      const response = await apiGet<{ success: boolean; data: Array<{
        id: string;
        taskId: string;
        userId: string;
        agentType: string;
        status: string;
        contextPackageId: string | null;
        createdAt: string;
        task: { id: string; displayId: string; title: string; status: string } | null;
        user: { id: string; name: string; email: string } | null;
      }> }>(`/projects/${encodeURIComponent(project_id)}/launch-requests`);

      if (!response.success || response.data.length === 0) {
        return { content: [{ type: 'text', text: `No pending launch requests for project ${project_id}.` }] };
      }

      const lines = response.data.map((r) =>
        `[${r.id}] Task: ${r.task?.displayId ?? r.taskId} — ${r.task?.title ?? '?'}
  Agent type: ${r.agentType}
  Requested by: ${r.user?.name ?? r.userId} <${r.user?.email ?? ''}>
  Context package: ${r.contextPackageId ?? 'none'}
  Created: ${new Date(r.createdAt).toISOString()}`,
      ).join('\n\n');

      return {
        content: [{
          type: 'text',
          text: `PENDING LAUNCH REQUESTS (${response.data.length}):\n\n${lines}\n\nCall accept_launch_request with the request ID to begin work.`,
        }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `get_pending_launch_requests failed: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

server.registerTool(
  'accept_launch_request',
  {
    description: `Accept a pending agent launch request and begin working on the task.
This transitions the request to ACCEPTED and records the agent session ID.
After accepting, call begin_task with the task ID to run the full coordination preflight.`,
    inputSchema: z.object({
      launch_request_id: z.string().describe('The launch request ID from get_pending_launch_requests'),
      agent_session_id: z.string().optional().describe('Your current agent session ID (from begin_task if already called)'),
    }),
  },
  async ({ launch_request_id, agent_session_id }) => {
    try {
      const response = await apiPost<{ success: boolean; data: {
        id: string;
        status: string;
        acceptedAt: string | null;
        task: { id: string; displayId: string; title: string } | null;
        agentSessionId: string | null;
      } }>(`/launch-requests/${encodeURIComponent(launch_request_id)}/accept`, {
        agentSessionId: agent_session_id,
      });

      const req = response.data;
      return {
        content: [{
          type: 'text',
          text: `✅ Launch request ${launch_request_id} accepted.
Task: ${req.task?.displayId ?? '?'} — ${req.task?.title ?? '?'}
Task ID: ${req.task?.id ?? '?'}
Status: ${req.status}
Accepted at: ${req.acceptedAt ?? 'now'}

Next step: call begin_task with task_id="${req.task?.id ?? req.task?.displayId ?? '?'}" to run the coordination preflight.`,
        }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `accept_launch_request failed: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

server.registerTool(
  'reject_launch_request',
  {
    description: `Cancel/reject a pending agent launch request.
Use when the agent cannot or should not work on the requested task.
The request will be marked CANCELLED and the developer will need to re-launch.`,
    inputSchema: z.object({
      launch_request_id: z.string().describe('The launch request ID to cancel'),
    }),
  },
  async ({ launch_request_id }) => {
    try {
      await apiPost(`/launch-requests/${encodeURIComponent(launch_request_id)}/cancel`, {});
      return {
        content: [{ type: 'text', text: `✅ Launch request ${launch_request_id} cancelled.` }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `reject_launch_request failed: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

// ── Start ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Arxion MCP Server v0.5.0 (Phase 5) running on stdio');
  console.error(`Backend API: ${API_BASE_URL}`);
}

main().catch((error: unknown) => {
  console.error('Fatal MCP server error:', error);
  process.exit(1);
});
