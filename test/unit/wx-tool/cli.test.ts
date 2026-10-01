import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

const execSync = vi.fn((cmd: string, options?: unknown) =>
    Buffer.from(String(cmd))
)

vi.mock('node:child_process', () => ({
    execSync: (cmd: string, options?: unknown) => execSync(cmd, options),
}))

const { WxDevtoolCli } = await import('../../../src/wx-tool/cli.js')

let root: string | undefined

afterEach(() => {
    vi.clearAllMocks()

    if (root !== undefined) {
        rmSync(root, { recursive: true, force: true })
        root = undefined
    }
})

function makeCli() {
    root = mkdtempSync(path.join(tmpdir(), 'wgs-wxcli-'))
    const cliFile = path.join(root, 'cli')

    writeFileSync(cliFile, '')

    return new WxDevtoolCli(cliFile)
}

describe('WxDevtoolCli', () => {
    it('throws without a path and on bogus paths', () => {
        expect(() => new WxDevtoolCli()).toThrowError(
            'Wechat developer tool cli path not provided'
        )
        expect(
            () => new WxDevtoolCli(path.join(root ?? tmpdir(), 'ghost'))
        ).toThrowError(/path of wechat developer tool cli is incorrect/)
    })

    it('serializes short and long (dashified) options', () => {
        const cli = makeCli()
        const log = vi.spyOn(console, 'log').mockImplementation(() => {})

        cli.run('upload', { v: '1.0.0', uploadDesc: 'ci', project: '/p' })

        expect(execSync).toHaveBeenCalledWith(
            expect.stringContaining(
                `"${cli.path}" upload -v 1.0.0 --upload-desc ci --project /p`
            ),
            { stdio: 'inherit' }
        )
        expect(log).toHaveBeenCalled()
    })

    it('run without options serializes an empty parameter list', () => {
        const cli = makeCli()
        const log = vi.spyOn(console, 'log').mockImplementation(() => {})

        cli.run('open')

        expect(execSync).toHaveBeenCalledWith(
            expect.stringContaining(`"${cli.path}" open `),
            { stdio: 'inherit' }
        )
        expect(log).toHaveBeenCalled()
    })

    it('generates all subcommand methods (dashified)', () => {
        const methods = makeCli() as unknown as Record<
            string,
            (options?: Record<string, unknown>) => unknown
        >

        methods.autoPreview!({ project: '/p' })
        methods.buildNpm!({ project: '/p' })
        methods.login!({ qr: true })
        methods.resetFileutils!({})
        methods.cache!({ cleanAll: true })

        const calls = (execSync.mock.calls as unknown as Array<[string]>).map(
            (call) => call[0]
        )

        expect(calls.some((cmd) => cmd?.includes('auto-preview'))).toBe(true)
        expect(calls.some((cmd) => cmd?.includes('build-npm'))).toBe(true)
        expect(calls.some((cmd) => cmd?.includes('login'))).toBe(true)
        expect(calls.some((cmd) => cmd?.includes('reset-fileutils'))).toBe(true)
        expect(calls.some((cmd) => cmd?.includes('cache'))).toBe(true)
    })
})
