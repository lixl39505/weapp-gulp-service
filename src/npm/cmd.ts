import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

import pc from 'picocolors'
import semver from 'semver'

import { objectMerge } from 'deltic'

export interface CmdOptions {
    log?: boolean
    exec?: Record<string, unknown>
}

export interface CmdFn {
    (options?: CmdOptions): Buffer
    toString(): string
}

// Builds a runnable shell command — 1.0 `utils/cmd.js` makeCmd port. Caller
// defaults merge over the built-ins (log: true, stdio: 'inherit').
export function makeCmd(cmd: string, defaultOptions: CmdOptions = {}): CmdFn {
    const run = (options?: CmdOptions): Buffer => {
        const merged = objectMerge(
            objectMerge(
                { log: true, exec: { stdio: 'inherit' } },
                defaultOptions
            ),
            options ?? {}
        ) as Required<CmdOptions>
        const { log, exec: execOptions } = merged

        if (log) {
            console.log(pc.yellow(cmd))
        }

        return execSync(cmd, execOptions as never) as unknown as Buffer
    }

    const fn = run as CmdFn
    fn.toString = () => cmd

    return fn
}

export const npmInstall = makeCmd('npm install')
export const npmInstallNoSave = makeCmd('npm install --no-save')
export const npmLs = makeCmd('npm ls --depth 0 --json -s')

export interface NpmPkgStatus {
    isPkgMissing: boolean
    pkgToUpdate: string[]
    pkgMissing: string[]
}

interface LsEntry {
    version?: string
    missing?: boolean
}

// npm package status detection (port of 1.0's checkNpmPkg): compares
// `npm ls --json` output against package.json dependencies.
export function checkNpmPkg(packagePath: string, cwd?: string): NpmPkgStatus {
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8')) as {
        dependencies?: Record<string, string>
    }

    const execOptions: Record<string, unknown> = { stdio: 'pipe' }

    if (cwd !== undefined) {
        execOptions.cwd = cwd
    }

    let installInfo: string

    try {
        installInfo = npmLs({ exec: execOptions }).toString()
    } catch (error) {
        installInfo = (error as { stdout: Buffer }).stdout.toString()
    }

    const pkgList = JSON.parse(installInfo) as {
        dependencies?: Record<string, LsEntry>
        problems?: string[]
    }
    const pkgActual = pkgList.dependencies ?? {}
    const pkgExpect = packageJson.dependencies ?? {}
    const missingProblems = (pkgList.problems ?? []).filter((problem) =>
        problem.startsWith('missing:')
    )
    const pkgMissing: string[] = []
    const pkgToUpdate: string[] = []
    let isPkgMissing = missingProblems.length > 0

    for (const [name, targetRange] of Object.entries(pkgExpect)) {
        const actual = pkgActual[name]

        if (
            actual !== undefined &&
            actual.missing !== true &&
            !pkgMissing.some((entry) => entry.startsWith(`missing: ${name}`)) &&
            !missingProblems.some((problem) =>
                problem.startsWith(`missing: ${name}`)
            )
        ) {
            if (!semver.satisfies(actual.version ?? '', targetRange)) {
                pkgToUpdate.push(name)
            }
        } else {
            pkgMissing.push(`missing: ${name}`)
            isPkgMissing = true
        }
    }

    return { isPkgMissing, pkgToUpdate, pkgMissing }
}
