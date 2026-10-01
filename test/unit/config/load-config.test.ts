import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { loadWeappConfig } from '../../../src/config/load-config.js'

let root: string | undefined

afterEach(() => {
    if (root !== undefined) {
        rmSync(root, { recursive: true, force: true })
        root = undefined
    }
})

describe('loadWeappConfig', () => {
    it('loads a CJS config by explicit file', () => {
        root = mkdtempSync(path.join(tmpdir(), 'wgs-cfg-'))
        const file = path.join(root, 'weapp.config.js')

        writeFileSync(file, 'module.exports = { alias: { "@": "./src" } }\n')

        const loaded = loadWeappConfig(root, file)

        expect(loaded?.config).toEqual({ alias: { '@': './src' } })
        expect(loaded?.file).toBe(file)
    })

    it('discovers the first standard name', () => {
        root = mkdtempSync(path.join(tmpdir(), 'wgs-cfg-'))
        writeFileSync(
            path.join(root, 'weapp.config.mjs'),
            'export default { source: "app" }\n'
        )

        const loaded = loadWeappConfig(root)

        expect(loaded?.config).toEqual({ source: 'app' })
        expect(path.basename(loaded!.file)).toBe('weapp.config.mjs')
    })

    it('loads a TS config via jiti', () => {
        root = mkdtempSync(path.join(tmpdir(), 'wgs-cfg-'))
        writeFileSync(
            path.join(root, 'weapp.config.ts'),
            'export default { lessVar: "src/styles/v.less" as string }\n'
        )

        expect(loadWeappConfig(root)?.config).toEqual({
            lessVar: 'src/styles/v.less',
        })
    })

    it('unwraps default exports and returns undefined when missing', () => {
        root = mkdtempSync(path.join(tmpdir(), 'wgs-cfg-'))
        writeFileSync(
            path.join(root, 'weapp.config.js'),
            'module.exports.default = { output: "out" }\n'
        )

        expect(loadWeappConfig(root)?.config).toEqual({ output: 'out' })
        expect(
            loadWeappConfig(mkdtempSync(path.join(tmpdir(), 'wgs-cfg-')))
        ).toBeUndefined()
    })

    it('rejects non-object exports', () => {
        root = mkdtempSync(path.join(tmpdir(), 'wgs-cfg-'))
        const file = path.join(root, 'weapp.config.js')

        writeFileSync(file, 'module.exports = 42\n')

        expect(() => loadWeappConfig(root, file)).toThrowError(/config object/)
    })

    it('falls back to cwd when no baseDir is given', () => {
        root = mkdtempSync(path.join(tmpdir(), 'wgs-cfg-'))
        writeFileSync(
            path.join(root, 'weapp.config.ts'),
            'export default { output: "cwd" }\n'
        )

        const oldCwd = process.cwd()

        process.chdir(root)

        try {
            expect(loadWeappConfig()?.config).toEqual({ output: 'cwd' })
        } finally {
            process.chdir(oldCwd)
        }
    })
})
