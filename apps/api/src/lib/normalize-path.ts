/**
 * Normalizes a file path for consistent conflict detection.
 * Strips leading ./ or /, converts backslashes to forward slashes, lowercases.
 */
export function normalizePath(filePath: string): string {
  return filePath
    .trim()
    .replace(/\\/g, '/')          // backslash → forward slash
    .replace(/^\.\//, '')         // strip leading ./
    .replace(/^\//, '')           // strip leading /
    .toLowerCase();
}

export function normalizePaths(filePaths: string[]): string[] {
  return filePaths.map(normalizePath);
}
