import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it, vi } from 'vitest'

const requireg = vi.fn()

vi.mock('requireg', () => ({
    default: (name: string) => requireg(name),
}))

const { WxCI } = await import('../../../src/wx-tool/ci.js')

const fixtureRoot = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../fixture'
)

let root: string | undefined

function makeProject(setting: Record<string, unknown> = {}): string {
    root = mkdtempSync(path.join(tmpdir(), 'wgs-wxci-'))

    writeFileSync(
        path.join(root, 'project.config.json'),
        JSON.stringify({
            appid: 'wx123',
            compileType: 'miniprogram',
            miniprogramRoot: 'dist/',
            setting: {
                es6: true,
                enhance: true,
                minified: true,
                uglifyFileName: true,
                postcss: true,
                ...setting,
            },
        })
    )
    writeFileSync(path.join(root, 'private.key'), 'key')

    return root
}

function fakeCi() {
    return {
        Project: vi.fn(function (this: unknown) {
            return { fake: 'project' }
        }),
        packNpm: vi.fn(async () => 'packed'),
        packNpmManually: vi.fn(async () => 'packed-manual'),
        upload: vi.fn(async (config: Record<string, unknown>) => ({
            uploaded: config.version,
            config,
        })),
    }
}

afterEach(() => {
    requireg.mockReset()

    if (root !== undefined) {
        rmSync(root, { recursive: true, force: true })
        root = undefined
    }
})

describe('WxCI', () => {
    it('throws when projectPath is missing', () => {
        expect(() => new WxCI()).toThrowError('Project root must be specified')
    })

    it('throws when project.config.json is missing', () => {
        root = mkdtempSync(path.join(tmpdir(), 'wgs-wxci-'))

        expect(
            () => new WxCI({ projectPath: root, privateKeyPath: 'k' })
        ).toThrowError(/project.config.json' does not exist/)
    })

    it('throws when the private key path is missing or absent on disk', () => {
        const project = makeProject()

        expect(() => new WxCI({ projectPath: project })).toThrowError(
            'Private key file path not provided'
        )
        expect(
            () =>
                new WxCI({ projectPath: project, privateKeyPath: 'ghost.key' })
        ).toThrowError(/Private key file '.*ghost.key' does not exist/)
    })

    it('creates the ci project and uploads with the devtools setting mapping', async () => {
        const project = makeProject()
        const ci = fakeCi()

        requireg.mockReturnValue(ci)

        const log = vi.spyOn(console, 'log').mockImplementation(() => {})

        const wx = new WxCI({
            projectPath: project,
            privateKeyPath: 'private.key',
        })

        expect(wx.type).toBe('ci')
        expect(ci.Project).toHaveBeenCalledWith(
            expect.objectContaining({
                appid: 'wx123',
                type: 'miniprogram',
                projectPath: project,
            })
        )

        const res = (await wx.upload({
            version: '1.2.3',
            desc: 'd',
            verbose: true,
        })) as { uploaded: string }

        expect(res.uploaded).toBe('1.2.3')

        const config = ci.upload.mock.calls[0]![0]!

        expect(config.setting).toEqual({
            es6: true,
            es7: true,
            minify: true,
            codeProtect: true,
            autoPrefixWXSS: true,
        })
        expect(typeof config.onProgressUpdate).toBe('function')

        // the progress callback is console.log bound — invoke it to prove wiring
        ;(config.onProgressUpdate as (info: unknown) => void)('progress-info')
        expect(log).toHaveBeenCalledWith('progress-info')
    })

    it('requires a version for upload', async () => {
        const project = makeProject()

        requireg.mockReturnValue(fakeCi())

        const wx = new WxCI({
            projectPath: project,
            privateKeyPath: 'private.key',
        })

        await expect(wx.upload({})).rejects.toThrowError('未提供版本号')
        await expect(wx.upload()).rejects.toThrowError('未提供版本号')
    })

    it('accepts explicit ignores for the ci project', () => {
        const project = makeProject()
        const ci = fakeCi()

        requireg.mockReturnValue(ci)

        new WxCI({
            projectPath: project,
            privateKeyPath: 'private.key',
            ignores: ['x/**'],
        })

        expect(ci.Project).toHaveBeenCalledWith(
            expect.objectContaining({ ignores: ['x/**'] })
        )
    })

    it('buildNpm uses packNpmManually queue when configured', async () => {
        const project = makeProject({
            packNpmManually: true,
            packNpmRelationList: [
                {
                    packageJsonPath: './dist/package.json',
                    miniprogramNpmDistDir: './dist/',
                },
            ],
        })

        requireg.mockReturnValue(fakeCi())

        const log = vi.spyOn(console, 'log').mockImplementation(() => {})
        const wx = new WxCI({
            projectPath: project,
            privateKeyPath: 'private.key',
        })
        const res = await wx.buildNpm()

        expect(res).toEqual(['packed-manual'])
        expect(log).toHaveBeenCalledWith(['packed-manual'])
    })

    it('buildNpm falls back to packNpm with a reporter', async () => {
        const project = makeProject()
        const ci = fakeCi()

        // exercise the reporter callback miniprogram-ci invokes
        ;(
            ci.packNpm as unknown as {
                mockImplementation: (impl: unknown) => void
            }
        ).mockImplementation(
            async (
                _project: unknown,
                options?: { reporter?: (infos: unknown) => void }
            ) => {
                options?.reporter?.('reporter-info')
                return 'packed'
            }
        )

        requireg.mockReturnValue(ci)

        const log = vi.spyOn(console, 'log').mockImplementation(() => {})
        const wx = new WxCI({
            projectPath: project,
            privateKeyPath: 'private.key',
        })
        const res = await wx.buildNpm()

        expect(res).toBe('packed')
        expect(log).toHaveBeenCalledWith('reporter-info')
        expect(log).toHaveBeenCalledWith('packed')
    })
})
