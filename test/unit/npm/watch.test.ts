import { describe, expect, it, vi } from 'vitest'

const watch = vi.fn()

vi.mock('chokidar', () => ({
    watch: (...args: unknown[]) => watch(...args),
}))

const { watchNpm } = await import('../../../src/npm/watch.js')
import { createDefaults } from '../../../src/config/defaults.js'

describe('watchNpm', () => {
    it('watches the npm entry files and reruns the build on changes', async () => {
        const fsWatcher = {
            close: vi.fn(async () => undefined),
        }
        const on = vi.fn((_event: string, handler: () => void) => fsWatcher)

        watch.mockReturnValue({ on, close: fsWatcher.close })

        const engine = {
            schedule: async (fn: () => unknown) => await fn(),
            // hash miss → the build runs (the wx failure is tolerated upstream)
            query: () => null,
            save: vi.fn(),
            logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
        }
        const options = {
            ...createDefaults(),
            config: '/project/weapp.config.js',
            env: {},
        }
        const npmList = [
            { path: '/project/dist/package.json', output: '/project/dist' },
        ]

        const watcher = watchNpm(engine as never, options as never, npmList)

        expect(watch).toHaveBeenCalledWith(['/project/dist/package.json'], {
            ignoreInitial: true,
        })

        // fire the watcher event → build reruns through the engine queue
        on.mock.calls[0]![1]()

        // the build chain is fire-and-forget — flush before asserting
        await new Promise((resolve) => setImmediate(resolve))
        await new Promise((resolve) => setImmediate(resolve))

        expect(engine.save).toHaveBeenCalled()

        // orchestration failures inside the fire-and-forget chain are swallowed
        const failingEngine = {
            schedule: async () => {
                throw new Error('schedule exploded')
            },
            query: () => null,
            save: vi.fn(),
            logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
        }

        watchNpm(failingEngine as never, options as never, npmList)
        on.mock.calls[1]![1]()

        for (let index = 0; index < 4; index += 1) {
            await new Promise((resolve) => setImmediate(resolve))
        }

        await watcher.close()
    })
})
