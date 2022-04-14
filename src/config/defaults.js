// 默认配置
module.exports = function () {
    return {
        // 运行时环境变量
        env: {},
        // 命令行参数
        args: {},
        // 应用相关配置
        app: {},
        // 配置文件路径
        config: '',
        // 输出目录
        output: 'dist',
        // 源码目录
        source: 'src',
        // 忽略文件
        ignore: [],
        // 图片类型
        imgType: ['jpg', 'png', 'svg', 'webp', 'gif'],
        // 路径别名
        alias: {
            '@': './src',
        },
        // less变量转css变量+js变量
        lessVar: '',
        // less选项
        less: {
            javascriptEnabled: true,
        },
        // postcss-px2rpx选项
        px2rpx: {
            times: 2, // px -> rpx 转换倍数
        },
        // base64选项
        base64: {
            baseDir: '', // 默认相对于css文件路径
            exclude: ['alicdn'],
            maxImageSize: 8 * 1024, // 8kb,
            deleteAfterEncoding: false, // 转换后删除图片文件（慎用，如果一张图片被多次引用，则只有第一次能成功转换）
            debug: false, // 是否开启调试
        },
        // 单文件编译配置
        mp: {
            tagAlias: {
                div: 'view',
                span: 'text',
            },
        },
        // 任务配置
        tasks: {
            wxml: {
                test: `./**/*.wxml`,
                use: ['gulp-wxml'],
            },
            js: {
                test: `./**/*.js`,
                use: ['gulp-js'],
            },
            wxs: {
                test: `./**/*.wxs`,
                use: ['gulp-wxs'],
            },
            less: {
                test: `./**/*.less`,
                use: ['gulp-less'],
                compileAncestor: true,
            },
            css: {
                test: `./**/*.css`,
                use: ['gulp-css'],
            },
            wxss: {
                test: `./**/*.wxss`,
                use: ['gulp-wxss'],
            },
            img: {
                test: ({ imgType }) => `./**/*.{${imgType.join(',')}}`,
                use: ['gulp-img'],
                compileAncestor: true,
            },
            json: {
                test: `./**/*.json`,
                use: ['gulp-json'],
            },
            json5: {
                test: `./**/*.json5`,
                use: ['gulp-json'],
            },
            mp: {
                test: `./**/*.mp`,
                use: ['gulp-mp', 'gulp-mp-concat'],
            },
            vue: {
                test: `./**/*.vue`,
                use: ['gulp-mp', 'gulp-mp-concat'],
            },
        },
    }
}
