import path from 'node:path'
import { createRequire } from 'node:module'

import { Command, CommanderError } from 'commander'

import { dateFormat } from './utils/date-format.js'
import { buildNpm as wxBuildNpm, upload as wxUpload } from './wx-tool/index.js'
import { WeappCompiler, createWeappCompiler } from './compiler.js'
import { resolveWeappOptions, type WeappArgs } from './config/resolve.js'

const require = createRequire(import.meta.url)
const pkgInfo = require('../package.json') as { version: string }

export interface CliDeps {
    write?: (message: string) => void
    error?: (message: string) => void
    /** Set to false in tests to skip signal wiring entirely. */
    attachSignals?: boolean
    /** Signal source; main() passes `process`. */
    signals?: { once(name: string, fn: () => void): unknown }
    /** Called with the running compiler in serve mode (used by tests). */
    onStart?: (compiler: WeappCompiler) => void
    version?: string
    /** Test seams. */
    createCompiler?: (
        options: Parameters<typeof createWeappCompiler>[0]
    ) => WeappCompiler
    upload?: typeof wxUpload
    buildNpm?: typeof wxBuildNpm
}

interface CommonOptions {
    config: string
    mode: string
    buildNpm: boolean
}

async function startServe(
    options: CommonOptions,
    deps: Required<Pick<CliDeps, 'write' | 'error'>> & CliDeps
): Promise<number> {
    const compiler = await create(options, deps)

    await compiler.watch()

    deps.onStart?.(compiler)

    if (deps.attachSignals !== false) {
        const signals = deps.signals!
        let stopping = false

        await new Promise<void>((resolve) => {
            const shutdown = (): void => {
                if (stopping) {
                    return
                }

                stopping = true
                void compiler.stop().then(resolve)
            }

            signals.once('SIGINT', shutdown)
            signals.once('SIGTERM', shutdown)
        })
    }

    return 0
}

async function create(
    options: Partial<CommonOptions>,
    deps: Required<Pick<CliDeps, 'write' | 'error'>> & CliDeps
): Promise<WeappCompiler> {
    const args: WeappArgs = { ...options }

    const resolved = await resolveWeappOptions(args, {
        Compiler: deps.createCompiler ?? createWeappCompiler,
    })

    return (deps.createCompiler ?? createWeappCompiler)(resolved)
}

async function startBuild(
    options: CommonOptions,
    deps: Required<Pick<CliDeps, 'write' | 'error'>> & CliDeps
): Promise<number> {
    const compiler = await create(options, deps)

    try {
        await compiler.run()
        return 0
    } finally {
        await compiler.stop()
    }
}

export async function runCli(
    argv: string[],
    deps: CliDeps = {}
): Promise<number> {
    const write = deps.write ?? ((message: string) => console.log(message))
    const error = deps.error ?? ((message: string) => console.error(message))
    const io = { write, error }

    const program = new Command()

    program
        .name('wgs')
        .version(deps.version ?? pkgInfo.version)
        .showHelpAfterError('(run "wgs --help" for usage)')
        .configureOutput({
            writeOut: (chunk) => write(chunk.trimEnd()),
            writeErr: (chunk) => error(chunk.trimEnd()),
        })
        .exitOverride()

    const addCommon = (command: Command): Command =>
        command
            .option(
                '-c, --config <file>',
                'configuration file path',
                'weapp.config.js'
            )
            .option('-m, --mode <mode>', 'compile mode')

    let exitCode = 0

    addCommon(
        program
            .command('serve', { isDefault: true })
            .description('compile once, then watch the source tree (default)')
    )
        .option('--no-build-npm', 'disable automatic building of NPM')
        .action(async (options: CommonOptions) => {
            exitCode = await startServe(
                { ...options, mode: options.mode ?? 'development' },
                { ...io, ...deps }
            )
        })

    addCommon(program.command('build').description('compile once and exit'))
        .option('--no-build-npm', 'disable automatic building of NPM')
        .action(async (options: CommonOptions) => {
            exitCode = await startBuild(
                { ...options, mode: options.mode ?? 'production' },
                { ...io, ...deps }
            )
        })

    program
        .command('upload [desc]')
        .description(
            'compile once and upload via miniprogram-ci or devtools cli'
        )
        .requiredOption('-v, --ver <string>', 'version number')
        .option('--verbose', 'loglevel verbose (1.0 spelled this -dd)')
        .option(
            '-c, --config <file>',
            'configuration file path',
            'weapp.config.js'
        )
        .option('-m, --mode <mode>', 'compile mode', 'production')
        .action(
            async (
                desc: string | undefined,
                options: CommonOptions & { ver: string; verbose?: boolean }
            ) => {
                const uploadFn = deps.upload ?? wxUpload
                const args: WeappArgs = {
                    ...options,
                    desc:
                        desc ??
                        `${dateFormat(Date.now())} ${options.mode} v${options.ver}`,
                }

                const compiler = await create(args, { ...io, ...deps })

                try {
                    await compiler.run()

                    await uploadFn({
                        ver: options.ver,
                        desc: String(args.desc),
                        verbose: options.verbose ?? false,
                        project: path.dirname(options.config),
                        env: compiler.options.env,
                    })

                    exitCode = 0
                } finally {
                    await compiler.stop()
                }
            }
        )

    program
        .command('build:npm')
        .description('build miniprogram_npm without compiling')
        .option(
            '-c, --config <file>',
            'configuration file path',
            'weapp.config.js'
        )
        .option('-m, --mode <mode>', 'compile mode', 'production')
        .action(async (options: { config: string; mode: string }) => {
            const buildNpmFn = deps.buildNpm ?? wxBuildNpm

            try {
                const resolved = await resolveWeappOptions({ ...options })

                await buildNpmFn({
                    // resolveWeappOptions anchors the config path (or the conventional
                    // default) before this point
                    project: path.dirname(resolved.config),
                    env: resolved.env,
                })

                exitCode = 0
            } catch (err) {
                error(err instanceof Error ? err.message : String(err))
                exitCode = 1
            }
        })

    try {
        await program.parseAsync(argv, { from: 'user' })
    } catch (err) {
        if (err instanceof CommanderError) {
            // help/version exits carry their own (0/1) codes; messages were
            // already routed through the configured output
            return err.exitCode
        }

        error(err instanceof Error ? err.message : String(err))
        return 1
    }

    return exitCode
}

export async function main(): Promise<void> {
    process.exitCode = await runCli(process.argv.slice(2), { signals: process })
}
