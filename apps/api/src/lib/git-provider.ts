/**
 * Git Provider Abstraction — Phase 4
 *
 * All provider-specific logic lives here.
 * The rest of the backend works through this interface only.
 *
 * GitHubProvider is the first implementation.
 * Future: GitLabProvider, BitbucketProvider.
 */

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface GitFile {
  filename: string
  status: 'added' | 'modified' | 'removed' | 'renamed'
  additions: number
  deletions: number
  previousFilename?: string
}

export interface GitCommit {
  sha: string
  message: string
  author: string
  timestamp: string
  files: GitFile[]
}

export interface GitBranch {
  name: string
  sha: string
}

export interface GitPullRequest {
  number: number
  title: string
  url: string
  state: 'open' | 'closed' | 'merged'
  headBranch: string
  baseBranch: string
  mergeCommitSha: string | null
}

export interface GitBranchComparison {
  aheadBy: number
  behindBy: number
  mergeBase: string | null
  files: GitFile[]
}

export interface GitRepository {
  id: string
  name: string
  owner: string
  defaultBranch: string
  url: string
}

// ─── Provider Interface ───────────────────────────────────────────────────────

export interface IGitProvider {
  getRepository(owner: string, repo: string): Promise<GitRepository>
  getDefaultBranch(owner: string, repo: string): Promise<string>
  getBranch(owner: string, repo: string, branch: string): Promise<GitBranch>
  getCommit(owner: string, repo: string, sha: string): Promise<GitCommit>
  getCommitDiff(owner: string, repo: string, sha: string): Promise<GitFile[]>
  getChangedFiles(owner: string, repo: string, base: string, head: string): Promise<GitFile[]>
  getPullRequest(owner: string, repo: string, prNumber: number): Promise<GitPullRequest>
  getPullRequestFiles(owner: string, repo: string, prNumber: number): Promise<GitFile[]>
  getMergeStatus(owner: string, repo: string, prNumber: number): Promise<'open' | 'closed' | 'merged'>
  getBranchComparison(owner: string, repo: string, base: string, head: string): Promise<GitBranchComparison>
  getFileContent(owner: string, repo: string, path: string, revision: string): Promise<string>
}

// ─── GitHub Provider ──────────────────────────────────────────────────────────

export class GitHubProvider implements IGitProvider {
  private readonly token: string
  private readonly baseUrl = 'https://api.github.com'

  constructor(token: string) {
    this.token = token
  }

  private async request<T>(path: string): Promise<T> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'arxion-platform/4.0',
    }
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`

    const res = await fetch(`${this.baseUrl}${path}`, {
      headers,
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`GitHub API ${res.status} for ${path}: ${body}`)
    }
    return res.json() as Promise<T>
  }

  async getRepository(owner: string, repo: string): Promise<GitRepository> {
    const data = await this.request<{
      id: number
      name: string
      owner: { login: string }
      default_branch: string
      html_url: string
    }>(`/repos/${owner}/${repo}`)
    return {
      id: String(data.id),
      name: data.name,
      owner: data.owner.login,
      defaultBranch: data.default_branch,
      url: data.html_url,
    }
  }

  async getDefaultBranch(owner: string, repo: string): Promise<string> {
    const data = await this.request<{ default_branch: string }>(`/repos/${owner}/${repo}`)
    return data.default_branch
  }

  async getBranch(owner: string, repo: string, branch: string): Promise<GitBranch> {
    const data = await this.request<{
      name: string
      commit: { sha: string }
    }>(`/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`)
    return { name: data.name, sha: data.commit.sha }
  }

  async getCommit(owner: string, repo: string, sha: string): Promise<GitCommit> {
    const data = await this.request<{
      sha: string
      commit: { message: string; author: { name: string; date: string } }
      files?: Array<{
        filename: string
        status: string
        additions: number
        deletions: number
        previous_filename?: string
      }>
    }>(`/repos/${owner}/${repo}/commits/${sha}`)

    return {
      sha: data.sha,
      message: data.commit.message,
      author: data.commit.author.name,
      timestamp: data.commit.author.date,
      files: (data.files ?? []).map(this.normalizeFile),
    }
  }

  async getCommitDiff(owner: string, repo: string, sha: string): Promise<GitFile[]> {
    const commit = await this.getCommit(owner, repo, sha)
    return commit.files
  }

  async getChangedFiles(owner: string, repo: string, base: string, head: string): Promise<GitFile[]> {
    const data = await this.request<{
      files: Array<{
        filename: string
        status: string
        additions: number
        deletions: number
        previous_filename?: string
      }>
    }>(`/repos/${owner}/${repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`)
    return (data.files ?? []).map(this.normalizeFile)
  }

  async getPullRequest(owner: string, repo: string, prNumber: number): Promise<GitPullRequest> {
    const data = await this.request<{
      number: number
      title: string
      html_url: string
      state: string
      merged: boolean
      head: { ref: string }
      base: { ref: string }
      merge_commit_sha: string | null
    }>(`/repos/${owner}/${repo}/pulls/${prNumber}`)

    return {
      number: data.number,
      title: data.title,
      url: data.html_url,
      state: data.merged ? 'merged' : (data.state as 'open' | 'closed'),
      headBranch: data.head.ref,
      baseBranch: data.base.ref,
      mergeCommitSha: data.merge_commit_sha,
    }
  }

  async getPullRequestFiles(owner: string, repo: string, prNumber: number): Promise<GitFile[]> {
    const data = await this.request<
      Array<{
        filename: string
        status: string
        additions: number
        deletions: number
        previous_filename?: string
      }>
    >(`/repos/${owner}/${repo}/pulls/${prNumber}/files`)
    return data.map(this.normalizeFile)
  }

  async getMergeStatus(owner: string, repo: string, prNumber: number): Promise<'open' | 'closed' | 'merged'> {
    const pr = await this.getPullRequest(owner, repo, prNumber)
    return pr.state
  }

  async getBranchComparison(owner: string, repo: string, base: string, head: string): Promise<GitBranchComparison> {
    const data = await this.request<{
      ahead_by: number
      behind_by: number
      merge_base_commit: { sha: string } | null
      files?: Array<{
        filename: string
        status: string
        additions: number
        deletions: number
        previous_filename?: string
      }>
    }>(`/repos/${owner}/${repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`)

    return {
      aheadBy: data.ahead_by,
      behindBy: data.behind_by,
      mergeBase: data.merge_base_commit?.sha ?? null,
      files: (data.files ?? []).map(this.normalizeFile),
    }
  }

  async getFileContent(owner: string, repo: string, path: string, revision: string): Promise<string> {
    const data = await this.request<{ content: string; encoding: string }>(
      `/repos/${owner}/${repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(revision)}`,
    )
    if (data.encoding !== 'base64') throw new Error(`Unsupported GitHub content encoding: ${data.encoding}`)
    return Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf8')
  }

  private normalizeFile(f: {
    filename: string
    status: string
    additions: number
    deletions: number
    previous_filename?: string
  }): GitFile {
    return {
      filename: f.filename,
      status: f.status as GitFile['status'],
      additions: f.additions,
      deletions: f.deletions,
      previousFilename: f.previous_filename,
    }
  }
}

// ─── Provider factory ─────────────────────────────────────────────────────────

export function createGitHubProvider(token?: string): GitHubProvider {
  const t = token ?? process.env['GITHUB_TOKEN'] ?? ''
  if (!t) {
    // Allow construction without a token for webhook-only scenarios.
    // Operations that need the API will fail at call time.
  }
  return new GitHubProvider(t)
}

export function parseGitHubRepositoryUrl(repositoryUrl: string): { owner: string; repository: string } {
  let url: URL
  try {
    url = new URL(repositoryUrl)
  } catch {
    throw Object.assign(new Error('Enter a valid GitHub repository URL.'), { statusCode: 400 })
  }

  const parts = url.pathname.replace(/^\/+|\/+$/g, '').split('/')
  const owner = parts[0]
  const repository = parts[1]?.replace(/\.git$/i, '')
  if (url.hostname.toLowerCase() !== 'github.com' || !owner || !repository || parts.length !== 2) {
    throw Object.assign(
      new Error('GitHub repository URL must look like https://github.com/owner/repository.'),
      { statusCode: 400 },
    )
  }

  return { owner, repository }
}
