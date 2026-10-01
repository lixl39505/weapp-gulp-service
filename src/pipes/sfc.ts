import path from 'node:path'
import vm from 'node:vm'

import {
    aliasPipe,
    dependPipe,
    deriveFile,
    envPipe,
    type BufferVinyl,
    type Vinyl,
} from 'deltic'
import type { Transform } from 'streamx'

import { es5ImportReg, es6ImportReg } from '../constants.js'
import { SfcParser } from '../sfc/parser.js'
import { cssPipe, lessPipe, wxssPipe } from './less.js'
import { weappJsonMatcher } from './json.js'
import { createAsyncTransform, runPipeline } from './stream.js'
import type { SfcPipeOptions } from './types.js'

// Evaluates the `<script name="json">` CJS snippet (1.0 used
// module-from-string; node:vm does it without an extra dependency).
function evalJsonModule(code: string): unknown {
    const module = { exports: {} as unknown }
    const exports = module.exports

    new vm.Script(code).runInNewContext({ module, exports })

    return module.exports
}

function sliceOf(
    parent: Vinyl,
    dir: string,
    stem: string,
    ext: string,
    contents: string | Buffer
): Vinyl {
    return deriveFile(parent, {
        path: path.join(dir, `${stem}${ext}`),
        contents: Buffer.from(contents),
    })
}

// Single-file component compilation (.vue/.mp) — merges 1.0's gulp-sfc +
// gulp-mp + gulp-mp-concat: parse, compile each slice through the matching
// pipeline, concat multi-style slices, and emit the four final files under
// <dir>/<stem>/.
export function sfcPipe(options: SfcPipeOptions): Transform {
    return createAsyncTransform('sfc', async (file: BufferVinyl) => {
        const stem = path.basename(file.path, path.extname(file.path))
        const parser = new SfcParser({ tagAlias: options.tagAlias })
        parser.parse(file.contents.toString())

        const dir = path.join(path.dirname(file.path), stem)

        const run = async (
            stages: Transform | Transform[],
            ext: string,
            contents: string
        ): Promise<Vinyl> => {
            const result = await runPipeline(
                stages,
                sliceOf(file, dir, stem, ext, contents)
            )

            if (result.error !== null) {
                throw result.error
            }

            return result.files[0]!
        }

        const wxml = await run(
            aliasPipe({
                alias: options.alias,
                strategies: { '.wxml': 'html' },
            }),
            '.wxml',
            parser.wxml
        )

        const js = await run(
            [
                envPipe(),
                aliasPipe({ alias: options.alias }),
                dependPipe({ matchers: [es5ImportReg, es6ImportReg] }),
            ],
            '.js',
            parser.js
        )

        const jsonContent =
            parser.json !== ''
                ? JSON.stringify(evalJsonModule(parser.json) ?? {})
                : '{}'

        const json = await run(
            [envPipe(), dependPipe({ matchers: [weappJsonMatcher] })],
            '.json',
            jsonContent
        )

        // style slices: compile per lang, then concat in declaration order
        const styleContents: string[] = []

        for (const slice of parser.style) {
            let text = slice.text

            if (slice.lang === 'less' || slice.lang === 'css') {
                const stages =
                    slice.lang === 'less'
                        ? lessPipe(options.less)
                        : cssPipe(options.css)
                const compiled = await run(stages, `.${slice.lang}`, slice.text)

                text = (compiled.contents as Buffer).toString()
            }

            styleContents.push(text)
        }

        return [
            wxml,
            js,
            json,
            sliceOf(file, dir, stem, '.wxss', styleContents.join('')),
        ]
    })
}
