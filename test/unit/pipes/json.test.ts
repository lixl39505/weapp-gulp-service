import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { appJsonPipe } from '../../../src/pipes/app-json.js'
import {
    json5Pipe,
    jsonPipe,
    weappJsonMatcher,
} from '../../../src/pipes/json.js'
import { makeContext, makeFile, runStages, text } from '../../helpers/stream.js'

let root: string | undefined

afterEach(() => {
    if (root !== undefined) {
        rmSync(root, { recursive: true, force: true })
        root = undefined
    }
})

function createContext(sourceDir = path.resolve('/project/src')) {
    return makeContext({ baseDir: path.dirname(sourceDir), sourceDir })
}

describe('appJsonPipe', () => {
    it('flattens app.json and emits route maps attributed to it', async () => {
        const context = createContext()
        const file = makeFile(
            path.join(context.sourceDir as string, 'app.json'),
            JSON.stringify({
                pages: [{ path: 'pages/a/a', name: 'a', title: 'A' }],
                window: {},
            }),
            context.sourceDir as string,
            { context }
        )

        const { files, error } = await runStages(
            appJsonPipe({ platform: 'wx' }),
            [file]
        )

        expect(error).toBeNull()
        expect(files.map((item) => path.basename(item.path))).toEqual([
            'app.json',
            'route-map.js',
            'route-name-map.js',
        ])

        const appJson = JSON.parse(text(files[0]!))

        expect(appJson.pages).toEqual(['pages/a/a'])

        expect(text(files[1]!)).toContain('"pages/a/a"')
        expect(text(files[1]!)).toContain('export default')
        expect(text(files[2]!)).toContain('"a": "pages/a/a"')
    })

    it('passes non-app.json files through untouched', async () => {
        const context = createContext()
        const file = makeFile(
            path.join(context.sourceDir as string, 'sitemap.json'),
            '{"rules":[]}',
            context.sourceDir as string,
            { context }
        )

        const { files, error } = await runStages(appJsonPipe(), [file])

        expect(error).toBeNull()
        expect(files).toHaveLength(1)
        expect(text(files[0]!)).toBe('{"rules":[]}')
    })

    it('surfaces parse errors as CompileErrors', async () => {
        const context = createContext()
        const file = makeFile(
            path.join(context.sourceDir as string, 'app.json'),
            '{ invalid',
            context.sourceDir as string,
            { context }
        )

        const { files, error } = await runStages(appJsonPipe(), [file])

        expect(files).toHaveLength(0)
        expect((error as Error | null)?.message).toContain('[app-json]')
    })
})

describe('weappJsonMatcher', () => {
    it('collects usingComponents/pages/subpackages (both spellings)', () => {
        root = mkdtempSync(path.join(tmpdir(), 'wgs-json-'))
        const src = path.join(root, 'src')

        // the matcher expands to files that actually exist (fast-glob); the
        // weapp convention is <dir>/<name>/<name>.<ext>
        for (const rel of [
            'pages/index/comp/comp.vue',
            'pages/p/p.vue',
            'pages/q/q.mp',
            'pkg/pages/s/s.vue',
            'pkg2/pages/t/t.vue',
        ]) {
            mkdirSync(path.join(src, rel, '..'), { recursive: true })
            writeFileSync(path.join(src, rel), '')
        }

        const context = makeContext({ baseDir: root, sourceDir: src })
        const file = makeFile(
            path.join(src, 'pages', 'index', 'index.json'),
            JSON.stringify({
                usingComponents: { comp: './comp/comp' },
                pages: ['pages/p/p', { path: 'pages/q/q' }],
                subpackages: [{ root: 'pkg', pages: ['pages/s/s'] }],
                subPackages: [{ root: 'pkg2', pages: ['pages/t/t'] }],
            }),
            src,
            { context }
        )

        const deps = weappJsonMatcher(file, context as never) as string[]

        expect(deps.some((dep) => dep.endsWith('comp.vue'))).toBe(true)
        expect(deps.some((dep) => dep.endsWith('p.vue'))).toBe(true)
        expect(deps.some((dep) => dep.endsWith('q.mp'))).toBe(true)
        expect(
            deps.some((dep) => dep.includes('pkg') && dep.endsWith('s.vue'))
        ).toBe(true)
        expect(
            deps.some((dep) => dep.includes('pkg2') && dep.endsWith('t.vue'))
        ).toBe(true)
    })

    it('expands <request>/*.* directories', () => {
        root = mkdtempSync(path.join(tmpdir(), 'wgs-json-'))
        const src = path.join(root, 'src')

        for (const rel of ['pages/inner/x/keep.js', 'pages/inner/x/part.vue']) {
            mkdirSync(path.join(src, rel, '..'), { recursive: true })
            writeFileSync(path.join(src, rel), '')
        }

        const context = makeContext({ baseDir: root, sourceDir: src })
        const file = makeFile(
            path.join(src, 'app.json'),
            JSON.stringify({ pages: ['pages/inner/x/x'] }),
            src,
            { context }
        )

        // pages/inner/x/x matches x.{vue,mp} AND everything inside x/ via *.*
        const deps = weappJsonMatcher(file, context as never) as string[]

        expect(deps.some((dep) => dep.endsWith('keep.js'))).toBe(true)
        expect(deps.some((dep) => dep.endsWith('part.vue'))).toBe(true)
    })

    it('skips malformed subpackage entries and entries without pages', () => {
        const context = createContext()
        const file = makeFile(
            path.join(context.sourceDir as string, 'app.json'),
            JSON.stringify({
                pages: [null, undefined, 'pages/ok/ok', { title: 'no path' }],
                subpackages: [
                    'not-an-object',
                    { root: 'pkg', pages: 'not-array' },
                    { root: 'pkg2', pages: [{ path: '' }, null] },
                ],
            }),
            context.sourceDir as string,
            { context }
        )

        const deps = weappJsonMatcher(file, context as never) as string[]

        // malformed entries and paths without files expand to nothing
        expect(deps).toEqual([])
    })

    it('collapses duplicated trailing page paths', () => {
        const context = createContext()
        const file = makeFile(
            path.join(context.sourceDir as string, 'app.json'),
            JSON.stringify({ pages: ['pages/x/index/index'] }),
            context.sourceDir as string,
            { context }
        )

        const deps = weappJsonMatcher(file, context as never) as string[]

        // src/pages/x/index/index → deduped to src/pages/x/index before globbing
        expect(deps.every((dep) => !dep.endsWith('index/index.vue'))).toBe(true)
    })

    it('collapses duplicated trailing parts and tolerates broken json', () => {
        const context = createContext()
        const file = makeFile(
            path.join(context.sourceDir as string, 'app.json'),
            'not json at all',
            context.sourceDir as string,
            { context }
        )

        const deps = weappJsonMatcher(file, context as never) as string[]

        expect(deps).toEqual([])
    })
})

describe('jsonPipe', () => {
    it('works without options and distinguishes json/json5 stage counts', () => {
        expect(jsonPipe().length).toBe(3)
        expect(json5Pipe().length).toBe(4)
    })

    it('runs env + app-json + depend stages (json), adds str-json5 for json5', async () => {
        const context = createContext()
        const file = makeFile(
            path.join(context.sourceDir as string, 'human.json5'),
            '{ unquoted: "x", api: process.env.API }',
            context.sourceDir as string,
            { context }
        )

        const stages = jsonPipe({ json5: true, platform: 'wx' })

        expect(stages.length).toBe(4)

        const { files, error } = await runStages(stages, [file])

        expect(error).toBeNull()

        const json = text(files[0]!)

        expect(json).toContain('"unquoted": "x"')
        expect(json).toContain('"api": "https://api.example.com"')
        expect(json).not.toContain('process.env')
    })

    it('keeps the .json5 extname (1.0 parity) and records env pseudo-deps', async () => {
        const context = createContext()
        const file = makeFile(
            path.join(context.sourceDir as string, 'cfg.json5'),
            '{ n: process.env.API }',
            context.sourceDir as string,
            { context }
        )

        const { files, error } = await runStages(jsonPipe({ json5: true }), [
            file,
        ])

        expect(error).toBeNull()
        expect(files[0]!.extname).toBe('.json5')
        expect(context.customDeps as string[]).toContain(
            path.join(context.sourceDir as string, '.env', 'API')
        )
    })
})
