import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createJiti } from 'jiti'

import type { WeappUserConfig } from '../types.js'

export interface LoadedConfig {
    config: WeappUserConfig
    file: string
}

const require = createRequire(import.meta.url)

const CONFIG_NAMES = [
    'weapp.config.ts',
    'weapp.config.mts',
    'weapp.config.js',
    'weapp.config.mjs',
]

function hasDefaultExport(
    value: unknown
): value is { default: WeappUserConfig } {
    return (
        typeof value === 'object' &&
        value !== null &&
        'default' in value &&
        typeof (value as { default: unknown }).default === 'object'
    )
}

// Self-entry for `import ... from 'weapp-gulp-service'` inside user configs.
function selfEntry(): string {
    const here = fileURLToPath(import.meta.url)

    return here
        .replace(/config[/\\]load-config\.js$/, 'index.js')
        .replace(/config[/\\]load-config\.ts$/, 'index.ts')
}

/**
 * Loads the weapp config (.ts/.mts/.js/.mjs) via jiti — either the explicitly
 * named file or the first standard name found in `baseDir`. Returns undefined
 * when no config exists (1.0 leniency: zero-config projects still build).
 */
export function loadWeappConfig(
    baseDir?: string,
    explicitFile?: string
): LoadedConfig | undefined {
    const root = path.resolve(baseDir ?? process.cwd())
    const jiti = createJiti(import.meta.url, {
        alias: { 'weapp-gulp-service': selfEntry() },
        // config edits between rapid successive builds must be visible — jiti's
        // mtime-granular caches would serve a stale module otherwise
        fsCache: false,
        moduleCache: false,
    })

    const names = explicitFile === undefined ? CONFIG_NAMES : [explicitFile]

    for (const name of names) {
        const file = path.resolve(root, name)

        let resolved: string

        try {
            resolved = require.resolve(file)
        } catch {
            continue
        }

        // jiti delegates .js/.mjs evaluation to the native require — Node's
        // module cache is keyed by path and never checks mtime, so rapid
        // successive builds would see a stale config without this purge.
        delete (require.cache as Record<string, unknown>)[resolved]

        const loaded: unknown = jiti(file)

        const config = hasDefaultExport(loaded)
            ? (loaded.default as WeappUserConfig)
            : (loaded as WeappUserConfig)

        if (
            config === null ||
            typeof config !== 'object' ||
            Array.isArray(config)
        ) {
            throw new TypeError(
                `config file ${file} must export a config object`
            )
        }

        return { config, file }
    }

    return undefined
}
