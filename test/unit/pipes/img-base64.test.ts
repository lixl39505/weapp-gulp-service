import {
    copyFileSync,
    existsSync,
    mkdtempSync,
    rmSync,
    writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { encodeStylesheet } from '../../../src/pipes/img-base64.js'
import type { Base64Options } from '../../../src/types.js'

const fixtureRoot = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../fixture'
)
const pngPath = path.join(fixtureRoot, 'img', 'wx.png')
const jpgPath = path.join(fixtureRoot, 'img', 'big.jpg')

let root: string | undefined

afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()

    if (root !== undefined) {
        rmSync(root, { recursive: true, force: true })
        root = undefined
    }
})

function makeOptions(overrides: Partial<Base64Options> = {}): Base64Options {
    return {
        baseDir: '',
        exclude: [],
        maxImageSize: 8 * 1024,
        deleteAfterEncoding: false,
        debug: false,
        ...overrides,
    }
}

async function encode(
    css: string,
    cssPath: string,
    options?: Partial<Base64Options>
): Promise<string> {
    const out = await encodeStylesheet(
        { path: cssPath, contents: Buffer.from(css) },
        makeOptions(options)
    )

    return out.toString()
}

describe('encodeStylesheet', () => {
    it('inlines local images under maxImageSize', async () => {
        root = mkdtempSync(path.join(tmpdir(), 'wgs-b64-'))
        const img = path.join(root, 'wx.png')

        copyFileSync(pngPath, img)

        const css = await encode(
            '.a { background: url("./wx.png") no-repeat; }',
            path.join(root, 'a.wxss')
        )

        expect(css).toContain('data:image/png;base64,')
        expect(css).not.toContain('wx.png')
    })

    it('keeps images above maxImageSize (encoded length)', async () => {
        root = mkdtempSync(path.join(tmpdir(), 'wgs-b64-'))
        const img = path.join(root, 'big.jpg')

        copyFileSync(jpgPath, img)

        const css = await encode(
            '.a { background: url("./big.jpg"); }',
            path.join(root, 'a.wxss')
        )

        expect(css).toContain('url("./big.jpg")')
        expect(css).not.toContain('data:image')
    })

    it('leaves missing local files untouched (warn only with debug)', async () => {
        root = mkdtempSync(path.join(tmpdir(), 'wgs-b64-'))
        const log = vi.spyOn(console, 'log').mockImplementation(() => {})
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

        // debug on: the missing primary path logs, the cwd fallback also logs,
        // and the final warn explains the failure
        const css = await encode(
            '.a { background: url("./ghost.png"); }',
            path.join(root, 'a.wxss'),
            { debug: true }
        )

        expect(css).toContain('url("./ghost.png")')
        expect(log).toHaveBeenCalled()
        expect(warn).toHaveBeenCalled()

        const quiet = await encode(
            '.b { background: url("./ghost.png"); }',
            path.join(root, 'b.wxss')
        )

        expect(quiet).toContain('url("./ghost.png")')
    })

    it('falls back to the css directory from baseDir and then cwd', async () => {
        root = mkdtempSync(path.join(tmpdir(), 'wgs-b64-'))
        const img = path.join(root, 'wx.png')

        copyFileSync(pngPath, img)

        // baseDir wins when the url is bare
        const withBase = await encode(
            '.a { background: url(wx.png); }',
            path.join(root, 'a.wxss'),
            { baseDir: root }
        )

        expect(withBase).toContain('data:image/png;base64,')
    })

    it('passes data: URIs and external urls through', async () => {
        const fetchMock = vi.fn()
        vi.stubGlobal('fetch', fetchMock)

        const css = await encode(
            [
                '.a { background: url(data:image/png;base64,AAA); }',
                '.b { background: url(https://example.com/x.png); }',
                '.c { background: url(//cdn.example.com/y.png); }',
            ].join('\n'),
            path.join(tmpdir(), 'a.wxss')
        )

        expect(css).toContain('url(data:image/png;base64,AAA)')
        expect(css).toContain('url(https://example.com/x.png)')
        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(fetchMock).toHaveBeenCalledWith('https://example.com/x.png')
        expect(fetchMock).toHaveBeenCalledWith('http://cdn.example.com/y.png')
    })

    it('keeps the declaration when a remote fetch fails', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => ({ status: 404 }))
        )
        const logError = vi.spyOn(console, 'error').mockImplementation(() => {})

        const css = await encode(
            '.a { background: url(https://example.com/missing.png); }',
            path.join(tmpdir(), 'a.wxss')
        )

        expect(css).toContain('url(https://example.com/missing.png)')
        expect(logError).toHaveBeenCalled()
    })

    it('honours exclude patterns (string, regex, fn) with debug logging', async () => {
        const log = vi.spyOn(console, 'log').mockImplementation(() => {})

        const css = await encode(
            [
                '.a { background: url(https://cdn.alicdn.com/a.png); }',
                '.b { background: url(https://x.example.com/keep.png); }',
                '.c { background: url(https://skip.regex.com/a.png); }',
                '.d { background: url(https://skip.fn.com/a.png); }',
            ].join('\n'),
            path.join(tmpdir(), 'a.wxss'),
            {
                debug: true,
                exclude: [
                    'alicdn',
                    /skip\.regex/,
                    (rawUrl: string) => rawUrl.includes('skip.fn'),
                ],
            }
        )

        expect(css).toContain('alicdn.com/a.png')
        expect(css).toContain('x.example.com/keep.png')
        expect(css).toContain('skip.regex.com/a.png')
        expect(css).toContain('skip.fn.com/a.png')
        expect(log).toHaveBeenCalledTimes(3)
    })

    it('inlines remote images on a 200 response', async () => {
        const png = (await import('node:fs')).readFileSync(pngPath)

        vi.stubGlobal(
            'fetch',
            vi.fn(async () => ({
                status: 200,
                arrayBuffer: async () =>
                    png.buffer.slice(
                        png.byteOffset,
                        png.byteOffset + png.byteLength
                    ),
            }))
        )

        const css = await encode(
            '.a { background: url(https://cdn.example.com/wx.png); }',
            path.join(tmpdir(), 'a.wxss')
        )

        expect(css).toContain('data:image/png;base64,')
        expect(css).not.toContain('cdn.example.com')
    })

    it('logs skipped oversized images with debug enabled', async () => {
        root = mkdtempSync(path.join(tmpdir(), 'wgs-b64-'))
        copyFileSync(jpgPath, path.join(root, 'big.jpg'))

        const log = vi.spyOn(console, 'log').mockImplementation(() => {})

        const css = await encode(
            '.a { background: url("./big.jpg"); }',
            path.join(root, 'a.wxss'),
            { debug: true }
        )

        expect(css).toContain('url("./big.jpg")')
        expect(log).toHaveBeenCalledWith(expect.stringContaining('Skipping'))
    })

    it('skips excluded images quietly without debug', async () => {
        const log = vi.spyOn(console, 'log').mockImplementation(() => {})

        const css = await encode(
            '.a { background: url(https://cdn.alicdn.com/quiet.png); }',
            path.join(tmpdir(), 'a.wxss'),
            { exclude: ['alicdn'] }
        )

        expect(css).toContain('alicdn.com/quiet.png')
        expect(log).not.toHaveBeenCalled()
    })

    it('caches repeat images and strips query params', async () => {
        root = mkdtempSync(path.join(tmpdir(), 'wgs-b64-'))
        copyFileSync(pngPath, path.join(root, 'wx.png'))

        const css = await encode(
            '.a { background: url(./wx.png?v=1); }\n.b { background: url(./wx.png?v=2); }',
            path.join(root, 'a.wxss')
        )

        const matches = css.match(/wx\.png/g)

        expect(matches).toBeNull()

        const dataUris = css.match(/data:image\/png;base64,/g)

        expect(dataUris).toHaveLength(2)
    })

    it('deletes encoded images with deleteAfterEncoding (quiet and debug)', async () => {
        root = mkdtempSync(path.join(tmpdir(), 'wgs-b64-'))
        const img = path.join(root, 'wx.png')

        copyFileSync(pngPath, img)

        await encode(
            '.a { background: url(./wx.png); }',
            path.join(root, 'a.wxss'),
            {
                deleteAfterEncoding: true,
            }
        )

        expect(existsSync(img)).toBe(false)

        const second = path.join(root, 'wx2.png')

        copyFileSync(pngPath, second)

        const info = vi.spyOn(console, 'info').mockImplementation(() => {})

        await encode(
            '.b { background: url(./wx2.png); }',
            path.join(root, 'b.wxss'),
            {
                deleteAfterEncoding: true,
                debug: true,
            }
        )

        expect(existsSync(second)).toBe(false)
        expect(info).toHaveBeenCalled()
    })

    it('falls back to a generic mime type for unknown extensions', async () => {
        root = mkdtempSync(path.join(tmpdir(), 'wgs-b64-'))

        writeFileSync(path.join(root, 'art.xyz'), 'data')

        const css = await encode(
            '.a { background: url(./art.xyz); }',
            path.join(root, 'a.wxss')
        )

        expect(css).toContain('data:application/octet-stream;base64,')
    })

    it('tolerates a missing exclude option', async () => {
        root = mkdtempSync(path.join(tmpdir(), 'wgs-b64-'))
        copyFileSync(pngPath, path.join(root, 'wx.png'))

        const css = await encodeStylesheet(
            {
                path: path.join(root, 'a.wxss'),
                contents: Buffer.from('.a { background: url(./wx.png); }'),
            },
            {
                baseDir: '',
                maxImageSize: 8 * 1024,
                deleteAfterEncoding: false,
                debug: false,
            } as Base64Options
        )

        expect(css.toString()).toContain('data:image/png;base64,')
    })
})
