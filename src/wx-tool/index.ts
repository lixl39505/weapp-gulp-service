import pc from 'picocolors'

import { WxCI } from './ci.js'
import { WxDevtoolCli, type WxDevtoolCliWithCommands } from './cli.js'

export interface WxToolOptions {
    project: string
    /** Resolved env values take precedence over process.env. */
    env?: Record<string, string>
}

export type WxInterface =
    | { type: 'ci'; instance: WxCI }
    | { type: 'cli'; instance: WxDevtoolCliWithCommands }

const lookup = (options: WxToolOptions, key: string): string | undefined =>
    options.env?.[key] ?? process.env[key]

/**
 * Resolves the WeChat interface: miniprogram-ci first (WE_APP_PRIVATE_KEY_PATH
 * set), the developer-tools CLI second (WE_CLI set). Unlike 1.0 there is no
 * module-level singleton — each call builds a fresh interface.
 */
export async function getWx(options: WxToolOptions): Promise<WxInterface> {
    const errors: Error[] = []

    try {
        return {
            type: 'ci',
            instance: new WxCI({
                projectPath: options.project,
                privateKeyPath: lookup(options, 'WE_APP_PRIVATE_KEY_PATH'),
            }),
        }
    } catch (error) {
        errors.push(error as Error)
    }

    try {
        return {
            type: 'cli',
            instance: new WxDevtoolCli(
                lookup(options, 'WE_CLI')
            ) as WxDevtoolCliWithCommands,
        }
    } catch (error) {
        errors.push(error as Error)
    }

    console.log(
        pc.yellow('Warning: ' + errors.map((e) => e.message).join(' or '))
    )
    console.log(
        pc.yellow(
            `The auto npm-build feature is not available, But you can do it manually(see https://developers.weixin.qq.com/miniprogram/dev/devtools/npm.html#_2-%E6%9E%84%E5%BB%BA-npm).`
        )
    )
    console.log(
        pc.cyan(
            `We strongly recommend that you set up WE_CLI or WE_APP_PRIVATE_KEY_PATH environment variables to enbale auto npm-build feature.`
        )
    )

    throw new Error('Wechat interface call failed')
}

// Uploads sources — `wgs upload`.
export async function upload(
    options: WxToolOptions & {
        ver?: string
        desc?: string
        verbose?: boolean
    }
): Promise<void> {
    const { ver = '', desc = '', verbose = false } = options
    const wx = await getWx(options)

    if (wx.type === 'ci') {
        await wx.instance.upload({ version: ver, desc, verbose })
        return
    }

    wx.instance.upload({ version: ver, desc, project: options.project })
}

// Builds miniprogram_npm — `wgs build:npm` and the auto npm build.
export async function buildNpm(options: WxToolOptions): Promise<void> {
    const wx = await getWx(options)

    if (wx.type === 'ci') {
        await wx.instance.buildNpm()
        return
    }

    wx.instance.buildNpm({ project: options.project })
}
