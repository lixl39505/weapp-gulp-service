import path from 'node:path'

import pc from 'picocolors'
import { loadEnvFiles, objectMerge } from 'deltic'

import { createDefaults } from './defaults.js'
import { loadWeappConfig } from './load-config.js'
import type {
    WeappConfigContext,
    WeappOptions,
    WeappUserConfig,
} from '../types.js'

export interface WeappArgs {
    config?: string
    mode?: string
    [key: string]: unknown
}

function normalizeIgnore(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value as string[]
    }

    return typeof value === 'string' ? [value] : []
}

/**
 * Async resolution of the compile options — 1.0 flow ported onto deltic:
 * `.env` chain ⊕ user config ⊕ CLI args ⊕ defaults merge, then the optional
 * `callback(options, {Compiler})` (sync mutation, sync replacement or a
 * thenable). Unlike 1.0, env values are NOT assigned onto `process.env`; they
 * travel through the resolved options into the `env` pipe and wx-tool.
 */
export async function resolveWeappOptions(
    args: WeappArgs = {},
    context: WeappConfigContext = {}
): Promise<WeappOptions> {
    const configFile =
        args.config !== undefined ? path.resolve(args.config) : undefined
    const baseDir =
        configFile !== undefined ? path.dirname(configFile) : process.cwd()
    const mode =
        typeof args.mode === 'string' && args.mode !== ''
            ? args.mode
            : 'development'

    // .env → .env.local → .env.[mode] → .env.[mode].local
    const fileEnv = loadEnvFiles(baseDir, mode)

    const loaded = loadWeappConfig(baseDir, configFile)
    const user: WeappUserConfig = loaded?.config ?? {}

    const merged = objectMerge(createDefaults(), {
        ...(user as Record<string, unknown>),
        env: { ...fileEnv, ...(user.env ?? {}) },
        mode,
    }) as WeappOptions

    merged.config = configFile ?? loaded?.file ?? ''
    merged.args = { ...args }
    merged.ignore = normalizeIgnore(merged.ignore)

    // env values may be numbers/booleans in the config file — stringified like
    // 1.0's process.env round-trip did; the mode marker rides along (1.0 parity)
    for (const [key, value] of Object.entries(merged.env)) {
        merged.env[key] = String(value)
    }

    merged.env.mode = mode

    console.log(pc.white('current env:'))
    console.log(pc.white(JSON.stringify(merged.env, null, 4)))

    const replaced = await merged.callback?.(merged, context)

    return replaced ?? merged
}
