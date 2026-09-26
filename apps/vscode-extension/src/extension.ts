import * as vscode from 'vscode';

interface Task {
  id: string;
  projectId: string;
  displayId: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
}

interface LaunchRequest {
  id: string;
  projectId: string;
  taskId: string;
  userId: string;
  agentType: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: { message?: string };
}

class TaskItem extends vscode.TreeItem {
  constructor(readonly task: Task) {
    super(`${task.displayId}  ${task.title}`, vscode.TreeItemCollapsibleState.None);
    this.description = `${task.status.replaceAll('_', ' ')} · ${task.priority}`;
    this.tooltip = new vscode.MarkdownString(
      `**${task.displayId}: ${task.title}**\n\n${task.description ?? 'No description'}\n\nStatus: ${task.status}`,
    );
    this.contextValue = 'arxionTask';
    this.iconPath = new vscode.ThemeIcon(
      task.status === 'DONE' ? 'pass-filled' : task.status === 'IN_PROGRESS' ? 'sync~spin' : 'circle-outline',
    );
    this.command = {
      command: 'arxion.startTask',
      title: 'Start Arxion task',
      arguments: [this],
    };
  }
}

class TaskProvider implements vscode.TreeDataProvider<TaskItem> {
  private readonly changed = new vscode.EventEmitter<TaskItem | undefined>();
  readonly onDidChangeTreeData = this.changed.event;

  refresh(): void {
    this.changed.fire(undefined);
  }

  getTreeItem(item: TaskItem): vscode.TreeItem {
    return item;
  }

  async getChildren(): Promise<TaskItem[]> {
    const config = vscode.workspace.getConfiguration('arxion');
    const projectId = config.get<string>('projectId', '');
    if (!projectId) return [];
    try {
      const tasks = await apiRequest<Task[]>(`/projects/${encodeURIComponent(projectId)}/tasks`);
      return tasks.map((task) => new TaskItem(task));
    } catch (error) {
      void vscode.window.showErrorMessage(`Arxion could not load tasks: ${messageOf(error)}`);
      return [];
    }
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const config = vscode.workspace.getConfiguration('arxion');
  const baseUrl = config.get<string>('apiUrl', 'http://localhost:3001').replace(/\/$/, '');
  const token = await currentContext.secrets.get('arxion.token');
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || payload.success === false) {
    throw new Error(payload.error?.message ?? `Arxion API returned ${response.status}`);
  }
  return payload.data;
}

async function bridgeRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const bridgeUrl = vscode.workspace
    .getConfiguration('arxion')
    .get<string>('bridgeUrl', 'http://127.0.0.1:3210')
    .replace(/\/$/, '');
  const response = await fetch(`${bridgeUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json' },
  });
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? `IDE bridge returned ${response.status}`);
  return payload;
}

function copyInstruction(request: LaunchRequest, task: Task): string {
  return (
    `Work on Arxion task ${task.displayId} in project ${request.projectId}. ` +
    `Accept launch request ${request.id}, then call begin_task with task_id="${request.taskId}", ` +
    `user_id="${request.userId}", and agent_type="${request.agentType}". ` +
    'Retrieve and follow the current context package.'
  );
}

let currentContext: vscode.ExtensionContext;

async function configure(provider: TaskProvider): Promise<void> {
  const config = vscode.workspace.getConfiguration('arxion');
  const projectId = await vscode.window.showInputBox({
    title: 'Configure Arxion workspace',
    prompt: 'Project ID',
    value: config.get<string>('projectId', ''),
    ignoreFocusOut: true,
  });
  if (!projectId) return;
  const userId = await vscode.window.showInputBox({
    title: 'Configure Arxion workspace',
    prompt: 'Your Arxion user ID',
    value: config.get<string>('userId', ''),
    ignoreFocusOut: true,
  });
  if (!userId) return;
  const token = await vscode.window.showInputBox({
    title: 'Configure Arxion workspace',
    prompt: 'Login token (stored in VS Code SecretStorage)',
    password: true,
    ignoreFocusOut: true,
  });
  if (!token) return;

  await config.update('projectId', projectId, vscode.ConfigurationTarget.Workspace);
  await config.update('userId', userId, vscode.ConfigurationTarget.Workspace);
  await currentContext.secrets.store('arxion.token', token);
  provider.refresh();
  void vscode.window.showInformationMessage('Arxion workspace configured.');
}

async function startTask(item?: TaskItem): Promise<void> {
  if (!item) {
    void vscode.window.showWarningMessage('Choose a task from the Arxion task panel.');
    return;
  }
  const config = vscode.workspace.getConfiguration('arxion');
  const projectId = config.get<string>('projectId', '');
  const userId = config.get<string>('userId', '');
  if (!projectId || !userId || !(await currentContext.secrets.get('arxion.token'))) {
    void vscode.window.showWarningMessage('Configure this workspace with Arxion first.');
    return;
  }

  const selected = await vscode.window.showQuickPick(
    [
      { label: 'Codex', description: 'Launch directly through the local IDE bridge', value: 'CODEX' },
      { label: 'IBM Bob', description: 'Create a launch request and copy the handoff', value: 'IBM_BOB' },
      { label: 'Cursor', description: 'Create a launch request and copy the handoff', value: 'CURSOR' },
      { label: 'Claude Code', description: 'Create a launch request and copy the handoff', value: 'CLAUDE_CODE' },
    ],
    { title: `Start ${item.task.displayId} with an agent` },
  );
  if (!selected) return;

  try {
    const request = await apiRequest<LaunchRequest>(
      `/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(item.task.id)}/launch`,
      {
        method: 'POST',
        body: JSON.stringify({ agentType: selected.value, userId }),
      },
    );

    if (selected.value === 'CODEX') {
      const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      await bridgeRequest('/launch', {
        method: 'POST',
        body: JSON.stringify({ launchRequestId: request.id, workspacePath }),
      });
      void vscode.window.showInformationMessage(`${item.task.displayId} started in Codex.`);
      return;
    }

    await vscode.env.clipboard.writeText(copyInstruction(request, item.task));
    void vscode.window.showInformationMessage(
      `${selected.label} handoff copied. Paste it into the agent to begin.`,
    );
  } catch (error) {
    void vscode.window.showErrorMessage(`Unable to start task: ${messageOf(error)}`);
  }
}

export function activate(context: vscode.ExtensionContext): void {
  currentContext = context;
  const provider = new TaskProvider();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('arxion.tasks', provider),
    vscode.commands.registerCommand('arxion.refresh', () => provider.refresh()),
    vscode.commands.registerCommand('arxion.configure', () => configure(provider)),
    vscode.commands.registerCommand('arxion.startTask', (item?: TaskItem) => startTask(item)),
    vscode.commands.registerCommand('arxion.openDashboard', async () => {
      const config = vscode.workspace.getConfiguration('arxion');
      const base = config.get<string>('dashboardUrl', 'http://localhost:3000').replace(/\/$/, '');
      const projectId = config.get<string>('projectId', '');
      const url = projectId ? `${base}/dashboard/${encodeURIComponent(projectId)}` : `${base}/dashboard`;
      await vscode.env.openExternal(vscode.Uri.parse(url));
    }),
  );
}

export function deactivate(): void {
  // No persistent extension resources beyond disposables registered above.
}
