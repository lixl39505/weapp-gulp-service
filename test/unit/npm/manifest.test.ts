import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { npmDepsHash, npmDepsManifest } from '../../../src/npm/manifest.js'
import { createDefaults } from '../../../src/config/defaults.js'

let root: string | undefined

afterEach(() => {
    if (root !== undefined) {
        rmSync(root, { recursive: true, force: true })
        root = undefined
    }
})

function makeOptions(env: Record<string, string> = {}) {
    return {
        ...createDefaults(),
        config: path.join(root!, 'weapp.config.js'),
        env,
    }
}

describe('npm deps manifest', () => {
    it('aggregates package deps and directory stamps', () => {
        root = mkdtempSync(path.join(tmpdir(), 'wgs-manifest-'))
        mkdirSync(path.join(root, 'dist', 'node_modules'), { recursive: true })
        writeFileSync(
            path.join(root, 'dist', 'package.json'),
            JSON.stringify({
                dependencies: { a: '^1' },
                peerDependencies: { b: '^2' },
            })
        )

        const options = makeOptions()
        const list = [
            {
                path: path.join(root, 'dist', 'package.json'),
                output: path.join(root, 'dist'),
            },
        ]
        const manifest = npmDepsManifest(options, list)

        expect(manifest.entries[0]!.dependencies).toEqual({ a: '^1' })
        expect(manifest.entries[0]!.peerDependencies).toEqual({ b: '^2' })
        expect(manifest.entries[0]!.nodeModules.mtime).toBeGreaterThan(0)
        // miniprogram_npm missing → deterministic zero stamps
        expect(manifest.entries[0]!.miniNpm).toEqual({
            birthtime: 0,
            ctime: 0,
            mtime: 0,
        })

        const hashA = npmDepsHash(options, list)

        expect(hashA).toMatch(/^[a-f0-9]{40}$/)
        expect(npmDepsHash(options, list)).toBe(hashA)
    })

    it('includes the wx-tool env keys in the hash and tolerates broken json', () => {
        root = mkdtempSync(path.join(tmpdir(), 'wgs-manifest-'))
        mkdirSync(path.join(root, 'dist'), { recursive: true })
        writeFileSync(path.join(root, 'dist', 'package.json'), 'not json')

        const list = [
            {
                path: path.join(root, 'dist', 'package.json'),
                output: path.join(root, 'dist'),
            },
        ]
        const base = npmDepsHash(makeOptions(), list)
        const withKey = npmDepsHash(
            makeOptions({ WE_APP_PRIVATE_KEY_PATH: 'k' }),
            list
        )

        expect(withKey).not.toBe(base)
        expect(
            npmDepsManifest(makeOptions(), list).entries[0]!.dependencies
        ).toEqual({})
    })

    it('defaults missing dependency declarations to empty objects', () => {
        root = mkdtempSync(path.join(tmpdir(), 'wgs-manifest-'))
        mkdirSync(path.join(root, 'dist'), { recursive: true })
        writeFileSync(
            path.join(root, 'dist', 'package.json'),
            JSON.stringify({ name: 'bare' })
        )

        const manifest = npmDepsManifest(makeOptions(), [
            {
                path: path.join(root, 'dist', 'package.json'),
                output: path.join(root, 'dist'),
            },
        ])

        expect(manifest.entries[0]!.dependencies).toEqual({})
        expect(manifest.entries[0]!.peerDependencies).toEqual({})
    })

    it('falls back to process.env when the resolved env misses the key', () => {
        root = mkdtempSync(path.join(tmpdir(), 'wgs-manifest-'))
        const previous = process.env.WE_CLI

        delete process.env.WE_CLI
        process.env.WE_CLI = 'from-process'

        try {
            const manifest = npmDepsManifest(makeOptions(), [
                {
                    path: path.join(root, 'missing', 'package.json'),
                    output: path.join(root, 'x'),
                },
            ])

            expect(manifest.cliPath).toBe('from-process')

            // resolved env wins over process.env
            const withEnv = npmDepsManifest(
                makeOptions({ WE_CLI: 'from-env' }),
                [
                    {
                        path: path.join(root, 'missing', 'package.json'),
                        output: path.join(root, 'x'),
                    },
                ]
            )

            expect(withEnv.cliPath).toBe('from-env')
        } finally {
            if (previous === undefined) {
                delete process.env.WE_CLI
            } else {
                process.env.WE_CLI = previous
            }
        }
    })
})
