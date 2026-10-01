import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    rmSync,
    writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { maybeBuildNpm, NPM_DEPS_KEY } from '../../../src/npm/build.js'
import { createDefaults } from '../../../src/config/defaults.js'
import type { WeappOptions } from '../../../src/types.js'

const checkNpmPkg = vi.fn()
const npmInstallNoSave = vi.fn()
const batchUpdate = vi.fn()

vi.mock('../../../src/npm/cmd.js', () => ({
    checkNpmPkg: (...args: unknown[]) => checkNpmPkg(...args),
    npmInstallNoSave: (...args: unknown[]) => npmInstallNoSave(...args),
    makeCmd:
        () =>
        (...args: unknown[]) =>
            batchUpdate(...args),
}))

const buildNpm = vi.fn()

vi.mock('../../../src/wx-tool/index.js', () => ({
    buildNpm: (...args: unknown[]) => buildNpm(...args),
}))

let root: string | undefined

function makeEngine() {
    const store = new Map<string, unknown>()

    return {
        query: (key: string, defaults: unknown) => store.get(key) ?? defaults,
        save: (key: string, value: unknown) => store.set(key, value),
        schedule: async <T>(fn: () => T | Promise<T>): Promise<T> => fn(),
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    }
}

function makeOptions(): WeappOptions {
    return {
        ...createDefaults(),
        config: path.join(root!, 'weapp.config.js'),
        env: {},
    }
}

function makeNpmEntry(withModules = false): { path: string; output: string } {
    const dist = path.join(root!, 'dist')

    mkdirSync(dist, { recursive: true })
    writeFileSync(
        path.join(dist, 'package.json'),
        JSON.stringify({ dependencies: { a: '^1.0.0' } })
    )

    if (withModules) {
        mkdirSync(path.join(dist, 'node_modules'), { recursive: true })
    }

    return { path: path.join(dist, 'package.json'), output: dist }
}

afterEach(() => {
    vi.clearAllMocks()

    if (root !== undefined) {
        rmSync(root, { recursive: true, force: true })
        root = undefined
    }
})

describe('maybeBuildNpm', () => {
    it('skips entirely when buildNpm is disabled', async () => {
        root = mkdtempSync(path.join(tmpdir(), 'wgs-build-'))
        makeNpmEntry()

        const engine = makeEngine()

        await maybeBuildNpm(
            engine as never,
            { ...makeOptions(), buildNpm: false },
            [makeNpmEntry()]
        )

        expect(buildNpm).not.toHaveBeenCalled()
        expect(engine.query(NPM_DEPS_KEY, null)).toBeNull()
    })

    it('also honours the CLI-level args.buildNpm switch', async () => {
        root = mkdtempSync(path.join(tmpdir(), 'wgs-build-'))
        makeNpmEntry()

        const engine = makeEngine()
        const options = makeOptions()

        options.args.buildNpm = false

        await maybeBuildNpm(engine as never, options, [makeNpmEntry()])

        expect(buildNpm).not.toHaveBeenCalled()
    })

    it('builds on first run, tolerates wx failures, then hits the hash', async () => {
        root = mkdtempSync(path.join(tmpdir(), 'wgs-build-'))
        const entry = makeNpmEntry(true)

        checkNpmPkg.mockReturnValue({
            isPkgMissing: false,
            pkgToUpdate: [],
            pkgMissing: [],
        })
        buildNpm.mockRejectedValue(new Error('no wx interface'))

        const engine = makeEngine()
        const warn = vi.spyOn(engine.logger, 'warn')

        await maybeBuildNpm(engine as never, makeOptions(), [entry])

        expect(buildNpm).toHaveBeenCalledTimes(1)
        expect(warn).toHaveBeenCalledWith(
            expect.stringContaining('no wx interface')
        )
        expect(engine.query(NPM_DEPS_KEY, null)).toMatch(/^[a-f0-9]{40}$/)

        // second run: hash unchanged → no npm build
        await maybeBuildNpm(engine as never, makeOptions(), [entry])

        expect(buildNpm).toHaveBeenCalledTimes(1)
    })

    it('installs missing packages and updates outdated ones', async () => {
        root = mkdtempSync(path.join(tmpdir(), 'wgs-build-'))
        const entry = makeNpmEntry(true)

        checkNpmPkg.mockReturnValue({
            isPkgMissing: true,
            pkgToUpdate: ['a'],
            pkgMissing: ['missing: a'],
        })
        buildNpm.mockResolvedValue(undefined)

        const log = vi.spyOn(console, 'log').mockImplementation(() => {})
        const engine = makeEngine()

        await maybeBuildNpm(engine as never, makeOptions(), [entry])

        expect(npmInstallNoSave).toHaveBeenCalledWith({
            exec: { cwd: path.dirname(entry.path) },
        })
        expect(batchUpdate).toHaveBeenCalledWith({
            exec: { cwd: path.dirname(entry.path) },
        })
        expect(log).toHaveBeenCalledWith('pkgMissing: ', ['missing: a'])
        expect(log).toHaveBeenCalledWith('pkgToUpdate: ', ['a'])
        expect(buildNpm).toHaveBeenCalledTimes(1)
    })

    it('runs npmInstallNoSave when node_modules is absent', async () => {
        root = mkdtempSync(path.join(tmpdir(), 'wgs-build-'))
        const entry = makeNpmEntry(false)

        buildNpm.mockResolvedValue(undefined)

        const engine = makeEngine()

        await maybeBuildNpm(engine as never, makeOptions(), [entry])

        expect(npmInstallNoSave).toHaveBeenCalledWith({
            exec: { cwd: path.dirname(entry.path) },
        })
        expect(checkNpmPkg).not.toHaveBeenCalled()
    })

    it('creates missing output directories and skips absent package.json', async () => {
        root = mkdtempSync(path.join(tmpdir(), 'wgs-build-'))

        const outDir = path.join(root, 'out', 'nested')
        const engine = makeEngine()

        await maybeBuildNpm(engine as never, makeOptions(), [
            { path: path.join(root, 'ghost', 'package.json'), output: outDir },
        ])

        expect(existsSync(outDir)).toBe(true)
        expect(buildNpm).toHaveBeenCalledTimes(1)
    })

    it('anchors the project to cwd when no config file was resolved', async () => {
        root = mkdtempSync(path.join(tmpdir(), 'wgs-build-'))
        makeNpmEntry(true)

        checkNpmPkg.mockReturnValue({
            isPkgMissing: false,
            pkgToUpdate: [],
            pkgMissing: [],
        })
        buildNpm.mockResolvedValue(undefined)

        const engine = makeEngine()
        const options = makeOptions()

        options.config = ''

        const oldCwd = process.cwd()

        process.chdir(root!)

        try {
            await maybeBuildNpm(engine as never, options, [makeNpmEntry()])

            expect(checkNpmPkg).toHaveBeenCalledWith(expect.any(String), root)
        } finally {
            process.chdir(oldCwd)
        }
    })

    it('stringifies non-Error wx failures in the warning', async () => {
        root = mkdtempSync(path.join(tmpdir(), 'wgs-build-'))
        makeNpmEntry(true)

        checkNpmPkg.mockReturnValue({
            isPkgMissing: false,
            pkgToUpdate: [],
            pkgMissing: [],
        })
        buildNpm.mockRejectedValue('plain-string-failure')

        const engine = makeEngine()
        const warn = vi.spyOn(engine.logger, 'warn')

        await maybeBuildNpm(engine as never, makeOptions(), [makeNpmEntry()])

        expect(warn).toHaveBeenCalledWith(
            expect.stringContaining('plain-string-failure')
        )
    })
})
