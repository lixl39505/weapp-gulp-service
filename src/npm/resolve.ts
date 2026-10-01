import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import type { WeappOptions } from '../types.js'

export interface NpmListEntry {
    /** Absolute path to the package.json driving this entry. */
    path: string
    /** Absolute output directory for miniprogram_npm. */
    output: string
}

interface ProjectConfig {
    setting?: {
        packNpmManually?: boolean
        packNpmRelationList?: Array<{
            packageJsonPath: string
            miniprogramNpmDistDir: string
        }>
    }
}

/**
 * Resolves the npm build entries from `project.config.json`
 * (`setting.packNpmManually` + `packNpmRelationList`), falling back to the
 * output directory's package.json — 1.0 parity with the missing-`setting`
 * guard fixed.
 */
export function resolveNpmList(options: WeappOptions): NpmListEntry[] {
    const projectPath =
        options.config !== '' ? path.dirname(options.config) : process.cwd()
    const projConfigPath = path.join(projectPath, 'project.config.json')

    if (existsSync(projConfigPath)) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const projConfig = JSON.parse(
            readFileSync(projConfigPath, 'utf8')
        ) as ProjectConfig

        if (
            projConfig.setting?.packNpmManually === true &&
            Array.isArray(projConfig.setting.packNpmRelationList)
        ) {
            return projConfig.setting.packNpmRelationList.map((relation) => ({
                path: path.resolve(projectPath, relation.packageJsonPath),
                output: path.resolve(
                    projectPath,
                    relation.miniprogramNpmDistDir
                ),
            }))
        }
    }

    return [
        {
            path: path.resolve(projectPath, options.output, 'package.json'),
            output: path.resolve(projectPath, options.output),
        },
    ]
}
