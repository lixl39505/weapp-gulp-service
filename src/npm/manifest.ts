import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import type { WeappOptions } from '../types.js'
import type { NpmListEntry } from './resolve.js'

interface DirStat {
    birthtime: number
    ctime: number
    mtime: number
}

// Missing directories get zero stamps — deterministic, so the manifest hash
// stays stable across runs until the directory actually appears.
const MISSING_STAT: DirStat = { birthtime: 0, ctime: 0, mtime: 0 }

const dirStat = (dir: string): DirStat => {
    if (!existsSync(dir)) {
        return MISSING_STAT
    }

    const stat = statSync(dir)

    return {
        birthtime: stat.birthtime.getTime(),
        ctime: stat.ctime.getTime(),
        mtime: stat.mtime.getTime(),
    }
}

export interface NpmDepsManifest {
    privateKeyPath: string
    cliPath: string
    entries: Array<{
        dependencies: Record<string, string>
        peerDependencies: Record<string, string>
        nodeModules: DirStat
        miniNpm: DirStat
    }>
}

// Aggregates everything that should trigger an npm rebuild: package.json
// dependency declarations, node_modules/miniprogram_npm dir stamps, and the
// wx-tool env keys (1.0's gulp-npm-dep, computed without a stream).
export function npmDepsManifest(
    options: WeappOptions,
    npmList: NpmListEntry[]
): NpmDepsManifest {
    const env = (key: string): string =>
        options.env[key] ?? process.env[key] ?? ''

    return {
        privateKeyPath: env('WE_APP_PRIVATE_KEY_PATH'),
        cliPath: env('WE_CLI'),
        entries: npmList.map((entry) => {
            let dependencies: Record<string, string> = {}
            let peerDependencies: Record<string, string> = {}

            if (existsSync(entry.path)) {
                try {
                    const pkg = JSON.parse(
                        readFileSync(entry.path, 'utf8')
                    ) as {
                        dependencies?: Record<string, string>
                        peerDependencies?: Record<string, string>
                    }

                    dependencies = pkg.dependencies ?? {}
                    peerDependencies = pkg.peerDependencies ?? {}
                } catch {
                    // unreadable package.json — treat as empty; the npm build will
                    // surface the error with a readable message
                }
            }

            return {
                dependencies,
                peerDependencies,
                nodeModules: dirStat(
                    path.resolve(entry.path, '../node_modules')
                ),
                miniNpm: dirStat(path.resolve(entry.output, 'miniprogram_npm')),
            }
        }),
    }
}

export function npmDepsHash(
    options: WeappOptions,
    npmList: NpmListEntry[]
): string {
    return createHash('sha1')
        .update(JSON.stringify(npmDepsManifest(options, npmList)))
        .digest('hex')
}
