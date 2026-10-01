// v2: env 不再写入 process.env；需要动态取值时使用 callback。
// 也支持 weapp.config.ts（jiti 直接加载）。
module.exports = {
    alias: {
        '@': './src',
        _c: './src/components', // 纯组件
        _u: './src/utils',
    },
    // 全局less变量：env 已在 callback 之前解析完成
    callback(options) {
        options.lessVar = `src/styles/${options.env.APP_THEME}.less`
    },
}
