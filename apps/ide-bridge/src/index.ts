import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { realpathSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const port = Number(process.env['ARXION_BRIDGE_PORT'] ?? 3210);
const apiUrl = (process.env['ARXION_API_URL'] ?? 'http://127.0.0.1:3001').replace(/\/$/, '');
const apiKey = process.env['ARXION_INTERNAL_API_KEY'] ?? process.env['MCP_API_KEY'] ?? '';
const webOrigin = process.env['ARXION_WEB_ORIGIN'] ?? 'http://localhost:3000';
const defaultWorkspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const workspaceRoot = realpathSync(
  resolve(process.env['ARXION_WORKSPACE_ROOT'] ?? defaultWorkspaceRoot),
);
const codexCommand = process.env['CODEX_COMMAND'] ?? 'codex';

type LaunchStatus = 'STARTING' | 'RUNNING' | 'FINISHED' | 'FAILED' | 'STOPPED';

interface LaunchRequest {
  id: string;
  projectId: string;
  taskId: string;
  userId: string;
  agentType: string;
  status: string;
  agentSessionId: string | null;
  task?: { id: string; displayId: string; title: string };
}

interface Preflight {
  sessionId: string;
  coordinationStatus: string;
  task: { id: string; displayId: string; title: string; description?: string };
  dependencies?: unknown[];
  fileConflicts?: unknown[];
  contractRisks?: unknown[];
}

interface StartResult {
  launchRequest: LaunchRequest;
  preflight: Preflight | null;
  alreadyStarted: boolean;
}

interface RunningLaunch {
  launchRequestId: string;
  sessionId: string;
  taskId: string;
  status: LaunchStatus;
  startedAt: string;
  endedAt: string | null;
  exitCode: number | null;
  output: string[];
  process: ChildProcessWithoutNullStreams;
  heartbeat: NodeJS.Timeout;
}

const launches = new Map<string, RunningLaunch>();

function commandAvailable(command: string): boolean {
  const result = spawnSync(command, ['--version'], { encoding: 'utf8', windowsHide: true });
  return result.status === 0;
}

const codexAvailable = commandAvailable(codexCommand);

function setCors(req: IncomingMessage, res: ServerResponse): boolean {
  const origin = req.headers.origin;
  const isAllowed =
    !origin ||
    webOrigin === '*' ||
    origin === webOrigin ||
    origin.endsWith('.onrender.com') ||
    origin.endsWith('.vercel.app') ||
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:');

  if (!isAllowed) {
    json(res, 403, { error: `Origin not allowed: ${origin}` });
    return false;
  }
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  return true;
}

function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(value));
}

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 64 * 1024) throw new Error('Request body is too large');
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Expected a JSON object');
  }
  return parsed as Record<string, unknown>;
}

async function arxionFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'x-internal-api-key': apiKey } : {}),
      ...init?.headers,
    },
  });
  const payload = (await response.json()) as { success?: boolean; data?: T; error?: { message?: string } };
  if (!response.ok || payload.success === false) {
    throw new Error(payload.error?.message ?? `Arxion API returned ${response.status}`);
  }
  return payload.data as T;
}

function resolveWorkspace(requested?: string): string {
  const candidate = realpathSync(resolve(requested ?? workspaceRoot));
  const rootPrefix = workspaceRoot.endsWith(sep) ? workspaceRoot : `${workspaceRoot}${sep}`;
  if (candidate !== workspaceRoot && !candidate.startsWith(rootPrefix)) {
    throw new Error('workspacePath must be inside ARXION_WORKSPACE_ROOT');
  }
  return candidate;
}

function appendOutput(launch: RunningLaunch, chunk: Buffer): void {
  const lines = chunk.toString('utf8').split(/\r?\n/).filter(Boolean);
  launch.output.push(...lines);
  if (launch.output.length > 200) launch.output.splice(0, launch.output.length - 200);
}

async function heartbeat(sessionId: string): Promise<void> {
  await arxionFetch(`/agent-sessions/${encodeURIComponent(sessionId)}/heartbeat`, {
    method: 'POST',
    body: '{}',
  });
}

async function safelyEndSession(sessionId: string): Promise<void> {
  try {
    const session = await arxionFetch<{ status: string }>(
      `/agent-sessions/${encodeURIComponent(sessionId)}`,
    );
    if (!['FINISHED', 'STALE'].includes(session.status)) {
      await arxionFetch(`/agent-sessions/${encodeURIComponent(sessionId)}/end`, {
        method: 'POST',
        body: '{}',
      });
    }
  } catch (error) {
    console.error(`Unable to end Arxion session ${sessionId}:`, error);
  }
}

function publicLaunch(launch: RunningLaunch) {
  return {
    launchRequestId: launch.launchRequestId,
    sessionId: launch.sessionId,
    taskId: launch.taskId,
    pid: launch.process.pid,
    status: launch.status,
    startedAt: launch.startedAt,
    endedAt: launch.endedAt,
    exitCode: launch.exitCode,
    output: launch.output,
  };
}

async function launchCodex(launchRequestId: string, requestedWorkspace?: string) {
  if (!codexAvailable) throw new Error(`Codex command is unavailable: ${codexCommand}`);
  if (launches.has(launchRequestId)) return publicLaunch(launches.get(launchRequestId)!);

  const workspace = resolveWorkspace(requestedWorkspace);
  const started = await arxionFetch<StartResult>(
    `/launch-requests/${encodeURIComponent(launchRequestId)}/start`,
    {
      method: 'POST',
      body: JSON.stringify({ externalAgentId: `ide-bridge:${process.pid}` }),
    },
  );
  const request = started.launchRequest;
  const sessionId = request.agentSessionId ?? started.preflight?.sessionId;
  if (!sessionId) throw new Error('Arxion did not bind an agent session to the launch request');

  const displayId = request.task?.displayId ?? request.taskId;
  const title = request.task?.title ?? started.preflight?.task.title ?? 'Arxion task';
  const prompt = [
    `Work on Arxion task ${displayId}: ${title}.`,
    `The IDE bridge already accepted launch request ${request.id} and began agent session ${sessionId}.`,
    'Do not accept the launch request or call begin_task again.',
    `Use task_id="${request.taskId}", user_id="${request.userId}", and agent_type="CODEX" for Arxion MCP calls.`,
    'Retrieve the latest task and context, declare work intent, reserve files before editing, report meaningful progress, run relevant verification, then release files and end the task session.',
    `Coordination status: ${started.preflight?.coordinationStatus ?? 'already started'}.`,
  ].join(' ');

  const child = spawn(
    codexCommand,
    ['exec', '--json', '--cd', workspace, '--sandbox', 'workspace-write', '--approve-for-me', prompt],
    {
      cwd: workspace,
      windowsHide: true,
      env: {
        ...process.env,
        ARXION_LAUNCH_REQUEST_ID: request.id,
        ARXION_PROJECT_ID: request.projectId,
        ARXION_TASK_ID: request.taskId,
        ARXION_USER_ID: request.userId,
        ARXION_SESSION_ID: sessionId,
        ARXION_API_URL: apiUrl,
      },
    },
  );

  const launch: RunningLaunch = {
    launchRequestId,
    sessionId,
    taskId: request.taskId,
    status: 'STARTING',
    startedAt: new Date().toISOString(),
    endedAt: null,
    exitCode: null,
    output: [],
    process: child,
    heartbeat: setInterval(() => {
      void heartbeat(sessionId).catch((error: unknown) => {
        console.error(`Heartbeat failed for ${sessionId}:`, error);
      });
    }, 25_000),
  };
  launch.heartbeat.unref();
  launches.set(launchRequestId, launch);

  child.once('spawn', () => {
    launch.status = 'RUNNING';
  });
  child.stdout.on('data', (chunk: Buffer) => appendOutput(launch, chunk));
  child.stderr.on('data', (chunk: Buffer) => appendOutput(launch, chunk));
  child.once('error', (error) => {
    launch.status = 'FAILED';
    launch.output.push(error.message);
  });
  child.once('close', (code) => {
    clearInterval(launch.heartbeat);
    launch.exitCode = code;
    launch.endedAt = new Date().toISOString();
    launch.status = launch.status === 'STOPPED' ? 'STOPPED' : code === 0 ? 'FINISHED' : 'FAILED';
    void safelyEndSession(sessionId);
  });

  return publicLaunch(launch);
}

const server = createServer(async (req, res) => {
  try {
    if (!setCors(req, res)) return;
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`);
    if (req.method === 'GET' && url.pathname === '/health') {
      json(res, 200, { ok: true, workspaceRoot });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/capabilities') {
      json(res, 200, {
        ok: true,
        agents: {
          CODEX: {
            available: codexAvailable,
            directLaunch: codexAvailable,
            lifecycle: true,
            mode: 'codex-exec',
          },
          IBM_BOB: { available: false, directLaunch: false, lifecycle: false, mode: 'handoff' },
          CURSOR: { available: false, directLaunch: false, lifecycle: false, mode: 'handoff' },
          CLAUDE_CODE: { available: false, directLaunch: false, lifecycle: false, mode: 'handoff' },
        },
      });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/launch') {
      const body = await readBody(req);
      if (typeof body['launchRequestId'] !== 'string') {
        throw new Error('launchRequestId is required');
      }
      const result = await launchCodex(
        body['launchRequestId'],
        typeof body['workspacePath'] === 'string' ? body['workspacePath'] : undefined,
      );
      json(res, 202, result);
      return;
    }

    const launchMatch = url.pathname.match(/^\/launches\/([^/]+)$/);
    if (req.method === 'GET' && launchMatch?.[1]) {
      const launch = launches.get(decodeURIComponent(launchMatch[1]));
      if (!launch) {
        json(res, 404, { error: 'Launch not found' });
        return;
      }
      json(res, 200, publicLaunch(launch));
      return;
    }

    const stopMatch = url.pathname.match(/^\/launches\/([^/]+)\/stop$/);
    if (req.method === 'POST' && stopMatch?.[1]) {
      const launch = launches.get(decodeURIComponent(stopMatch[1]));
      if (!launch) {
        json(res, 404, { error: 'Launch not found' });
        return;
      }
      launch.status = 'STOPPED';
      launch.process.kill();
      json(res, 202, publicLaunch(launch));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/events/session-end') {
      const body = await readBody(req);
      if (typeof body['sessionId'] === 'string') await safelyEndSession(body['sessionId']);
      json(res, 200, { ok: true });
      return;
    }

    json(res, 404, { error: 'Not found' });
  } catch (error) {
    json(res, 400, { error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.info(`Arxion IDE bridge listening at http://127.0.0.1:${port}`);
  console.info(`Workspace root: ${workspaceRoot}`);
  console.info(`Codex direct launch: ${codexAvailable ? 'available' : 'unavailable'}`);
});
