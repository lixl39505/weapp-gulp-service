import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'

import pc from 'picocolors'
import type { Compiler as DelticCompiler } from 'deltic'

import { buildNpm as wxBuildNpm } from '../wx-tool/index.js'
import { checkNpmPkg, makeCmd, npmInstallNoSave } from './cmd.js'
import { npmDepsHash } from './manifest.js'
import type { WeappOptions } from '../types.js'

const batchUpdate = makeCmd('npm update')

export const NPM_DEPS_KEY = 'npmDeps'

/**
 * Runs the mini-program npm build when the dependency manifest changed since
 * the last run (1.0's pkg task + content-hash gate, reworked as orchestration
 * on top of the deltic compiler). Failures are tolerated with a warning —
 * 1.0 parity for the auto-build path.
 */
export async function maybeBuildNpm(
    engine: DelticCompiler,
    options: WeappOptions,
    npmList: Array<{ path: string; output: string }>
): Promise<void> {
    if (options.buildNpm === false || options.args.buildNpm === false) {
        return
    }

    await engine.schedule(async () => {
        const hash = npmDepsHash(options, npmList)

        if (engine.query<string | null>(NPM_DEPS_KEY, null) === hash) {
            return
        }

        await buildNpmAll(engine, options, npmList)
        engine.save(NPM_DEPS_KEY, hash)
    })
}

async function buildNpmAll(
    engine: DelticCompiler,
    options: WeappOptions,
    npmList: Array<{ path: string; output: string }>
): Promise<void> {
    const project =
        options.config !== '' ? path.dirname(options.config) : process.cwd()

    for (const entry of npmList) {
        const packageDir = path.dirname(entry.path)

        if (!existsSync(entry.path)) {
            continue
        }

        if (existsSync(path.join(packageDir, 'node_modules'))) {
            const { isPkgMissing, pkgToUpdate, pkgMissing } = checkNpmPkg(
                entry.path,
                project
            )

            if (isPkgMissing) {
                console.log('pkgMissing: ', pkgMissing)
                npmInstallNoSave({ exec: { cwd: packageDir } })
            }

            if (pkgToUpdate.length > 0) {
                console.log('pkgToUpdate: ', pkgToUpdate)
                batchUpdate({ exec: { cwd: packageDir } })
            }
        } else {
            npmInstallNoSave({ exec: { cwd: packageDir } })
        }
    }

    // the miniprogram_npm output directories must exist before buildNpm
    for (const entry of npmList) {
        if (!existsSync(entry.output)) {
            mkdirSync(entry.output, { recursive: true })
        }
    }

    try {
        await wxBuildNpm({ project, env: options.env })
    } catch (error) {
        engine.logger.warn(
            pc.yellow(error instanceof Error ? error.message : String(error))
        )
    }
}
