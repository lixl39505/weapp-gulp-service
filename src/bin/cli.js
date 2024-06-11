#!/usr/bin/env node

const program = require('commander')
const path = require('path')
const { dateFormat } = require('../utils/helper')
const { upload: wxUpload, buildNpm: wxBuildNpm } = require('../core/wx-tool')
const Compiler = require('../index')
const resolveOptions = require('../config/index')

/**
 * cli交互处理
 **/

program.version('1.0.0')

// serve 运行
program
    .command('serve', { isDefault: true })
    .allowUnknownOption()
    .option(
        '-c, --config <string>',
        'configuration file path',
        'weapp.config.js'
    )
    .option('-m, --mode <string>', 'compile mode', 'development')
    .option('--no-build-npm', 'disable automatic building of NPM')
    .action(function (params) {
        resolveOptions({ args: params.opts() }, { Compiler }).then(
            (options) => {
                var compiler = new Compiler(options)

                compiler.watch()
            }
        )
    })

// build 打包
program
    .command('build')
    .allowUnknownOption()
    .option(
        '-c, --config <string>',
        'configuration file path',
        'weapp.config.js'
    )
    .option('-m, --mode <string>', 'compile mode', 'production')
    .option('--no-npm-build', 'disable automatic building of NPM')
    .action(function (params) {
        resolveOptions({ args: params.opts() }, { Compiler }).then(
            (options) => {
                var compiler = new Compiler(options)

                compiler.run()
            }
        )
    })

// upload 上传代码
program
    .command('upload [desc]')
    .allowUnknownOption()
    .requiredOption('-v, --ver <string>', 'version number') // required
    .option('-m, --mode <string>', 'compile mode', 'production')
    .option(
        '-c, --config <string>',
        'configuration file path',
        'weapp.config.js'
    )
    .option('-dd, --verbose', 'loglevel verbose')
    .action(function (desc, params) {
        var args = {
            ...params.opts(),
            desc: desc
                ? `"${desc}"`
                : `"${dateFormat(Date.now())} ${params.mode} v${params.ver}"`,
        }

        resolveOptions({ args }, { Compiler }).then((options) => {
            var compiler = new Compiler(options)

            compiler.run().then(() => {
                // 上传
                wxUpload({ ...args, project: path.dirname(args.config) })
            })
        })
    })

// 构建npm
program
    .command('build:npm')
    .allowUnknownOption()
    .option('-m, --mode <string>', 'compile mode', 'production')
    .option(
        '-c, --config <string>',
        'configuration file path',
        'weapp.config.js'
    )
    .action(function (params) {
        const args = params.opts()

        wxBuildNpm({ project: path.dirname(args.config) })
    })

// npx --node-arg --inspect-brk weapp-gulp-service -m ymm_dev
// npx --node-arg --inspect-brk weapp-gulp-service build -m ymm_prod
// npx --node-arg --inspect-brk weapp-gulp-service upload -v 1.0.0 -m ymm_prod ci-upload-1.2
// npx --node-arg --inspect-brk weapp-gulp-service build:npm -m ymm_prod

program.parse(process.argv)
