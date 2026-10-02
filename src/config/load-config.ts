import { fileURLToPath } from 'node:url'

import { createConfigLoader, type LoadedConfig } from 'deltic'

import type { WeappUserConfig } from '../types.js'

// Self-entry for `import ... from 'weapp-gulp-service'` inside user configs.
function selfEntry(): string {
    const here = fileURLToPath(import.meta.url)

    return here
        .replace(/config[/\\]load-config\.js$/, 'index.js')
        .replace(/config[/\\]load-config\.ts$/, 'index.ts')
}

const loader = createConfigLoader<WeappUserConfig>({
    names: [
        'weapp.config.ts',
        'weapp.config.mts',
        'weapp.config.js',
        'weapp.config.mjs',
    ],
    alias: { 'weapp-gulp-service': selfEntry() },
})

/**
 * Loads the weapp config (.ts/.mts/.js/.mjs) — thin wrapper over deltic's
 * `createConfigLoader` (name probing, jiti, default-export unwrap, fresh
 * module caches). Returns undefined when no config exists, so zero-config
 * projects still build (1.0 leniency).
 */
export function loadWeappConfig(
    baseDir?: string,
    explicitFile?: string
): LoadedConfig<WeappUserConfig> | undefined {
    return loader(baseDir, explicitFile)
}
