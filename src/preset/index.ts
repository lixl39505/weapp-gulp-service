import type { PipeRef, TaskConfig } from 'deltic'

import type {
    CssPipeOptions,
    JsonPipeOptions,
    LessPipeOptions,
    SfcPipeOptions,
    WxssPipeOptions,
} from '../pipes/types.js'
import type { WeappOptions } from '../types.js'

/**
 * The out-of-the-box weapp task table — 1.0's defaults, expressed as deltic
 * tasks. Extension-to-task is 1:1 (`vue`/`mp` stay separate so incremental
 * compiles map by extname; `img` extensions are routed via `taskTypeMap`).
 * `compileAncestor` matches 1.0: only `less` and `img`.
 */
export function weappTasks(options: WeappOptions): Record<string, TaskConfig> {
    const less: LessPipeOptions = {
        lessVar: options.lessVar,
        less: options.less,
        px2rpx: options.px2rpx,
        base64: options.base64,
        extname: options.css.rename.extname,
    }
    const css: CssPipeOptions = {
        px2rpx: options.px2rpx,
        base64: options.base64,
        extname: options.css.rename.extname,
    }
    const wxss: WxssPipeOptions = { base64: options.base64 }
    const json: JsonPipeOptions = { platform: 'wx' }
    const json5: JsonPipeOptions = { json5: true, platform: 'wx' }
    const sfc: SfcPipeOptions = {
        tagAlias: options.mp.tagAlias,
        alias: options.alias,
        less,
        css,
        wxss,
        json,
    }

    const lessRef: PipeRef = ['less', less]
    const cssRef: PipeRef = ['css', css]
    const wxssRef: PipeRef = ['wxss', wxss]
    const jsonRef: PipeRef = ['json', json]
    const json5Ref: PipeRef = ['json5', json5]
    const sfcRef: PipeRef = ['sfc', sfc]

    return {
        wxml: {
            test: '**/*.wxml',
            use: ['wxml'],
        },
        js: {
            test: '**/*.js',
            use: ['js'],
        },
        wxs: {
            test: '**/*.wxs',
            use: ['wxs'],
        },
        less: {
            test: '**/*.less',
            use: [lessRef],
            compileAncestor: true,
        },
        css: {
            test: '**/*.css',
            use: [cssRef],
        },
        wxss: {
            test: '**/*.wxss',
            use: [wxssRef],
        },
        img: {
            test: `**/*.{${options.imgType.join(',')}}`,
            use: ['depend'],
            compileAncestor: true,
        },
        json: {
            test: '**/*.json',
            use: [jsonRef],
        },
        json5: {
            test: '**/*.json5',
            use: [json5Ref],
        },
        mp: {
            test: '**/*.mp',
            use: [sfcRef],
        },
        vue: {
            test: '**/*.vue',
            use: [sfcRef],
        },
    }
}
