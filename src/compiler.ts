import path from 'node:path'
import { createRequire } from 'node:module'

import {
    cleanPlugin,
    compileCachePlugin,
    depGraphPlugin,
    Compiler as DelticCompiler,
    type Capabilities,
    type Compiler as DelticCompilerType,
    type HookHandler,
    type HookName,
    type SessionContext,
    type Unsubscribe,
    type UserConfig,
} from 'deltic'
import type { FSWatcher } from 'chokidar'

import { WEAPP_PIPES } from './pipes/index.js'
import { weappTasks } from './preset/index.js'
import {
    maybeBuildNpm,
    resolveNpmList,
    watchNpm,
    type NpmListEntry,
} from './npm/index.js'
import type { WeappOptions } from './types.js'

const require = createRequire(import.meta.url)
const pkgInfo = require('../package.json') as { version: string }

/** Builds the deltic UserConfig for a resolved weapp options object. */
export function toUserConfig(options: WeappOptions): UserConfig {
    // multiple image extensions share the single `img` task
    const taskTypeMap: Record<string, string> = {}

    for (const ext of options.imgType) {
        taskTypeMap[ext] = 'img'
    }

    return {
        baseDir:
            options.config !== ''
                ? path.dirname(options.config)
                : process.cwd(),
        source: options.source,
        output: options.output,
        cacheDir: '.wgs',
        alias: options.alias,
        mode: options.mode,
        env: options.env,
        // the weapp env chain is already resolved into options.env
        loadEnv: false,
        ignore: options.ignore,
        taskTypeMap,
        tasks: weappTasks(options),
        pipes: WEAPP_PIPES,
        plugins: [
            compileCachePlugin({ extraDeps: () => [pkgInfo.version] }),
            depGraphPlugin(),
            cleanPlugin(),
        ],
    }
}

/**
 * Facade over the deltic compiler — composition, not inheritance. Adds the
 * weapp layer: task table + pipes + plugins via `toUserConfig`, and the
 * auto npm build on the run/watch lifecycle.
 */
export class WeappCompiler {
    readonly engine: DelticCompilerType
    readonly options: WeappOptions
    readonly npmList: NpmListEntry[]

    #npmWatcher: FSWatcher | null = null

    constructor(options: WeappOptions) {
        this.options = options
        this.engine = new DelticCompiler(toUserConfig(options))
        this.npmList = resolveNpmList(options)
    }

    get ready(): Promise<this> {
        return this.engine.ready.then(() => this)
    }

    get logger(): DelticCompilerType['logger'] {
        return this.engine.logger
    }

    /** Full compile + auto npm build. */
    async run(): Promise<SessionContext> {
        const session = await this.engine.run()

        await maybeBuildNpm(this.engine, this.options, this.npmList).catch(
            () => {}
        )

        return session
    }

    /** Full compile + watch, including the npm package.json watcher. */
    async watch(): Promise<SessionContext> {
        const session = await this.engine.watch()

        this.#npmWatcher = watchNpm(this.engine, this.options, this.npmList)

        return session
    }

    async stop(): Promise<void> {
        await this.#npmWatcher?.close()
        this.#npmWatcher = null

        await this.engine.stop()
    }

    incrementCompile(
        filePaths: string | readonly string[],
        trace = true
    ): Promise<void> {
        return this.engine.incrementCompile(filePaths, trace)
    }

    schedule<T>(fn: () => T | Promise<T>): Promise<T> {
        return this.engine.schedule(fn)
    }

    query<T>(key: string, defaults: T): T {
        return this.engine.query(key, defaults)
    }

    save(key: string, value: unknown): void {
        this.engine.save(key, value)
    }

    on<K extends HookName>(name: K, handler: HookHandler<K>): Unsubscribe {
        return this.engine.on(name, handler)
    }

    capability<K extends keyof Capabilities>(name: K): Capabilities[K] {
        return this.engine.capability(name)
    }
}

export function createWeappCompiler(options: WeappOptions): WeappCompiler {
    return new WeappCompiler(options)
}
