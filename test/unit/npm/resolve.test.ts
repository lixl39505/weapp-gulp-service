import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { resolveNpmList } from '../../../src/npm/resolve.js'
import { createDefaults } from '../../../src/config/defaults.js'

let root: string | undefined

afterEach(() => {
    if (root !== undefined) {
        rmSync(root, { recursive: true, force: true })
        root = undefined
    }
})

function makeOptions(configPath: string) {
    return { ...createDefaults(), config: configPath }
}

describe('resolveNpmList', () => {
    it('defaults to the output package.json', () => {
        root = mkdtempSync(path.join(tmpdir(), 'wgs-npmres-'))
        const config = path.join(root, 'weapp.config.js')

        const list = resolveNpmList(makeOptions(config))

        expect(list).toEqual([
            {
                path: path.join(root, 'dist', 'package.json'),
                output: path.join(root, 'dist'),
            },
        ])
    })

    it('uses packNpmRelationList when packNpmManually is set', () => {
        root = mkdtempSync(path.join(tmpdir(), 'wgs-npmres-'))
        writeFileSync(
            path.join(root, 'project.config.json'),
            JSON.stringify({
                setting: {
                    packNpmManually: true,
                    packNpmRelationList: [
                        {
                            packageJsonPath: './pkg/package.json',
                            miniprogramNpmDistDir: './out/',
                        },
                    ],
                },
            })
        )
        mkdirSync(path.join(root, 'pkg'), { recursive: true })

        const list = resolveNpmList(
            makeOptions(path.join(root, 'weapp.config.js'))
        )

        expect(list).toEqual([
            {
                path: path.join(root, 'pkg', 'package.json'),
                output: path.join(root, 'out'),
            },
        ])
    })

    it('falls back when setting is absent or manual is off', () => {
        root = mkdtempSync(path.join(tmpdir(), 'wgs-npmres-'))
        writeFileSync(
            path.join(root, 'project.config.json'),
            JSON.stringify({ setting: { packNpmManually: false }, appid: 'x' })
        )

        const withoutManual = resolveNpmList(
            makeOptions(path.join(root, 'weapp.config.js'))
        )

        expect(withoutManual[0]!.path).toBe(
            path.join(root, 'dist', 'package.json')
        )

        // project.config.json without a setting block entirely (1.0 crashed here)
        writeFileSync(
            path.join(root, 'project.config.json'),
            JSON.stringify({ appid: 'x' })
        )

        const withoutSetting = resolveNpmList(
            makeOptions(path.join(root, 'weapp.config.js'))
        )

        expect(withoutSetting[0]!.output).toBe(path.join(root, 'dist'))
    })

    it('anchors to cwd when the config is empty', () => {
        const options = { ...createDefaults(), config: '' }
        const oldCwd = process.cwd()

        process.chdir(tmpdir())

        try {
            const list = resolveNpmList(options)

            expect(list[0]!.output).toBe(path.join(tmpdir(), 'dist'))
        } finally {
            process.chdir(oldCwd)
        }
    })
})
