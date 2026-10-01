import type { WeappOptions } from '../types.js'

/**
 * Out-of-the-box weapp options — 1.0 defaults, minus `tasks` (see
 * `weappTasks`) and `callback`. A fresh object per call; callers merge user
 * config over it.
 */
export function createDefaults(): WeappOptions {
    return {
        env: {},
        args: {},
        app: {},
        config: '',
        mode: 'development',
        output: 'dist',
        source: 'src',
        ignore: [],
        imgType: ['jpg', 'png', 'svg', 'webp', 'gif'],
        alias: {
            '@': './src',
        },
        css: {
            rename: {
                extname: '.wxss',
            },
        },
        lessVar: '',
        less: {
            javascriptEnabled: true,
        },
        px2rpx: {
            times: 2,
        },
        base64: {
            baseDir: '',
            exclude: ['alicdn'],
            maxImageSize: 8 * 1024,
            deleteAfterEncoding: false,
            debug: false,
        },
        mp: {
            tagAlias: {
                div: 'view',
                span: 'text',
            },
        },
        buildNpm: true,
    }
}
