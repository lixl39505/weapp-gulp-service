import { Readable, Transform, Writable } from 'streamx'

import { wrapPipeError } from 'deltic'
import type { BufferVinyl, Vinyl } from 'deltic'

/**
 * Async pipe core: the transform returns the REPLACEMENT set of vinyl files
 * (empty array drops the original). Emitted files must be final — they flow
 * through the remaining pipes and dest untouched. Derivations of an input
 * file should be created with deltic's `deriveFile` so they share its
 * context.
 */
export function createAsyncTransform(
    pipe: string,
    transform: (file: BufferVinyl) => Promise<Vinyl[]>
): Transform {
    const stream = new Transform({
        transform: (
            chunk: unknown,
            callback: (err: Error | null, data?: unknown) => void
        ) => {
            const file = chunk as Vinyl

            if (typeof file?.isNull === 'function' && file.isNull()) {
                callback(null, file)
                return
            }

            if (typeof file?.isStream === 'function' && file.isStream()) {
                callback(
                    wrapPipeError(
                        pipe,
                        file,
                        new Error('streaming contents are not supported')
                    )
                )
                return
            }

            transform(file as BufferVinyl).then(
                (files) => {
                    for (const item of files) {
                        stream.push(item)
                    }

                    callback(null)
                },
                (error: unknown) => {
                    callback(wrapPipeError(pipe, file, error))
                }
            )
        },
    })

    return stream
}

export interface RunResult {
    files: Vinyl[]
    error: Error | null
}

// The in-memory source never yields lazily (all items are pushed up front,
// terminated by an explicit end), so the pull callback is a documented no-op.
export function noopRead(): void {}

/**
 * Runs a set of stages over a single in-memory vinyl and collects the
 * outputs — the composition primitive the self-contained pipes use to route
 * slices (SFC) through deltic pipes without nested task machinery.
 */
export async function runPipeline(
    stages: Transform | Transform[],
    file: Vinyl
): Promise<RunResult> {
    const pipeline = Array.isArray(stages) ? stages : [stages]
    const out: Vinyl[] = []
    let error: Error | null = null

    await new Promise<void>((resolve) => {
        const source = new Readable({ read: noopRead })
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

        source.push(file)
        source.push(null)
    })

    return { files: out, error }
}
