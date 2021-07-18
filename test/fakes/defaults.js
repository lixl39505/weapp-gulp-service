const path = require('path')

module.exports = function () {
    const config = path.join(__dirname, '../weapp.config.js'),
        baseDir = path.dirname(config) // test根目录

    const options = {
        // config file dir
        config,
        // 输出目录
        output: 'dist',
        // 源码目录
        source: 'src',
        // env
        env: {
            APP_PUBLICK_PATH: '/',
            CUSTOM_TAB_BAR: true,
        },
        // 图片类型
        imgType: ['jpg', 'png', 'svg', 'webp', 'gif'],
        // gulp-less
        less: {
            javascriptEnabled: true,
        },
        // gulp-less-var
        lessVar: path.join(baseDir, './fixture/less/variables.less'),
        // gulp-alias
        alias: {
            '@': path.join(baseDir, './fixture'),
        },
        // postcss-px2rpx
        px2rpx: {
            times: 2, // px -> rpx 转换倍数
        },
        // base64选项
        base64: {
            baseDir: '', // 默认相对于css文件路径
            exclude: ['alicdn'],
            maxImageSize: 8 * 1024, // 8kb,
            deleteAfterEncoding: false, //
            debug: false, // 是否开启调试
        },
    }

    return options
}
