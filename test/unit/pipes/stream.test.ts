import path from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import { deriveFile, envPipe, type BufferVinyl } from 'deltic'

import {
    createAsyncTransform,
    noopRead,
    runPipeline,
} from '../../../src/pipes/stream.js'
import { makeContext, makeFile, runStages, text } from '../../helpers/stream.js'

const context = makeContext()
const ctxFile = (
    filePath: string,
    contents = 'x'
): ReturnType<typeof makeFile> =>
    makeFile(filePath, contents, '/project/src', { context })

describe('createAsyncTransform', () => {
    it('passes null files through without invoking the body', async () => {
        const body = vi.fn(async () => [])
        const file = makeFile('/project/src/a.js', '')
        ;(file as unknown as { contents: unknown }).contents = null

        const { files, error } = await runStages(
            createAsyncTransform('p', body),
            [file]
        )

        expect(error).toBeNull()
        expect(files).toHaveLength(1)
        expect(body).not.toHaveBeenCalled()
    })

    it('rejects streaming files', async () => {
        const file = makeFile('/project/src/a.js', '')
        ;(file as unknown as { isStream(): boolean }).isStream = () => true

        const { files, error } = await runStages(
            createAsyncTransform('p', async () => []),
            [file]
        )

        expect(files).toHaveLength(0)
        expect(error).toBeInstanceOf(Error)
        expect((error as Error | null)?.message).toContain('streaming contents')
    })

    it('emits the replacement set and drops the original when empty', async () => {
        const file = ctxFile(path.join('/project/src', 'a.js'))
        const derived = deriveFile(file as BufferVinyl, {
            path: path.join('/project/src', 'b.js'),
            contents: Buffer.from('derived'),
        })

        const { files, error } = await runStages(
            createAsyncTransform('p', async () => [derived]),
            [file]
        )

        expect(error).toBeNull()
        expect(files).toHaveLength(1)
        expect(files[0]!.path).toBe(derived.path)
    })

    it('wraps rejections with the pipe name and file', async () => {
        const { files, error } = await runStages(
            createAsyncTransform('p', async () => {
                throw new Error('boom')
            }),
            [ctxFile('/project/src/a.js')]
        )

        expect(files).toHaveLength(0)
        expect((error as Error | null)?.message).toContain('[p] boom')
    })

    it('supports multi-file emission in order', async () => {
        const file = ctxFile('/project/src/a.js')

        const { files } = await runStages(
            createAsyncTransform('p', async () => [
                deriveFile(file as BufferVinyl, {
                    path: '/project/src/1.js',
                    contents: Buffer.from('1'),
                }),
                deriveFile(file as BufferVinyl, {
                    path: '/project/src/2.js',
                    contents: Buffer.from('2'),
                }),
            ]),
            [file]
        )

        expect(files.map((item) => path.basename(item.path))).toEqual([
            '1.js',
            '2.js',
        ])
    })

    it('drains large batches (forcing the underlying source read)', async () => {
        const items = Array.from({ length: 32 }, (_, index) =>
            ctxFile(`/project/src/f${index}.js`, `content-${index}`)
        )

        const { files, error } = await runStages(
            createAsyncTransform('p', async (input) => [input as never]),
            items
        )

        expect(error).toBeNull()
        expect(files).toHaveLength(32)

        // the in-memory source never yields lazily; the pull callback is a no-op
        expect(() => noopRead()).not.toThrow()
    })
})

describe('runPipeline', () => {
    it('runs single and chained stages, collecting outputs', async () => {
        const file = ctxFile('/project/src/a.js', 'process.env.API')

        const single = await runPipeline(envPipe(), file)

        expect(single.error).toBeNull()
        expect(text(single.files[0]!)).toContain('"https://api.example.com"')

        const chained = await runPipeline(
            [
                envPipe(),
                createAsyncTransform('upper', async (input) => [
                    deriveFile(input, {
                        path: input.path,
                        contents: Buffer.from(
                            input.contents.toString().toUpperCase()
                        ),
                    }),
                ]),
            ],
            file
        )

        expect(chained.error).toBeNull()
        expect(text(chained.files[0]!)).toContain('HTTPS://API.EXAMPLE.COM')
    })

    it('surfaces stage errors', async () => {
        const result = await runPipeline(
            createAsyncTransform('p', async () => {
                throw new Error('stage-fail')
            }),
            ctxFile('/project/src/a.js')
        )

        expect(result.error).toBeInstanceOf(Error)
        expect(result.files).toHaveLength(0)
    })
})
