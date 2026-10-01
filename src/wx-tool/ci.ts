import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import requireg from 'requireg'

export interface WxCIOptions {
    appid?: string
    /** miniProgram/miniProgramPlugin/miniGame/miniGamePlugin */
    type?: string
    projectPath: string
    privateKeyPath?: string
    ignores?: string[]
}

interface ProjectConfig {
    appid?: string
    compileType?: string
    miniprogramRoot?: string
    setting?: {
        packNpmManually?: boolean
        packNpmRelationList?: Array<{
            packageJsonPath: string
            miniprogramNpmDistDir: string
        }>
        es6?: boolean
        enhance?: boolean
        minified?: boolean
        uglifyFileName?: boolean
        postcss?: boolean
    }
}

interface CiProject {
    // opaque miniprogram-ci Project instance
}

interface CiModule {
    Project: new (options: Record<string, unknown>) => CiProject
    packNpm(
        project: CiProject,
        options?: Record<string, unknown>
    ): Promise<unknown>
    packNpmManually(options: {
        packageJsonPath: string
        miniprogramNpmDistDir: string
    }): Promise<unknown>
    upload(config: Record<string, unknown>): Promise<unknown>
}

// WeChat mini-program CI integration (miniprogram-ci), resolved via `requireg`
// so globally installed copies work too. Port of 1.0 `wx-tool/ci.js` with the
// missing-`setting` guard fixed.
export class WxCI {
    type = 'ci' as const

    baseDir: string
    projectConfig: ProjectConfig
    miniprogramRoot: string
    packNpmManually: boolean | undefined
    packNpmRelationList: Array<{
        packageJsonPath: string
        miniprogramNpmDistDir: string
    }>
    project: CiProject

    #ci: CiModule

    constructor(options: Partial<WxCIOptions> = {}) {
        const {
            appid,
            type,
            projectPath,
            privateKeyPath,
            ignores = [],
        } = options

        if (!projectPath) {
            throw new Error('Project root must be specified')
        }

        this.#ci = requireg('miniprogram-ci') as CiModule

        this.baseDir = path.resolve(projectPath)

        const projConfigPath = path.resolve(
            this.baseDir,
            './project.config.json'
        )

        if (!existsSync(projConfigPath)) {
            throw new Error(
                `The project configuration file '${projConfigPath}' does not exist`
            )
        }

        if (!privateKeyPath) {
            throw new Error('Private key file path not provided')
        }

        const privateKeyFullPath = path.resolve(this.baseDir, privateKeyPath)

        if (!existsSync(privateKeyFullPath)) {
            throw new Error(
                `Private key file '${privateKeyFullPath}' does not exist`
            )
        }

        this.projectConfig = JSON.parse(
            readFileSync(projConfigPath, 'utf8')
        ) as ProjectConfig
        this.miniprogramRoot = path.resolve(
            this.baseDir,
            this.projectConfig.miniprogramRoot ?? ''
        )
        this.packNpmManually = this.projectConfig.setting?.packNpmManually
        this.packNpmRelationList =
            this.projectConfig.setting?.packNpmRelationList ?? []

        this.project = new this.#ci.Project({
            appid: appid ?? this.projectConfig.appid,
            type: type ?? this.projectConfig.compileType,
            projectPath: this.baseDir,
            privateKeyPath: privateKeyFullPath,
            ignores,
        })
    }

    async buildNpm(): Promise<unknown> {
        if (this.packNpmManually === true) {
            const results: unknown[] = []

            for (const relation of this.packNpmRelationList) {
                results.push(
                    await this.#ci.packNpmManually({
                        packageJsonPath: path.resolve(
                            this.baseDir,
                            relation.packageJsonPath
                        ),
                        miniprogramNpmDistDir: path.resolve(
                            this.baseDir,
                            relation.miniprogramNpmDistDir
                        ),
                    })
                )
            }

            console.log(results)

            return results
        }

        const res = await this.#ci.packNpm(this.project, {
            reporter: (infos: unknown) => {
                console.log(infos)
            },
        })

        console.log(res)

        return res
    }

    async upload(
        params: { version?: string; desc?: string; verbose?: boolean } = {}
    ): Promise<unknown> {
        const { version, desc = '', verbose = false } = params

        if (!version) {
            throw new Error(`未提供版本号`)
        }

        const setting = this.projectConfig.setting
        const uploadConfig: Record<string, unknown> = {
            project: this.project,
            version,
            desc,
            // devtools setting mapping
            setting: {
                es6: setting?.es6,
                es7: setting?.enhance,
                minify: setting?.minified,
                codeProtect: setting?.uglifyFileName,
                autoPrefixWXSS: setting?.postcss,
            },
        }

        if (verbose) {
            uploadConfig.onProgressUpdate = console.log
        }

        const res = await this.#ci.upload(uploadConfig)

        console.log(res)

        return res
    }
}
