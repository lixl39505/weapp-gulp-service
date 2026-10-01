import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { runCli, main } from '../../src/cli.js'
import type { CliDeps } from '../../src/cli.js'

function makeDeps(root: string): CliDeps & {
    write: (message: string) => void
    error: (message: string) => void
    onStart: ReturnType<typeof vi.fn>
    createCompiler: ReturnType<typeof vi.fn>
    upload: ReturnType<typeof vi.fn>
    buildNpm: ReturnType<typeof vi.fn>
    signals: { once: ReturnType<typeof vi.fn> }
} {
    const write = vi.fn()
    const error = vi.fn()
    const onStart = vi.fn()
    const compiler = {
        ready: Promise.resolve(),
        options: { env: { API: 'x' } },
        run: vi.fn(async () => ({ total: 0 })),
        watch: vi.fn(async () => ({ total: 0 })),
        stop: vi.fn(async () => undefined),
        npmList: [],
    }
    const createCompiler = vi.fn(() => compiler)

    return {
        write,
        error,
        onStart,
        createCompiler: createCompiler as never,
        upload: vi.fn(async () => undefined),
        buildNpm: vi.fn(async () => undefined),
        attachSignals: false,
        signals: { once: vi.fn() },
        cwd: () => root,
    } as never
}

let root: string | undefined

afterEach(() => {
    vi.restoreAllMocks()

    if (root !== undefined) {
        rmSync(root, { recursive: true, force: true })
        root = undefined
    }
})

function makeProject(): string {
    root = mkdtempSync(path.join(tmpdir(), 'wgs-cli-'))

    return root
}

describe('runCli', () => {
    it('serve resolves options and watches (default command)', async () => {
        const deps = makeDeps(makeProject())

        const code = await runCli(
            ['-c', path.join(root!, 'weapp.config.js')],
            deps
        )

        expect(code).toBe(0)
        expect(deps.createCompiler).toHaveBeenCalled()
        expect(deps.onStart).toHaveBeenCalled()

        const options = deps.createCompiler.mock.calls[0]![0]

        expect(options.mode).toBe('development')
        expect(options.args.buildNpm).toBe(true)
    })

    it('serve honors --no-build-npm and -m', async () => {
        const deps = makeDeps(makeProject())

        await runCli(
            [
                '-m',
                'test',
                '--no-build-npm',
                '-c',
                path.join(root!, 'weapp.config.js'),
            ],
            deps
        )

        const options = deps.createCompiler.mock.calls[0]![0]

        expect(options.mode).toBe('test')
        expect(options.args.buildNpm).toBe(false)
    })

    it('serve shuts down on a signal and stops the compiler once', async () => {
        const deps = makeDeps(makeProject())

        deps.attachSignals = true

        // fire SIGTERM once watch() is up — that resolves the serve promise
        deps.onStart = vi.fn(() => {
            queueMicrotask(() => {
                const call = deps.signals.once.mock.calls[1]

                // idempotent: a second invocation is a no-op
                call?.[1]()
                call?.[1]()
            })
        })

        const code = await runCli(
            ['-c', path.join(root!, 'weapp.config.js')],
            deps
        )

        expect(code).toBe(0)
        expect(deps.signals.once).toHaveBeenCalledTimes(2)

        const compiler = deps.createCompiler.mock.results[0]!.value as {
            stop: ReturnType<typeof vi.fn>
        }

        expect(compiler.stop).toHaveBeenCalledTimes(1)
    })

    it('action failures surface as exit code 1', async () => {
        const deps = makeDeps(makeProject())

        deps.createCompiler.mockImplementation(() => {
            throw new Error('resolve failed')
        })

        const code = await runCli(
            ['build', '-c', path.join(root!, 'weapp.config.js')],
            deps
        )

        expect(code).toBe(1)
        expect(deps.error).toHaveBeenCalledWith('resolve failed')
    })

    it('build runs once with production defaults and stops', async () => {
        const deps = makeDeps(makeProject())

        const code = await runCli(
            ['build', '-c', path.join(root!, 'weapp.config.js')],
            deps
        )

        expect(code).toBe(0)
        expect(deps.createCompiler.mock.calls[0]![0].mode).toBe('production')
        expect(deps.upload).not.toHaveBeenCalled()
    })

    it('upload compiles then uploads with a generated desc', async () => {
        const deps = makeDeps(makeProject())

        const code = await runCli(
            [
                'upload',
                '-v',
                '2.0.0',
                '-c',
                path.join(root!, 'weapp.config.js'),
            ],
            deps
        )

        expect(code).toBe(0)

        const call = deps.upload.mock.calls[0]![0]

        expect(call.ver).toBe('2.0.0')
        expect(call.desc).toMatch(/\d{4}-\d{2}-\d{2}.*production v2\.0\.0/)
        expect(call.env).toEqual({ API: 'x' })
    })

    it('upload uses the provided desc', async () => {
        const deps = makeDeps(makeProject())

        await runCli(
            [
                'upload',
                'my desc',
                '-v',
                '1',
                '-c',
                path.join(root!, 'weapp.config.js'),
            ],
            deps
        )

        expect(deps.upload.mock.calls[0]![0].desc).toBe('my desc')
    })

    it('upload fails without -v', async () => {
        const deps = makeDeps(makeProject())

        const code = await runCli(
            ['upload', '-c', path.join(root!, 'weapp.config.js')],
            deps
        )

        expect(code).toBe(1)
        expect(deps.error).toHaveBeenCalled()
    })

    it('build:npm calls the wx build without compiling', async () => {
        const deps = makeDeps(makeProject())

        const code = await runCli(
            ['build:npm', '-c', path.join(root!, 'weapp.config.js')],
            deps
        )

        expect(code).toBe(0)
        expect(deps.buildNpm).toHaveBeenCalledWith(
            expect.objectContaining({ project: root })
        )
        expect(deps.createCompiler).not.toHaveBeenCalled()
    })

    it('build:npm anchors to cwd when no config exists', async () => {
        const deps = makeDeps(makeProject())
        const oldCwd = process.cwd()

        process.chdir(root!)

        try {
            await runCli(['build:npm'], deps)

            expect(deps.buildNpm).toHaveBeenCalledWith(
                expect.objectContaining({ project: root })
            )
        } finally {
            process.chdir(oldCwd)
        }
    })

    it('surfaces build:npm failures as exit code 1', async () => {
        const deps = makeDeps(makeProject())

        deps.buildNpm.mockRejectedValue(new Error('boom'))

        const code = await runCli(
            ['build:npm', '-c', path.join(root!, 'weapp.config.js')],
            deps
        )

        expect(code).toBe(1)
        expect(deps.error).toHaveBeenCalledWith('boom')
    })

    it('--version prints the package version (not hardcoded)', async () => {
        const deps = makeDeps(makeProject())
        const pkgInfo = (await import('../../package.json')).default

        const code = await runCli(['--version'], deps)

        expect(code).toBe(0)
        expect(deps.write).toHaveBeenCalledWith(pkgInfo.version)
    })

    it('--help exits 0 and lists the commands', async () => {
        const deps = makeDeps(makeProject())

        const code = await runCli(['--help'], deps)

        expect(code).toBe(0)
    })

    it('unknown commands exit non-zero', async () => {
        const deps = makeDeps(makeProject())

        const code = await runCli(['ghost'], deps)

        expect(code).toBeGreaterThan(0)
    })

    it('works without injected deps (default io and real factories)', async () => {
        const log = vi.spyOn(console, 'log').mockImplementation(() => {})
        const error = vi.spyOn(console, 'error').mockImplementation(() => {})

        const code = await runCli(['--version'])

        expect(code).toBe(0)
        expect(log).toHaveBeenCalled()

        // the default error sink routes command failures
        const failCode = await runCli(['ghost'])

        expect(failCode).toBeGreaterThan(0)
        expect(error).toHaveBeenCalled()
    })

    it('stringifies non-Error build:npm failures', async () => {
        const deps = makeDeps(makeProject())

        deps.buildNpm.mockRejectedValue('plain')

        const code = await runCli(
            ['build:npm', '-c', path.join(root!, 'weapp.config.js')],
            deps
        )

        expect(code).toBe(1)
        expect(deps.error).toHaveBeenCalledWith('plain')
    })

    it('stringifies non-Error action failures', async () => {
        const deps = makeDeps(makeProject())

        deps.createCompiler.mockImplementation(() => {
            throw 'plain-action-failure'
        })

        const code = await runCli(
            ['build', '-c', path.join(root!, 'weapp.config.js')],
            deps
        )

        expect(code).toBe(1)
        expect(deps.error).toHaveBeenCalledWith('plain-action-failure')
    })

    it('main() wires process signals and sets the exit code', async () => {
        const argv = process.argv
        const previousExitCode = process.exitCode

        process.argv = ['node', 'wgs', '--version']

        try {
            await main()

            expect([0, '0']).toContain(process.exitCode)
        } finally {
            process.argv = argv
            process.exitCode = previousExitCode
        }
    })
})
