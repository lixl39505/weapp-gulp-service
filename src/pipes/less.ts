import path from 'node:path'

import camelcase from 'camelcase'
import dashify from 'dashify'
import less from 'less'
import postcss from 'postcss'
import px2rpx from 'postcss-px2rpx'
import type { Transform } from 'streamx'
import {
    aliasPipe,
    dependPipe,
    depAddPipe,
    deriveFile,
    envPipe,
    toGlobPath,
    type FileContext,
    type Vinyl,
} from 'deltic'

import { cssImportReg, cssUrlReg } from '../constants.js'
import { loadAndResolveLessVars } from '../utils/less-vars-to-js.js'
import { encodeStylesheet } from './img-base64.js'
import { createAsyncTransform } from './stream.js'
import type {
    CssPipeOptions,
    LessPipeOptions,
    WxssPipeOptions,
} from './types.js'

function renameExt(filePath: string, extname: string): string {
    return (
        filePath.slice(0, filePath.length - path.extname(filePath).length) +
        extname
    )
}

// less → wxss, with the global less-vars file handled inline: the vars file
// never compiles itself — it emits final `variables.js` + `variables.wxss`
// (1.0 renamed to the fixed `variables` basename) and is swallowed.
function lessCore(options: LessPipeOptions): Transform {
    return createAsyncTransform('less', async (file) => {
        const context = file.context as FileContext
        const lessVarPath =
            options.lessVar !== ''
                ? path.resolve(context.baseDir, options.lessVar)
                : ''

        if (lessVarPath !== '' && file.path === lessVarPath) {
            const vars = await loadAndResolveLessVars(
                file.path,
                options.less as Less.Options
            )
            const dir = path.dirname(file.path)

            const jsContent = `export default ${JSON.stringify(
                Object.entries(vars).reduce<Record<string, string>>(
                    (acc, [name, value]) => {
                        acc[camelcase(name)] = value
                        return acc
                    },
                    {}
                )
            )}`
            const cssContent = `page {${Object.entries(vars).reduce(
                (acc, [name, value]) => acc + `--${dashify(name)}: ${value};`,
                ''
            )}}`

            return [
                deriveFile(file, {
                    path: path.join(dir, 'variables.js'),
                    contents: Buffer.from(jsContent),
                }),
                deriveFile(file, {
                    path: path.join(dir, 'variables.wxss'),
                    contents: Buffer.from(cssContent),
                }),
            ]
        }

        const renderOptions = { ...options.less } as Less.Options

        if (lessVarPath !== '') {
            renderOptions.modifyVars ??= {}
            // forward slashes: less's import resolver rejects Windows separators
            renderOptions.modifyVars.hack = `${renderOptions.modifyVars.hack ?? ''}true; @import "${toGlobPath(lessVarPath)}";`
        }

        let text = (await less.render(file.contents.toString(), renderOptions))
            .css

        if (options.px2rpx) {
            text = (
                await postcss([px2rpx(options.px2rpx)]).process(text, {
                    from: file.path,
                })
            ).css
        }

        const targetPath = renameExt(file.path, options.extname)
        text = text.replaceAll('.css', options.extname)
        text = (
            await encodeStylesheet(
                {
                    path: targetPath,
                    contents: Buffer.from(text),
                    cwd: file.cwd,
                },
                options.base64
            )
        ).toString()

        return [
            deriveFile(file, { path: targetPath, contents: Buffer.from(text) }),
        ]
    })
}

// env ⊕ alias ⊕ depend ⊕ (dep-add lessVar) ⊕ less core — stage-per-concern so
// deltic profiles each one.
export function lessPipe(options: LessPipeOptions): Transform[] {
    const stages: Transform[] = [
        envPipe(),
        aliasPipe(),
        dependPipe({ matchers: [cssImportReg, cssUrlReg] }),
    ]

    if (options.lessVar !== '') {
        stages.push(
            depAddPipe({
                paths: (file: Vinyl, ctx: FileContext) => [
                    path.resolve(ctx.baseDir, options.lessVar),
                ],
            })
        )
    }

    stages.push(lessCore(options))

    return stages
}

// .css → <extname>, with px2rpx and base64 inlining.
export function cssPipe(options: CssPipeOptions): Transform[] {
    const core = createAsyncTransform('css', async (file) => {
        let text = file.contents.toString()

        if (options.px2rpx) {
            text = (
                await postcss([px2rpx(options.px2rpx)]).process(text, {
                    from: file.path,
                })
            ).css
        }

        const targetPath = renameExt(file.path, options.extname)
        text = text.replaceAll('.css', options.extname)
        text = (
            await encodeStylesheet(
                {
                    path: targetPath,
                    contents: Buffer.from(text),
                    cwd: file.cwd,
                },
                options.base64
            )
        ).toString()

        return [
            deriveFile(file, { path: targetPath, contents: Buffer.from(text) }),
        ]
    })

    return [
        aliasPipe(),
        dependPipe({ matchers: [cssImportReg, cssUrlReg] }),
        core,
    ]
}

// .wxss: alias ⊕ depend ⊕ base64 (no rename, no px2rpx).
export function wxssPipe(options: WxssPipeOptions): Transform[] {
    const core = createAsyncTransform('wxss', async (file) => {
        file.contents = await encodeStylesheet(
            { path: file.path, contents: file.contents, cwd: file.cwd },
            options.base64
        )

        return [file]
    })

    return [
        // .wxss has no entry in deltic's default strategy map — route it through
        // the css regexes explicitly
        aliasPipe({ strategies: { '.wxss': 'css' } }),
        dependPipe({ matchers: [cssImportReg, cssUrlReg] }),
        core,
    ]
}
