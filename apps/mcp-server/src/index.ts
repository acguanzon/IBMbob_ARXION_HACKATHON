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
import { requireEnv, getEnv } from '@arxion/config';

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

// ── MCP Server ────────────────────────────────────────────────────────────────

const server = new McpServer({
  name: 'arxion-mcp-server',
  version: '0.1.0',
});

// ── Tool: get_task ────────────────────────────────────────────────────────────
// This is the primary Phase 1 proof-of-concept tool.
// It retrieves full task context from the backend API and returns it to the agent.

server.registerTool(
  'get_task',
  {
    description: `Retrieve a task and its full context from the Arxion collaboration platform.
Returns: task title, description, status, priority, assignee, dependencies, and project context.
Use this before starting work on any task.`,
    inputSchema: z.object({
      task_id: z
        .string()
        .describe(
          'The task ID to retrieve. Can be the display ID (e.g. "T-102") or the internal cuid.',
        ),
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
            dependsOn: {
              displayId: string;
              title: string;
              status: string;
            };
          }>;
        };
      }>(`/tasks/${encodeURIComponent(task_id)}`);

      if (!response.success) {
        return {
          content: [{ type: 'text', text: `Task not found: ${task_id}` }],
          isError: true,
        };
      }

      const task = response.data;

      const dependencyLines =
        task.dependencies.length > 0
          ? task.dependencies
              .map(
                (d) =>
                  `  - ${d.dependsOn.displayId}: ${d.dependsOn.title} [${d.dependsOn.status}]`,
              )
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

      return {
        content: [{ type: 'text', text: summary }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to retrieve task ${task_id}: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
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
          members: Array<{
            user: { name: string; email: string };
            role: string;
          }>;
          _count: { tasks: number };
        };
      }>(`/projects/${encodeURIComponent(project_id)}`);

      if (!response.success) {
        return {
          content: [{ type: 'text', text: `Project not found: ${project_id}` }],
          isError: true,
        };
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
        content: [
          {
            type: 'text',
            text: `Failed to retrieve project ${project_id}: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
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
        return {
          content: [{ type: 'text', text: `Task ${task_id} has no dependencies.` }],
        };
      }

      const lines = response.data
        .map((d) => `  - ${d.dependsOn.displayId}: ${d.dependsOn.title} [${d.dependsOn.status}]`)
        .join('\n');

      return {
        content: [{ type: 'text', text: `Dependencies for ${task_id}:\n${lines}` }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to retrieve dependencies for ${task_id}: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// ── Stub tools for Phase 2 ────────────────────────────────────────────────────
// These are registered so the MCP host can discover them, but they return a
// "coming in Phase 2" message. This makes the tool list visible to agents
// and signals the intended future capability.

const phase2Tools: Array<{ name: string; description: string }> = [
  { name: 'claim_task', description: 'Claim a task and assign it to yourself.' },
  { name: 'start_task', description: 'Mark a task as IN_PROGRESS and start an agent session.' },
  { name: 'get_team_activity', description: 'Get recent activity across the project.' },
  {
    name: 'get_active_file_reservations',
    description: 'Get all currently active file reservations for a project.',
  },
  {
    name: 'reserve_files',
    description: 'Reserve files you plan to modify so teammates are aware.',
  },
  { name: 'release_files', description: 'Release file reservations when done.' },
  { name: 'report_progress', description: 'Report progress on a task.' },
  { name: 'request_review', description: 'Request a human review of completed work.' },
  { name: 'complete_task', description: 'Mark a task as completed.' },
];

for (const { name, description } of phase2Tools) {
  server.registerTool(
    name,
    {
      description: `${description}\n\n⚠️ This tool is not yet implemented. It will be available in Phase 2.`,
      inputSchema: z.object({
        task_id: z.string().optional().describe('The task ID'),
      }),
    },
    async () => ({
      content: [
        {
          type: 'text',
          text: `The tool "${name}" is planned for Phase 2. It is not yet available.`,
        },
      ],
      isError: false,
    }),
  );
}

// ── Start ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Use stderr — stdout is the MCP protocol channel
  console.error('Arxion MCP Server running on stdio');
  console.error(`Backend API: ${API_BASE_URL}`);
}

main().catch((error: unknown) => {
  console.error('Fatal MCP server error:', error);
  process.exit(1);
});
