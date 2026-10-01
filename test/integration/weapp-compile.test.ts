import { copyFileSync, existsSync } from 'node:fs'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it, vi } from 'vitest'

// no wx interface / real npm runs during integration tests
vi.mock('../../src/wx-tool/index.js', () => ({
    buildNpm: vi.fn(async () => {
        throw new Error('no wx interface in tests')
    }),
}))

import { WeappCompiler } from '../../src/compiler.js'
import { resolveWeappOptions } from '../../src/config/resolve.js'
import { runCli } from '../../src/cli.js'
import type { WeappOptions } from '../../src/types.js'

const fixtureRoot = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '../fixture'
)

let root: string | undefined

function makeProject(): string {
    root = mkdtempSync(path.join(tmpdir(), 'wgs-it-'))
    const src = path.join(root, 'src')

    for (const rel of ['less', 'styles', 'img', 'sfc', 'js']) {
        mkdirSync(path.join(src, rel), { recursive: true })
    }

    writeFileSync(path.join(root, '.env'), 'API=https://env.example.com\n')
    writeFileSync(
        path.join(src, 'styles', 'variables.less'),
        '@brand: #336699;\n'
    )
    writeFileSync(
        path.join(src, 'less', 'index.less'),
        [
            '.page {',
            "    background: url('@/img/wx.png') no-repeat;",
            '    &-body { min-width: 100px; }',
            '}',
            '.brand { color: @brand; }',
        ].join('\n')
    )
    copyFileSync(
        path.join(fixtureRoot, 'img', 'wx.png'),
        path.join(src, 'img', 'wx.png')
    )
    writeFileSync(
        path.join(src, 'app.json'),
        JSON.stringify({
            pages: [
                { path: 'pages/a/a', title: 'A', name: 'page-a' },
                'pages/b/b',
            ],
            window: { navigationBarTitleText: 'it' },
        })
    )
    writeFileSync(path.join(src, 'sitemap.json'), '{"rules":[]}')
    writeFileSync(
        path.join(src, 'sfc', 'card.vue'),
        [
            '<template>',
            '  <view><image src="@/img/wx.png"></image><text>{{ title }}</text></view>',
            '</template>',
            '<script>',
            "import { helper } from '@/js/helper'",
            'export default { data: () => ({ title: process.env.API }) }',
            '</script>',
            '<style lang="less">',
            '.card { color: @brand; padding: 10px; }',
            '</style>',
            '<script name="json">',
            'module.exports = { usingComponents: {} }',
            '</script>',
        ].join('\n')
    )
    writeFileSync(
        path.join(src, 'js', 'helper.js'),
        "export const helper = () => 'h'\n"
    )
    writeFileSync(
        path.join(src, 'js', 'entry.js'),
        "import { helper } from '@/js/helper'\nexport const api = process.env.API\n"
    )
    writeFileSync(
        path.join(root, 'weapp.config.js'),
        [
            'module.exports = {',
            "  lessVar: 'src/styles/variables.less',",
            '  callback(options) {',
            "    options.lessVar = 'src/styles/variables.less'",
            '  },',
            '}',
        ].join('\n')
    )

    return root
}

async function compile(
    project: string
): Promise<{
    options: WeappOptions
    session: { total: number; totalHit: number }
}> {
    const previousCwd = process.cwd()

    process.chdir(project)

    try {
        const options = await resolveWeappOptions({
            config: path.join(project, 'weapp.config.js'),
        })
        const compiler = new WeappCompiler(options)

        try {
            const session = await compiler.run()

            return {
                options,
                session: session as unknown as {
                    total: number
                    totalHit: number
                },
            }
        } finally {
            await compiler.stop()
        }
    } finally {
        process.chdir(previousCwd)
    }
}

const dist = (rel: string): string => path.join(root!, 'dist', rel)

afterEach(() => {
    if (root !== undefined) {
        rmSync(root, { recursive: true, force: true })
        root = undefined
    }
})

describe('weapp compile (integration)', () => {
    it('compiles the full weapp surface: less/vars, sfc, routes, env, alias', async () => {
        const project = makeProject()
        const { session } = await compile(project)

        // less → wxss with vars injection, px2rpx, base64
        const wxss = (await import('node:fs')).readFileSync(
            dist('less/index.wxss'),
            'utf8'
        )

        expect(wxss).toContain('#336699')
        expect(wxss).toContain('200rpx')
        expect(wxss).toContain('data:image/png;base64,')

        // lessVar file → variables.js + variables.wxss
        expect(existsSync(dist('styles/variables.js'))).toBe(true)
        expect(
            (await import('node:fs')).readFileSync(
                dist('styles/variables.wxss'),
                'utf8'
            )
        ).toContain('--brand: #336699')

        // extended app.json flattened + route maps
        const appJson = JSON.parse(
            (await import('node:fs')).readFileSync(dist('app.json'), 'utf8')
        )

        expect(appJson.pages).toEqual(['pages/a/a', 'pages/b/b'])
        expect(
            (await import('node:fs')).readFileSync(dist('route-map.js'), 'utf8')
        ).toContain('"pages/a/a"')
        expect(
            (await import('node:fs')).readFileSync(
                dist('route-name-map.js'),
                'utf8'
            )
        ).toContain('"page-a"')
        // sitemap.json passes through without clobbering the route maps
        expect(existsSync(dist('sitemap.json'))).toBe(true)

        // sfc slices under <dir>/<stem>/
        expect(existsSync(dist('sfc/card/card.wxml'))).toBe(true)
        expect(existsSync(dist('sfc/card/card.json'))).toBe(true)

        const cardWxml = (await import('node:fs')).readFileSync(
            dist('sfc/card/card.wxml'),
            'utf8'
        )

        expect(cardWxml).toContain('src="../../img/wx.png"')

        const cardJs = (await import('node:fs')).readFileSync(
            dist('sfc/card/card.js'),
            'utf8'
        )

        expect(cardJs).toContain("from '../../js/helper'")
        expect(cardJs).toContain('"https://env.example.com"')

        const cardWxss = (await import('node:fs')).readFileSync(
            dist('sfc/card/card.wxss'),
            'utf8'
        )

        expect(cardWxss).toContain('#336699')
        expect(cardWxss).toContain('20rpx')

        // env substitution in js + alias resolution
        const entry = (await import('node:fs')).readFileSync(
            dist('js/entry.js'),
            'utf8'
        )

        expect(entry).toContain("from './helper'")
        expect(entry).toContain('"https://env.example.com"')
        expect(entry).not.toContain('process.env')

        expect(session.total).toBeGreaterThan(0)
        expect(session.totalHit).toBe(0)
    }, 60000)

    it('hits the compile cache on the second run', async () => {
        const project = makeProject()

        await compile(project)

        const { session } = await compile(project)

        expect(session.totalHit).toBe(session.total)
    }, 60000)

    it('recompiles only the affected task when its options change', async () => {
        const project = makeProject()

        await compile(project)

        // bump px2rpx times → the config callback output changes → less task
        // checksum changes; a fresh compile reports misses for css-like files
        const { readFile, writeFile } = await import('node:fs/promises')
        const configPath = path.join(project, 'weapp.config.js')
        const original = await readFile(configPath, 'utf8')

        await writeFile(
            configPath,
            original.replace(
                "options.lessVar = 'src/styles/variables.less'",
                "options.px2rpx = { times: 3 };\n    options.lessVar = 'src/styles/variables.less'"
            )
        )

        const { session } = await compile(project)

        expect(session.totalHit).toBeLessThan(session.total)
    }, 60000)

    it('cleans SFC subdirectory outputs when the source disappears', async () => {
        const project = makeProject()
        const { writeFile, rm } = await import('node:fs/promises')

        await compile(project)

        expect(existsSync(dist('sfc/card/card.wxml'))).toBe(true)

        await rm(path.join(project, 'src', 'sfc', 'card.vue'))
        await writeFile(
            path.join(project, 'src', 'app.json'),
            JSON.stringify({
                pages: [{ path: 'pages/a/a', title: 'A', name: 'page-a' }],
                window: {},
            })
        )

        await compile(project)

        expect(existsSync(dist('sfc/card'))).toBe(false)
        expect(existsSync(dist('sfc'))).toBe(false)
        // route maps rebuilt without the removed page
        expect(
            (await import('node:fs')).readFileSync(dist('route-map.js'), 'utf8')
        ).not.toContain('pages/b/b')
        expect(existsSync(dist('pages/b/b.wxml'))).toBe(false)
    }, 60000)

    it('builds through the real runCli path (no injected deps)', async () => {
        const project = makeProject()
        const error = vi.fn()

        const exit = await runCli(
            [
                'build',
                '--no-build-npm',
                '-c',
                path.join(project, 'weapp.config.js'),
            ],
            { attachSignals: false, error }
        )

        expect(exit).toBe(0)
        expect(existsSync(path.join(project, 'dist', 'app.json'))).toBe(true)
        expect(error).not.toHaveBeenCalled()
    }, 60000)

    it('upload/build:npm fail gracefully when no wx interface exists', async () => {
        const project = makeProject()
        const error = vi.fn()
        const log = vi.spyOn(console, 'log').mockImplementation(() => {})

        const uploadExit = await runCli(
            [
                'upload',
                '-v',
                '9.9.9',
                '-c',
                path.join(project, 'weapp.config.js'),
            ],
            { attachSignals: false, error }
        )

        expect(uploadExit).toBe(1)

        const npmExit = await runCli(
            ['build:npm', '-c', path.join(project, 'weapp.config.js')],
            { attachSignals: false, error }
        )

        expect(npmExit).toBe(1)

        log.mockRestore()
    }, 60000)
})
