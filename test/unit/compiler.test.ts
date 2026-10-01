import { describe, expect, it, vi } from 'vitest'

import {
    toUserConfig,
    WeappCompiler,
    createWeappCompiler,
} from '../../src/compiler.js'
import { createDefaults } from '../../src/config/defaults.js'
import type { WeappOptions } from '../../src/types.js'

function makeOptions(): WeappOptions {
    const options = createDefaults()

    options.config = '/project/weapp.config.js'

    return options
}

describe('toUserConfig', () => {
    it('maps weapp options onto the deltic UserConfig', () => {
        const options = makeOptions()
        const config = toUserConfig(options)

        expect(config.baseDir).toBe('/project')
        expect(config.source).toBe('src')
        expect(config.output).toBe('dist')
        expect(config.cacheDir).toBe('.wgs')
        expect(config.loadEnv).toBe(false)
        expect(config.mode).toBe('development')
        expect(config.taskTypeMap).toEqual({
            jpg: 'img',
            png: 'img',
            svg: 'img',
            webp: 'img',
            gif: 'img',
        })

        const use = config.tasks!.less!.use as Array<[string, unknown]>

        expect(use[0]![0]).toBe('less')
        expect(Object.keys(config.pipes!).sort()).toContain('sfc')
        expect(config.plugins!.map((plugin) => plugin.name)).toEqual([
            'compile-cache',
            'dep-graph',
            'clean',
        ])
    })

    it('derives taskTypeMap from imgType', () => {
        const options = makeOptions()

        options.imgType = ['png']

        expect(toUserConfig(options).taskTypeMap).toEqual({ png: 'img' })
    })

    it('anchors baseDir to cwd when no config file was found', () => {
        const options = makeOptions()

        options.config = ''

        expect(toUserConfig(options).baseDir).toBe(process.cwd())
    })
})

describe('WeappCompiler facade', () => {
    it('delegates and wires the npm build into run/watch/stop', async () => {
        const compiler = createWeappCompiler(makeOptions())

        const run = vi
            .spyOn(compiler.engine, 'run')
            .mockResolvedValue({ total: 0 } as never)
        const watch = vi
            .spyOn(compiler.engine, 'watch')
            .mockResolvedValue({ total: 0 } as never)
        const stop = vi
            .spyOn(compiler.engine, 'stop')
            .mockResolvedValue(undefined)
        const schedule = vi
            .spyOn(compiler.engine, 'schedule')
            .mockImplementation(async (fn: () => unknown) => await fn())

        await compiler.ready
        await compiler.run()

        expect(run).toHaveBeenCalled()
        expect(schedule).toHaveBeenCalled()

        await compiler.watch()

        expect(watch).toHaveBeenCalled()

        await compiler.stop()

        expect(stop).toHaveBeenCalled()
    })

    it('delegates query/save/incrementCompile/on/capability/logger', async () => {
        const compiler = new WeappCompiler(makeOptions())

        await compiler.ready

        // save queues into SQLite (flushed at finish/stop) — verify delegation
        const save = vi.spyOn(compiler.engine, 'save')

        compiler.save('k', 'v')

        expect(save).toHaveBeenCalledWith('k', 'v')
        expect(compiler.query('k', 'd')).toBe('v')
        expect(typeof compiler.logger.info).toBe('function')
        expect(typeof compiler.on).toBe('function')
        expect(typeof compiler.capability('cleanExpired')).toBe('function')
        expect(compiler.npmList.length).toBeGreaterThan(0)

        const increment = vi
            .spyOn(compiler.engine, 'incrementCompile')
            .mockResolvedValue(undefined)

        await compiler.incrementCompile(['/project/src/a.js'], false)

        expect(increment).toHaveBeenCalledWith(['/project/src/a.js'], false)

        // the trace parameter defaults to true
        await compiler.incrementCompile(['/project/src/b.js'])

        expect(increment).toHaveBeenLastCalledWith(['/project/src/b.js'], true)

        const schedule = vi
            .spyOn(compiler.engine, 'schedule')
            .mockResolvedValue('worked')

        await expect(compiler.schedule(async () => 'worked')).resolves.toBe(
            'worked'
        )
        expect(schedule).toHaveBeenCalled()

        // run() tolerates npm-build orchestration failures
        schedule.mockRejectedValue(new Error('schedule blew up'))

        await expect(compiler.run()).resolves.toBeInstanceOf(Object)

        const unsubscribe = vi.fn()
        const on = vi.spyOn(compiler.engine, 'on').mockReturnValue(unsubscribe)

        expect(compiler.on('afterCompile', () => {})).toBe(unsubscribe)
        expect(on).toHaveBeenCalled()
    })
})
