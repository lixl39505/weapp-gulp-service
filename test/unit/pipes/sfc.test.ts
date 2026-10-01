import {
    copyFileSync,
    mkdirSync,
    mkdtempSync,
    rmSync,
    writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

import { sfcPipe } from '../../../src/pipes/sfc.js'
import type { SfcPipeOptions } from '../../../src/pipes/types.js'
import { makeContext, makeFile, runStages, text } from '../../helpers/stream.js'

const fixtureRoot = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../fixture'
)

let root: string | undefined

function makeProject(): {
    src: string
    context: ReturnType<typeof makeContext>
} {
    root = mkdtempSync(path.join(tmpdir(), 'wgs-sfc-'))
    const src = path.join(root, 'src')

    mkdirSync(path.join(src, 'sfc'), { recursive: true })
    mkdirSync(path.join(src, 'img'), { recursive: true })
    copyFileSync(
        path.join(fixtureRoot, 'img', 'wx.png'),
        path.join(src, 'img', 'wx.png')
    )
    writeFileSync(path.join(src, 'styles.less'), '@c: #010203;\n')

    const context = makeContext({
        baseDir: root!,
        sourceDir: src,
        outputDir: path.join(root!, 'dist'),
        alias: { '@': src },
        env: { API: 'https://api.example.com' },
    })

    return { src, context }
}

function makeOptions(src?: string): SfcPipeOptions {
    const base64 = {
        baseDir: '',
        exclude: [] as SfcPipeOptions['less']['base64']['exclude'],
        maxImageSize: 8 * 1024,
        deleteAfterEncoding: false,
        debug: false,
    }

    return {
        tagAlias: {},
        alias: { '@': src ?? '/project/src' },
        less: {
            lessVar: '',
            less: { javascriptEnabled: true },
            px2rpx: { times: 2 },
            base64,
            extname: '.wxss',
        },
        css: { px2rpx: { times: 2 }, base64, extname: '.wxss' },
        wxss: { base64 },
        json: { platform: 'wx' },
    }
}

afterEach(() => {
    if (root !== undefined) {
        rmSync(root, { recursive: true, force: true })
        root = undefined
    }
})

describe('sfcPipe', () => {
    it('compiles a .vue into four final files under <dir>/<stem>/', async () => {
        const { src, context } = makeProject()
        const vue = [
            '<template>',
            '  <view class="bar">{{ msg }}</view>',
            '</template>',
            '',
            '<script>',
            "import { api } from '@/sfc/api'",
            'export default {}',
            '</script>',
            '',
            '<style lang="less">',
            '.bar { height: 100px; }',
            '</style>',
            '',
            '<script name="json">',
            'module.exports = {',
            '  component: true,',
            '  usingComponents: { item: "./item/item" },',
            '}',
            '</script>',
        ].join('\n')

        const file = makeFile(path.join(src, 'sfc', 'bar.vue'), vue, src, {
            context,
        })

        const { files, error } = await runStages(sfcPipe(makeOptions(src)), [
            file,
        ])

        expect(error).toBeNull()
        expect(files.map((item) => path.basename(item.path))).toEqual([
            'bar.wxml',
            'bar.js',
            'bar.json',
            'bar.wxss',
        ])
        expect(files[0]!.path).toContain(path.join('sfc', 'bar'))

        const js = text(files[1]!)

        // slices live in <dir>/<stem>/ — the alias resolves to ../api
        expect(js).toContain("from '../api'")
        expect(js).not.toContain('@/')

        const json = JSON.parse(text(files[2]!))

        expect(json).toEqual({
            component: true,
            usingComponents: { item: './item/item' },
        })

        const wxss = text(files[3]!)

        expect(wxss).toContain('200rpx')
    })

    it('concats multiple style slices in order and keeps the last json', async () => {
        const { src, context } = makeProject()
        const vue = [
            '<template><view/></template>',
            '<style>.a { color: red; }</style>',
            '<style lang="less">.b { color: @c; }</style>',
            '<script name="json">module.exports = { a: 1 }</script>',
            '<script name="json">module.exports = { a: 2 }</script>',
        ].join('\n')

        const file = makeFile(path.join(src, 'sfc', 'multi.vue'), vue, src, {
            context,
        })

        const options = makeOptions(src)
        options.less.lessVar = 'src/styles.less'

        const { files, error } = await runStages(sfcPipe(options), [file])

        expect(error).toBeNull()

        const wxss = text(files[3]!)

        expect(wxss.indexOf('.a')).toBeLessThan(wxss.indexOf('.b'))
        expect(wxss).toContain('#010203')
        expect(JSON.parse(text(files[2]!))).toEqual({ a: 2 })
    })

    it('emits an empty wxss when the component has no style block', async () => {
        const { src, context } = makeProject()
        const file = makeFile(
            path.join(src, 'sfc', 'empty.vue'),
            '<template><view/></template>',
            src,
            { context }
        )

        const { files, error } = await runStages(sfcPipe(makeOptions(src)), [
            file,
        ])

        expect(error).toBeNull()
        expect(files).toHaveLength(4)
        expect(text(files[3]!)).toBe('')
    })

    it('wraps slice failures (broken json script) as CompileErrors', async () => {
        const { src, context } = makeProject()
        const file = makeFile(
            path.join(src, 'sfc', 'broken.vue'),
            [
                '<template><view/></template>',
                '<script name="json">module.exports = broken(',
            ].join('\n'),
            src,
            { context }
        )

        const { files, error } = await runStages(sfcPipe(makeOptions(src)), [
            file,
        ])

        expect(files).toHaveLength(0)
        expect((error as Error | null)?.message).toContain('[sfc]')
    })

    it('passes unknown style langs through raw and defaults empty json to {}', async () => {
        const { src, context } = makeProject()
        const vue = [
            '<template><view/></template>',
            '<style lang="scss">.raw { color: silver; }</style>',
        ].join('\n')

        const file = makeFile(path.join(src, 'sfc', 'rawlang.vue'), vue, src, {
            context,
        })

        const { files, error } = await runStages(sfcPipe(makeOptions(src)), [
            file,
        ])

        expect(error).toBeNull()
        expect(text(files[2]!)).toBe('{}')
        expect(text(files[3]!)).toContain('silver')
    })

    it('stringifies undefined json script exports to {}', async () => {
        const { src, context } = makeProject()
        const file = makeFile(
            path.join(src, 'sfc', 'undefjson.vue'),
            [
                '<template><view/></template>',
                '<script name="json">module.exports = undefined</script>',
            ].join('\n'),
            src,
            { context }
        )

        const { files, error } = await runStages(sfcPipe(makeOptions(src)), [
            file,
        ])

        expect(error).toBeNull()
        expect(text(files[2]!)).toBe('{}')
    })

    it('surfaces style slice failures (broken less) as CompileErrors', async () => {
        const { src, context } = makeProject()
        const file = makeFile(
            path.join(src, 'sfc', 'badstyle.vue'),
            [
                '<template><view/></template>',
                '<style lang="less">.b { color: @never-defined-var; }</style>',
            ].join('\n'),
            src,
            { context }
        )

        const { files, error } = await runStages(sfcPipe(makeOptions(src)), [
            file,
        ])

        expect(files).toHaveLength(0)
        expect((error as Error | null)?.message).toContain('[less]')
    })
})
