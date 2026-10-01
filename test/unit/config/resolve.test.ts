import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { resolveWeappOptions } from '../../../src/config/resolve.js'

let roots: string[] = []

afterEach(() => {
    for (const root of roots) {
        rmSync(root, { recursive: true, force: true })
    }

    roots = []
    vi.restoreAllMocks()
})

function makeProject(files: Record<string, string> = {}): string {
    const root = mkdtempSync(path.join(tmpdir(), 'wgs-resolve-'))

    roots.push(root)

    for (const [name, content] of Object.entries(files)) {
        writeFileSync(path.join(root, name), content)
    }

    return root
}

describe('resolveWeappOptions', () => {
    it('merges defaults with user config and normalizes ignore', async () => {
        const root = makeProject({
            'weapp.config.js':
                'module.exports = { output: "out", ignore: "dist-extra" }\n',
        })
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

        const options = await resolveWeappOptions({
            config: path.join(root, 'weapp.config.js'),
        })

        expect(options.output).toBe('out')
        expect(options.source).toBe('src')
        expect(options.ignore).toEqual(['dist-extra'])
        expect(options.imgType).toEqual(['jpg', 'png', 'svg', 'webp', 'gif'])
        expect(options.config).toBe(path.join(root, 'weapp.config.js'))
        expect(options.mode).toBe('development')
        expect(logSpy).toHaveBeenCalled()
    })

    it('drops non-string non-array ignore values', async () => {
        const root = makeProject({
            'weapp.config.js': 'module.exports = { ignore: 42 }\n',
        })
        vi.spyOn(console, 'log').mockImplementation(() => {})

        const options = await resolveWeappOptions({
            config: path.join(root, 'weapp.config.js'),
        })

        expect(options.ignore).toEqual([])
    })

    it('resolves without any arguments at all', async () => {
        const root = makeProject()
        const oldCwd = process.cwd()

        process.chdir(root)

        try {
            const options = await resolveWeappOptions()

            expect(options.output).toBe('dist')
        } finally {
            process.chdir(oldCwd)
        }
    })

    it('loads the .env chain with mode precedence and passes it to the callback', async () => {
        const root = makeProject({
            '.env': 'BASE=1\nSHARED=file\n',
            '.env.local': 'LOCAL=1\n',
            '.env.test': 'MODE=test\nSHARED=mode\n',
            '.env.test.local': 'LOCAL_MODE=1\n',
            'weapp.config.js':
                'module.exports = { callback(options) { options.app.merged = [options.env.BASE, options.env.LOCAL, options.env.MODE, options.env.SHARED, options.env.LOCAL_MODE] } }\n',
        })

        const options = await resolveWeappOptions({
            config: path.join(root, 'weapp.config.js'),
            mode: 'test',
        })

        expect(options.mode).toBe('test')
        expect(options.env).toMatchObject({
            BASE: '1',
            LOCAL: '1',
            MODE: 'test',
            SHARED: 'mode',
            LOCAL_MODE: '1',
            mode: 'test',
        })
        expect(options.app.merged).toEqual(['1', '1', 'test', 'mode', '1'])
    })

    it('user env overrides file env; CLI args win over user config', async () => {
        const root = makeProject({
            '.env': 'KEY=file\n',
            'weapp.config.js':
                'module.exports = { env: { KEY: "user", EXTRA: 2 }, source: "app" }\n',
        })

        const options = await resolveWeappOptions({
            config: path.join(root, 'weapp.config.js'),
            source: 'cli-src',
        })

        expect(options.env.KEY).toBe('user')
        expect(options.env.EXTRA).toBe('2')
        expect(typeof options.env.KEY).toBe('string')
        // CLI args land in args; option values come from user config (1.0 kept
        // user config for unknown keys too)
        expect(options.source).toBe('app')
        expect(options.args.source).toBe('cli-src')
    })

    it('supports async callback replacement and in-place mutation', async () => {
        const root = makeProject({
            'weapp.config.js': [
                'module.exports = {',
                '  callback(options) { options.output = "mutated" },',
                '}',
            ].join('\n'),
        })
        const mutated = await resolveWeappOptions({
            config: path.join(root, 'weapp.config.js'),
        })

        expect(mutated.output).toBe('mutated')
    })

    it('awaits thenable callbacks and uses the replacement', async () => {
        const root = makeProject({
            'weapp.config.js':
                'module.exports = { callback: async () => ({ ...this, output: "replaced" }) }\n',
        })

        const replaced = await resolveWeappOptions({
            config: path.join(root, 'weapp.config.js'),
        })

        expect(replaced.output).toBe('replaced')
    })

    it('resolves without any config file (zero config)', async () => {
        const root = makeProject()

        const options = await resolveWeappOptions({
            config: path.join(root, 'weapp.config.js'),
        })

        expect(options.output).toBe('dist')
        expect(options.config).toBe(path.join(root, 'weapp.config.js'))
    })

    it('discovers config variants when no explicit -c was given', async () => {
        const root = makeProject({
            'weapp.config.mjs': 'export default { output: "from-mjs" }\n',
        })
        const oldCwd = process.cwd()

        process.chdir(root)

        try {
            const options = await resolveWeappOptions({})

            expect(options.output).toBe('from-mjs')
            expect(options.config).toBe(path.join(root, 'weapp.config.mjs'))
        } finally {
            process.chdir(oldCwd)
        }
    })

    it('keeps config empty when no file exists and none was named', async () => {
        const root = makeProject()
        const oldCwd = process.cwd()

        process.chdir(root)

        try {
            const options = await resolveWeappOptions({})

            expect(options.config).toBe('')
        } finally {
            process.chdir(oldCwd)
        }
    })
})
