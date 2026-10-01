import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { checkNpmPkg, makeCmd, npmLs } from '../../../src/npm/cmd.js'

// the wgs project itself has a real node_modules — npm ls there is reliable
const projectRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../..'
)

let root: string | undefined

afterEach(() => {
    vi.restoreAllMocks()

    if (root !== undefined) {
        rmSync(root, { recursive: true, force: true })
        root = undefined
    }
})

describe('makeCmd', () => {
    it('executes with default options and logs the command', () => {
        const log = vi.spyOn(console, 'log').mockImplementation(() => {})
        const cmd = makeCmd('node -v', { exec: { stdio: 'pipe' } })

        const out = cmd()

        expect(out.toString()).toMatch(/\d+/)
        expect(log).toHaveBeenCalledWith(expect.stringContaining('node -v'))
        expect(String(cmd)).toBe('node -v')
    })

    it('respects log:false and merged exec options', () => {
        const log = vi.spyOn(console, 'log').mockImplementation(() => {})
        const cmd = makeCmd('node -v', { log: false, exec: { stdio: 'pipe' } })

        cmd({ exec: { stdio: 'pipe', cwd: tmpdir() } })

        expect(log).not.toHaveBeenCalled()
    })
})

describe('checkNpmPkg', () => {
    function makePkg(deps: Record<string, string>): string {
        root = mkdtempSync(path.join(tmpdir(), 'wgs-npm-'))
        const file = path.join(root, 'package.json')

        writeFileSync(
            file,
            JSON.stringify({ name: 'fixture', dependencies: deps })
        )

        return file
    }

    it('reports installed and satisfying packages as healthy', () => {
        const file = makePkg({ commander: '^15.0.0' })
        const status = checkNpmPkg(file, projectRoot)

        expect(status.isPkgMissing).toBe(false)
        expect(status.pkgToUpdate).toEqual([])
        expect(status.pkgMissing).toEqual([])
    })

    it('flags missing packages (declared but absent)', () => {
        const file = makePkg({ 'not-a-real-pkg-xyz': '^1.0.0' })
        const status = checkNpmPkg(file, projectRoot)

        expect(status.isPkgMissing).toBe(true)
        expect(status.pkgMissing).toEqual(['missing: not-a-real-pkg-xyz'])
    })

    it('flags outdated packages', () => {
        const file = makePkg({ commander: '^99.0.0' })
        const status = checkNpmPkg(file, projectRoot)

        expect(status.isPkgMissing).toBe(false)
        expect(status.pkgToUpdate).toEqual(['commander'])
    })

    it('survives npm ls failures by parsing stdout', () => {
        const file = makePkg({})
        mkdirSync(path.join(root!, 'broken'), { recursive: true })
        const bogusCwd = path.join(root!, 'broken')

        // npm ls with an invalid cwd fails; the fallback reads stdout
        const status = checkNpmPkg(file, bogusCwd)

        expect(status.pkgMissing).toEqual([])
    })

    it('npmLs runs json output', () => {
        root = mkdtempSync(path.join(tmpdir(), 'wgs-npm-'))

        const out = npmLs({ exec: { stdio: 'pipe', cwd: root } }).toString()

        expect(() => JSON.parse(out)).not.toThrow()
    })
})
