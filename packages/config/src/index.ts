/**
 * Shared configuration helpers for Arxion apps.
 * Each app validates its own env at startup using these helpers.
 */

export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export function getEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const isDev = (): boolean => process.env['NODE_ENV'] !== 'production';
export const isProd = (): boolean => process.env['NODE_ENV'] === 'production';
