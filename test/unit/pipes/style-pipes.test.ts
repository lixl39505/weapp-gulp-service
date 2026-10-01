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

import { afterEach, describe, expect, it, vi } from 'vitest'

import { cssPipe, lessPipe, wxssPipe } from '../../../src/pipes/less.js'
import { wxsPipe, wxmlPipe } from '../../../src/pipes/wxml.js'
import type {
    CssPipeOptions,
    LessPipeOptions,
    WxssPipeOptions,
} from '../../../src/pipes/types.js'
import { makeContext, makeFile, runStages, text } from '../../helpers/stream.js'

const fixtureRoot = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../fixture'
)

let root: string | undefined

function base64Options() {
    return {
        baseDir: '',
        exclude: ['alicdn'],
        maxImageSize: 8 * 1024,
        deleteAfterEncoding: false,
        debug: false,
    }
}

function makeProject(): {
    src: string
    context: ReturnType<typeof makeContext>
} {
    root = mkdtempSync(path.join(tmpdir(), 'wgs-style-'))
    const src = path.join(root, 'src')

    mkdirSync(path.join(src, 'less'), { recursive: true })
    mkdirSync(path.join(src, 'styles'), { recursive: true })
    mkdirSync(path.join(src, 'img'), { recursive: true })
    copyFileSync(
        path.join(fixtureRoot, 'img', 'wx.png'),
        path.join(src, 'img', 'wx.png')
    )
    copyFileSync(
        path.join(fixtureRoot, 'img', 'big.jpg'),
        path.join(src, 'img', 'big.jpg')
    )
    writeFileSync(
        path.join(src, 'styles', 'variables.less'),
        '@primary-color: #123456;\n'
    )

    const context = makeContext({
        baseDir: root!,
        sourceDir: src,
        outputDir: path.join(root!, 'dist'),
        alias: { '@': src },
    })

    return { src, context }
}

afterEach(() => {
    if (root !== undefined) {
        rmSync(root, { recursive: true, force: true })
        root = undefined
    }
})

describe('lessPipe', () => {
    it('compiles less → wxss with vars injection, alias, px2rpx and base64', async () => {
        const { src, context } = makeProject()
        const options: LessPipeOptions = {
            lessVar: 'src/styles/variables.less',
            less: { javascriptEnabled: true },
            px2rpx: { times: 2 },
            base64: base64Options(),
            extname: '.wxss',
        }

        const entry = makeFile(
            path.join(src, 'less', 'index.less'),
            [
                '.page {',
                "    background: url('@/img/wx.png') no-repeat;",
                '    &-content { min-width: 200px; }',
                '}',
                '.active { color: @primary-color; }',
            ].join('\n'),
            src,
            { context }
        )

        const { files, error } = await runStages(lessPipe(options), [entry])

        expect(error).toBeNull()
        expect(files).toHaveLength(1)

        const out = files[0]!

        expect(out.extname).toBe('.wxss')

        const css = text(out)

        expect(css).toContain('400rpx')
        expect(css).toContain('#123456')
        expect(css).toContain('data:image/png;base64,')
    })

    it('emits final variables.js/.wxss for the lessVar file and swallows it', async () => {
        const { src, context } = makeProject()
        const options: LessPipeOptions = {
            lessVar: 'src/styles/variables.less',
            less: { javascriptEnabled: true },
            px2rpx: { times: 2 },
            base64: base64Options(),
            extname: '.wxss',
        }

        const vars = makeFile(
            path.join(src, 'styles', 'variables.less'),
            '@primary-color: #123456;',
            src,
            { context }
        )

        const { files, error } = await runStages(lessPipe(options), [vars])

        expect(error).toBeNull()
        expect(files.map((file) => path.basename(file.path))).toEqual([
            'variables.js',
            'variables.wxss',
        ])
        expect(text(files[0]!)).toBe(
            'export default {"primaryColor":"#123456"}'
        )
        expect(text(files[1]!)).toBe('page {--primary-color: #123456;}')
    })

    it('skips px2rpx when not configured', async () => {
        const { src, context } = makeProject()
        const options: LessPipeOptions = {
            lessVar: '',
            less: {},
            px2rpx: undefined as never,
            base64: base64Options(),
            extname: '.wxss',
        }

        const entry = makeFile(
            path.join(src, 'less', 'plain.less'),
            '.x { min-width: 100px; }',
            src,
            { context }
        )

        const { files, error } = await runStages(lessPipe(options), [entry])

        expect(error).toBeNull()
        expect(text(files[0]!)).toContain('100px')
        expect(text(files[0]!)).not.toContain('rpx')
    })

    it('registers the lessVar dep-add stage when configured', async () => {
        const { src, context } = makeProject()
        const addDep = vi.fn()
        const dependContext = makeContext({
            baseDir: root!,
            sourceDir: src,
            outputDir: path.join(root!, 'dist'),
            alias: { '@': src },
            addDep,
        })

        const options: LessPipeOptions = {
            lessVar: 'src/styles/variables.less',
            less: {},
            px2rpx: {},
            base64: base64Options(),
            extname: '.wxss',
        }

        const entry = makeFile(
            path.join(src, 'less', 'plain.less'),
            '.x { color: red; }',
            src,
            { context: dependContext }
        )

        const { files, error } = await runStages(lessPipe(options), [entry])

        expect(error).toBeNull()
        expect(files).toHaveLength(1)
        expect(addDep).toHaveBeenCalled()
    })
})

describe('cssPipe', () => {
    it('applies px2rpx, rename, .css reference replace and base64', async () => {
        const { src, context } = makeProject()
        const options: CssPipeOptions = {
            px2rpx: { times: 2 },
            base64: base64Options(),
            extname: '.wxss',
        }

        const entry = makeFile(
            path.join(src, 'css', 'index.css'),
            [
                "@import '@/css/base.css';",
                '.page { min-width: 100px; background: url("@/img/wx.png"); }',
            ].join('\n'),
            src,
            { context }
        )

        const { files, error } = await runStages(cssPipe(options), [entry])

        expect(error).toBeNull()

        const css = text(files[0]!)

        expect(files[0]!.extname).toBe('.wxss')
        expect(css).toContain("import './base.wxss'")
        expect(css).toContain('200rpx')
        expect(css).toContain('data:image/png;base64,')
    })

    it('skips px2rpx when not configured', async () => {
        const { src, context } = makeProject()
        const options: CssPipeOptions = {
            px2rpx: undefined as never,
            base64: base64Options(),
            extname: '.wxss',
        }

        const entry = makeFile(
            path.join(src, 'css', 'index.css'),
            '.page { min-width: 100px; }',
            src,
            { context }
        )

        const { files, error } = await runStages(cssPipe(options), [entry])

        expect(error).toBeNull()
        expect(text(files[0]!)).toContain('100px')
    })
})

describe('wxssPipe', () => {
    it('applies alias and base64 without renaming', async () => {
        const { src, context } = makeProject()
        const options: WxssPipeOptions = { base64: base64Options() }

        const entry = makeFile(
            path.join(src, 'wxss', 'login.wxss'),
            ".login { background: url('@/img/wx.png'); }",
            src,
            { context }
        )

        const { files, error } = await runStages(wxssPipe(options), [entry])

        expect(error).toBeNull()
        expect(files[0]!.extname).toBe('.wxss')
        expect(text(files[0]!)).toContain('data:image/png;base64,')
    })
})

describe('wxml/wxs pipes', () => {
    it('rewrites alias attributes in wxml (html strategy)', async () => {
        const { src, context } = makeProject()

        const entry = makeFile(
            path.join(src, 'wxml', 'index.wxml'),
            '<view><image src="@/img/wx.png"></image></view>',
            src,
            { context }
        )

        const { files, error } = await runStages(wxmlPipe(), [entry])

        expect(error).toBeNull()
        expect(text(files[0]!)).toContain('src="../img/wx.png"')
    })

    it('rewrites alias requires in wxs (js strategy)', async () => {
        const { src, context } = makeProject()

        const entry = makeFile(
            path.join(src, 'wxs', 'foo.wxs'),
            "const add = require('@/wxs/add')",
            src,
            { context }
        )

        const { files, error } = await runStages(wxsPipe(), [entry])

        expect(error).toBeNull()
        expect(text(files[0]!)).toContain("require('./add')")
    })
})
