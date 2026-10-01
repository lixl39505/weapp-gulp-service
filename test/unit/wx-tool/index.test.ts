import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildNpm, getWx, upload } from '../../../src/wx-tool/index.js'

vi.mock('requireg', () => ({
    default: vi.fn(() => ({
        Project: vi.fn(function (this: unknown) {
            return {}
        }),
        packNpm: vi.fn(async () => 'packed'),
        packNpmManually: vi.fn(async () => 'packed-manual'),
        upload: vi.fn(async () => 'uploaded'),
    })),
}))

vi.mock('node:child_process', () => ({
    execSync: vi.fn(() => Buffer.from('')),
}))

let root: string | undefined

function makeProject(setting: Record<string, unknown> = {}): string {
    root = mkdtempSync(path.join(tmpdir(), 'wgs-wxtool-'))

    writeFileSync(
        path.join(root, 'project.config.json'),
        JSON.stringify({ appid: 'wx1', compileType: 'miniprogram', setting })
    )
    writeFileSync(path.join(root, 'key'), 'key')

    return root
}

afterEach(() => {
    vi.restoreAllMocks()

    if (root !== undefined) {
        rmSync(root, { recursive: true, force: true })
        root = undefined
    }
})

describe('getWx / upload / buildNpm', () => {
    it('prefers ci when the private key env is provided (env or process)', async () => {
        const project = makeProject()
        const log = vi.spyOn(console, 'log').mockImplementation(() => {})

        const viaEnv = await getWx({
            project,
            env: { WE_APP_PRIVATE_KEY_PATH: 'key' },
        })

        expect(viaEnv.type).toBe('ci')

        delete process.env.WE_APP_PRIVATE_KEY_PATH
        process.env.WE_APP_PRIVATE_KEY_PATH = 'key'

        try {
            const viaProcess = await getWx({ project })

            expect(viaProcess.type).toBe('ci')
        } finally {
            delete process.env.WE_APP_PRIVATE_KEY_PATH
        }

        expect(log).not.toHaveBeenCalled()
    })

    it('falls back to the devtools cli via WE_CLI', async () => {
        const project = makeProject()
        const log = vi.spyOn(console, 'log').mockImplementation(() => {})

        const wx = await getWx({ project, env: { WE_CLI: __filename } })

        expect(wx.type).toBe('cli')
        expect(log).not.toHaveBeenCalled()
    })

    it('warns and throws when neither channel is available', async () => {
        const project = makeProject()
        const log = vi.spyOn(console, 'log').mockImplementation(() => {})

        await expect(getWx({ project })).rejects.toThrowError(
            'Wechat interface call failed'
        )

        expect(log).toHaveBeenCalledTimes(3)
    })

    it('upload goes through ci or cli depending on the resolved interface', async () => {
        const project = makeProject({ minified: true })

        await upload({
            project,
            ver: '2.0.0',
            desc: 'test',
            env: { WE_APP_PRIVATE_KEY_PATH: 'key' },
        })

        await upload({
            project,
            ver: '2.0.0',
            desc: 'test',
            env: { WE_CLI: __filename },
        })
    })

    it('upload via the cli channel defaults ver/desc/verbose', async () => {
        const project = makeProject()
        const log = vi.spyOn(console, 'log').mockImplementation(() => {})

        await upload({ project, env: { WE_CLI: __filename } })

        expect(log).toHaveBeenCalledWith(
            expect.stringContaining('upload --version  --desc  --project')
        )
    })

    it('buildNpm goes through ci or cli depending on the resolved interface', async () => {
        const project = makeProject({ packNpmManually: false })

        await buildNpm({ project, env: { WE_APP_PRIVATE_KEY_PATH: 'key' } })
        await buildNpm({ project, env: { WE_CLI: __filename } })
    })
})
