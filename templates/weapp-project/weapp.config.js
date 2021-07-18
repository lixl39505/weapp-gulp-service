module.exports = {
    alias: {
        '@': './src',
        _c: './src/components', // 纯组件
        _u: './src/utils',
    },
    // 全局less变量
    lessVar: `src/styles/${process.env.APP_THEME}.less`,
}
