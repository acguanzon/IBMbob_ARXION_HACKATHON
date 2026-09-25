import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'

const __dir = dirname(fileURLToPath(import.meta.url))

// Resolve .js extension imports → .ts for NodeNext-style TypeScript sources.
// Only applies to project source files (not node_modules internals).
function nodeNextResolver(): Plugin {
  return {
    name: 'nodenext-js-to-ts',
    enforce: 'pre',
    resolveId(id, importer) {
      if (!id.endsWith('.js') || !importer) return null
      // Skip if importer is inside node_modules
      if (importer.includes('node_modules')) return null
      // Only handle relative imports
      if (!id.startsWith('.')) return null
      const tsPath = resolve(dirname(importer), id.slice(0, -3) + '.ts')
      return tsPath
    },
  }
}

export default defineConfig({
  plugins: [nodeNextResolver()],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    alias: {
      '@arxion/database': resolve(__dir, '../../packages/database/src/index.ts'),
      '@arxion/types': resolve(__dir, '../../packages/types/src/index.ts'),
      '@arxion/config': resolve(__dir, '../../packages/config/src/index.ts'),
    },
    deps: {
      interopDefault: true,
    },
  },
})
