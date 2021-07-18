// 是否单测环境
function isBabelRegister(caller) {
    return !!(caller && caller.name === '@babel/register')
}

module.exports = (api) => {
    if (api.caller(isBabelRegister)) {
        // 单测环境不缓存
        api.cache(false)
    }

    const options = {
        plugins: [
            '@babel/plugin-syntax-dynamic-import', // 支持import()动态导入
            [
                'module-resolver', // 支持alias-path
                {
                    alias: {
                        // source
                        '@': './src',
                        config: './src/config',
                        core: './src/core',
                        internal: './src/internal',
                        plugins: './src/plugins',
                        utils: './src/utils',
                        // test
                        '~': './test',
                        '~h': './test/shared/helper',
                        '~f': './test/fakes',
                    },
                    transformFunctions: ['proxyquire', 'alias2path'],
                },
            ],
        ],
    }

    return options
}
