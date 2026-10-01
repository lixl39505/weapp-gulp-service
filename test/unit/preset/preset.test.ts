import { describe, expect, it } from 'vitest'

import { weappTasks } from '../../../src/preset/index.js'
import { createDefaults } from '../../../src/config/defaults.js'
import { WEAPP_PIPES } from '../../../src/pipes/index.js'

describe('weappTasks', () => {
    it('matches the 1.0 task table incl. compileAncestor', () => {
        const tasks = weappTasks(createDefaults())

        expect(Object.keys(tasks).sort()).toEqual(
            [
                'css',
                'img',
                'js',
                'json',
                'json5',
                'less',
                'mp',
                'vue',
                'wxml',
                'wxs',
                'wxss',
            ].sort()
        )
        expect(tasks.less!.compileAncestor).toBe(true)
        expect(tasks.img!.compileAncestor).toBe(true)
        expect(tasks.js!.compileAncestor).toBeUndefined()
        expect(tasks.json!.compileAncestor).toBeUndefined()
        expect(tasks.img!.use).toEqual(['depend'])
        expect(tasks.js!.use).toEqual(['js'])
        expect(tasks.img!.test).toBe('**/*.{jpg,png,svg,webp,gif}')
    })

    it('bakes merged options into the pipe refs', () => {
        const options = createDefaults()

        options.imgType = ['png']
        options.lessVar = 'src/styles/v.less'
        options.css.rename.extname = '.wxss'
        options.mp.tagAlias = { i: 'view' }

        const tasks = weappTasks(options)
        const lessUse = tasks.less!.use as Array<
            [string, Record<string, unknown>]
        >

        expect(lessUse[0]![0]).toBe('less')
        expect(lessUse[0]![1]).toMatchObject({
            lessVar: 'src/styles/v.less',
            extname: '.wxss',
        })

        const sfcUse = tasks.vue!.use as Array<
            [string, Record<string, unknown>]
        >

        expect(sfcUse[0]![0]).toBe('sfc')
        expect(sfcUse[0]![1]).toMatchObject({ tagAlias: { i: 'view' } })
        expect(tasks.img!.test).toBe('**/*.{png}')
    })

    it('registers every weapp pipe name in WEAPP_PIPES', () => {
        expect(Object.keys(WEAPP_PIPES).sort()).toEqual(
            [
                'css',
                'json',
                'json5',
                'less',
                'sfc',
                'wxml',
                'wxs',
                'wxss',
            ].sort()
        )

        // registry entries are callable and return at least one stream stage
        for (const [name, factory] of Object.entries(WEAPP_PIPES)) {
            const options =
                name === 'wxml' || name === 'wxs'
                    ? undefined
                    : {
                          lessVar: '',
                          less: {},
                          px2rpx: { times: 2 },
                          base64: {
                              baseDir: '',
                              exclude: [],
                              maxImageSize: 8192,
                              deleteAfterEncoding: false,
                              debug: false,
                          },
                          extname: '.wxss',
                          tagAlias: {},
                          alias: {},
                          json5: name === 'json5',
                          json: {},
                      }

            const stages = factory(options as never)

            expect(Array.isArray(stages) ? stages.length : 1).toBeGreaterThan(0)
        }

        // registry adapters must also tolerate missing options
        for (const name of [
            'wxml',
            'wxs',
            'less',
            'css',
            'wxss',
            'json',
            'json5',
            'sfc',
        ]) {
            expect(WEAPP_PIPES[name]!()).toBeTruthy()
        }
    })
})
