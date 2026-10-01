import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

import dashify from 'dashify'

export interface WxDevtoolCliOptions {
    [key: string]: unknown
}

// WeChat developer-tools CLI wrapper — port of 1.0 `wx-tool/cli.js`.
// The devtools CLI path layout: macOS `<install>/Contents/MacOS/cli`,
// Windows `<install>/cli.bat`.
export class WxDevtoolCli {
    type = 'cli' as const

    path: string
    globalOptions: WxDevtoolCliOptions

    constructor(cliPath?: string, options: WxDevtoolCliOptions = {}) {
        if (!cliPath) {
            throw new Error('Wechat developer tool cli path not provided')
        }

        if (!existsSync(path.resolve(cliPath))) {
            throw new Error(
                'The path of wechat developer tool cli is incorrect'
            )
        }

        this.path = path.resolve(cliPath)
        this.globalOptions = options
    }

    run(cmd: string, options: WxDevtoolCliOptions = {}): Buffer {
        let params = ''

        for (const [key, value] of Object.entries(options)) {
            params +=
                key.length === 1
                    ? `-${key} ${value} `
                    : `--${dashify(key)} ${value} `
        }

        const order = `"${this.path}" ${cmd} ${params}`

        console.log(order)

        return execSync(order, { stdio: 'inherit' })
    }
}

const COMMANDS = [
    'login',
    'autoPreview',
    'upload',
    'buildNpm',
    'auto',
    'open',
    'close',
    'quit',
    'resetFileutils',
    'cache',
] as const

type CommandName = (typeof COMMANDS)[number]

export interface DevtoolCommands {
    login(options?: WxDevtoolCliOptions): Buffer
    autoPreview(options?: WxDevtoolCliOptions): Buffer
    upload(options?: WxDevtoolCliOptions): Buffer
    buildNpm(options?: WxDevtoolCliOptions): Buffer
    auto(options?: WxDevtoolCliOptions): Buffer
    open(options?: WxDevtoolCliOptions): Buffer
    close(options?: WxDevtoolCliOptions): Buffer
    quit(options?: WxDevtoolCliOptions): Buffer
    resetFileutils(options?: WxDevtoolCliOptions): Buffer
    cache(options?: WxDevtoolCliOptions): Buffer
}

// Generated subcommand methods: cli.upload({...}) runs `cli upload ...`.
export interface WxDevtoolCliWithCommands
    extends WxDevtoolCli,
        DevtoolCommands {}

for (const cmd of COMMANDS) {
    ;(WxDevtoolCli.prototype as unknown as Record<string, unknown>)[cmd] =
        function (this: WxDevtoolCli, options?: WxDevtoolCliOptions): Buffer {
            return this.run(dashify(cmd as CommandName), options)
        }
}
