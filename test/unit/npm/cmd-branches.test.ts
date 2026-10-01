import { writeFileSync, unlinkSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it, vi } from 'vitest'

const execSync = vi.fn((cmd: string, options?: unknown) => Buffer.from('{}'))

vi.mock('node:child_process', () => ({
    execSync: (cmd: string, options?: unknown) => execSync(cmd, options),
}))

const { checkNpmPkg } = await import('../../../src/npm/cmd.js')

describe('checkNpmPkg problem-list reconciliation', () => {
    it('treats packages already listed in problems as missing even when npm ls reports them', () => {
        execSync.mockImplementation(() =>
            Buffer.from(
                JSON.stringify({
                    name: 'fixture',
                    problems: [
                        'missing: demo@^1.0.0, required by fixture@1.0.0',
                    ],
                    dependencies: {
                        demo: {
                            version: '1.0.0',
                            resolved: 'https://registry/demo',
                        },
                    },
                })
            )
        )

        const pkg = path.join(process.cwd(), 'fixture-package.json')

        writeFileSync(pkg, JSON.stringify({ dependencies: { demo: '^1.0.0' } }))

        try {
            const status = checkNpmPkg(pkg)

            expect(status.isPkgMissing).toBe(true)
            expect(status.pkgMissing).toContain('missing: demo')
            expect(status.pkgToUpdate).toEqual([])
        } finally {
            unlinkSync(pkg)
        }
    })

    it('reports healthy packages when problems exist for other packages', () => {
        execSync.mockImplementation(() =>
            Buffer.from(
                JSON.stringify({
                    problems: [
                        'missing: other@^1.0.0, required by fixture@1.0.0',
                    ],
                    dependencies: { ok: { version: '1.0.0' } },
                })
            )
        )

        const pkg = path.join(process.cwd(), 'fixture-package-2.json')

        writeFileSync(pkg, JSON.stringify({ dependencies: { ok: '^1.0.0' } }))

        try {
            const status = checkNpmPkg(pkg)

            expect(status.isPkgMissing).toBe(true) // unrelated missing package
            expect(status.pkgMissing).toEqual([])
            expect(status.pkgToUpdate).toEqual([])
        } finally {
            unlinkSync(pkg)
        }
    })

    it('flags a name whose problem entry appeared after an earlier miss', () => {
        execSync.mockImplementation(() =>
            Buffer.from(
                JSON.stringify({
                    problems: ['missing: ok@^2.0.0, required by fixture@1.0.0'],
                    dependencies: {
                        gone: { missing: true },
                        ok: { version: '1.0.0' },
                    },
                })
            )
        )

        const pkg = path.join(process.cwd(), 'fixture-package-3.json')

        writeFileSync(
            pkg,
            JSON.stringify({ dependencies: { gone: '^1.0.0', ok: '^2.0.0' } })
        )

        try {
            const status = checkNpmPkg(pkg)

            // 'gone' lands in pkgMissing during the loop → the ok problem clause
            // is reconciled against it
            expect(status.pkgMissing).toContain('missing: gone')
            expect(status.isPkgMissing).toBe(true)
        } finally {
            unlinkSync(pkg)
        }
    })

    it('treats version-less installed entries as outdated', () => {
        execSync.mockImplementation(() =>
            Buffer.from(JSON.stringify({ dependencies: { weird: {} } }))
        )

        const pkg = path.join(process.cwd(), 'fixture-package-4.json')

        writeFileSync(
            pkg,
            JSON.stringify({ dependencies: { weird: '^1.0.0' } })
        )

        try {
            const status = checkNpmPkg(pkg)

            expect(status.isPkgMissing).toBe(false)
            expect(status.pkgToUpdate).toEqual(['weird'])
        } finally {
            unlinkSync(pkg)
        }
    })

    it('defaults absent dependency declarations to empty', () => {
        execSync.mockImplementation(() => Buffer.from(JSON.stringify({})))

        const pkg = path.join(process.cwd(), 'fixture-package-5.json')

        writeFileSync(pkg, JSON.stringify({ name: 'bare' }))

        try {
            const status = checkNpmPkg(pkg)

            expect(status.isPkgMissing).toBe(false)
            expect(status.pkgToUpdate).toEqual([])
            expect(status.pkgMissing).toEqual([])
        } finally {
            unlinkSync(pkg)
        }
    })
})
