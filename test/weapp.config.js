module.exports = function () {
    return {
        env: {
            NODE_ENV: 'production',
        },
        lessVar: './dark.less',
        alias: {
            _c: './src/components',
        },
    }
}
