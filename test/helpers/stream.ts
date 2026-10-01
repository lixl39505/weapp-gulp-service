import path from 'node:path'

import { Readable, Writable, type Transform } from 'streamx'
import { vi } from 'vitest'
import Vinyl from 'vinyl'

export interface FileOverrides {
    context?: Record<string, unknown>
}

export function makeFile(
    filePath: string,
    contents = '',
    base = '/project/src',
    overrides: FileOverrides = {}
): Vinyl {
    const file = new Vinyl({
        base,
        path: filePath,
        contents: Buffer.from(contents),
    }) as Vinyl & { context?: unknown }

    if (overrides.context !== undefined) {
        file.context = overrides.context
    }

    return file as Vinyl
}

export interface ContextOverrides {
    alias?: Record<string, string>
    env?: Record<string, string>
    baseDir?: string
    sourceDir?: string
    outputDir?: string
    depend?: (file: Vinyl, options?: { matchers?: unknown[] }) => unknown
    addDep?: (file: unknown, paths: string | readonly string[]) => void
    customDeps?: string[]
    withoutOptions?: boolean
}

export function makeContext(
    overrides: ContextOverrides = {}
): Record<string, unknown> {
    const baseDir = overrides.baseDir ?? path.resolve('/project')
    const sourceDir = overrides.sourceDir ?? path.resolve(baseDir, 'src')
    const outputDir = overrides.outputDir ?? path.resolve(baseDir, 'dist')

    const resolve = (request: string, relativePath?: string): string => {
        const pwd =
            relativePath === undefined ? sourceDir : path.dirname(relativePath)

        if (path.isAbsolute(request)) {
            return path.join(sourceDir, request)
        }

        if (request.startsWith('./') || request.startsWith('../')) {
            return path.resolve(pwd, request)
        }

        return path.resolve(sourceDir, request)
    }

    const customDeps = overrides.customDeps ?? []

    return {
        options: overrides.withoutOptions
            ? undefined
            : {
                  alias: overrides.alias ?? { '@': sourceDir },
                  env: overrides.env ?? { API: 'https://api.example.com' },
                  baseDir,
                  sourceDir,
                  outputDir,
              },
        baseDir,
        sourceDir,
        outputDir,
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
        resolve,
        depend: overrides.depend ?? vi.fn(),
        addDep: overrides.addDep ?? vi.fn(),
        originalPath: undefined,
        customDeps,
        depended: false,
        session: {
            files: [],
            outputs: [],
            total: 0,
            totalCache: 0,
            totalHit: 0,
        },
        ...overrides,
    }
}

export function withContext(file: Vinyl, context: unknown): Vinyl {
    ;(file as unknown as { context: unknown }).context = context

    return file
}

/** vinyl contents as text (contents are always Buffer in these pipelines). */
export function text(file: Vinyl): string {
    return (file.contents as Buffer).toString()
}

export interface StageResult {
    files: Vinyl[]
    error: Error | null
}

// Pushes several inputs through a stage chain and collects the outputs.
export async function runStages(
    stages: Transform | Transform[],
    items: Vinyl[]
): Promise<StageResult> {
    const pipeline = Array.isArray(stages) ? stages : [stages]
    const out: Vinyl[] = []
    let error: Error | null = null

    await new Promise<void>((resolve) => {
        const source = new Readable({ read: () => {} })
        const sink = new Writable({
            write: (chunk: unknown, callback: (err: Error | null) => void) => {
                out.push(chunk as Vinyl)
                callback(null)
            },
        })
        const fail = (err: Error) => {
            error = err
            resolve()
        }

        source.on('error', fail)
        sink.on('error', fail)

        for (const stage of pipeline) {
            stage.on('error', fail)
        }

        source.pipe(pipeline[0]!)

        for (let index = 1; index < pipeline.length; index += 1) {
            pipeline[index - 1]!.pipe(pipeline[index]!)
        }

        pipeline.at(-1)!.pipe(sink)
        sink.on('finish', () => resolve())

        for (const item of items) {
            source.push(item)
        }

        source.push(null)
    })

    return { files: out, error }
}
