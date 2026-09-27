import { describe, expect, it } from 'vitest';
import { parseGitHubRepositoryUrl } from './git-provider.js';

describe('parseGitHubRepositoryUrl', () => {
  it('parses a standard GitHub repository URL', () => {
    expect(parseGitHubRepositoryUrl('https://github.com/arxion/platform')).toEqual({
      owner: 'arxion',
      repository: 'platform',
    });
  });

  it('accepts a trailing .git suffix', () => {
    expect(parseGitHubRepositoryUrl('https://github.com/arxion/platform.git')).toEqual({
      owner: 'arxion',
      repository: 'platform',
    });
  });

  it('rejects non-GitHub and nested URLs', () => {
    expect(() => parseGitHubRepositoryUrl('https://gitlab.com/arxion/platform')).toThrow(
      'GitHub repository URL must look like',
    );
    expect(() => parseGitHubRepositoryUrl('https://github.com/arxion/platform/issues')).toThrow(
      'GitHub repository URL must look like',
    );
  });
});
