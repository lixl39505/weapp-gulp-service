import type { PipeFactory, PipeOptions } from 'deltic'

import { cssPipe, lessPipe, wxssPipe } from './less.js'
import { json5Pipe, jsonPipe } from './json.js'
import { sfcPipe } from './sfc.js'
import { wxmlPipe, wxsPipe } from './wxml.js'
import type {
    CssPipeOptions,
    JsonPipeOptions,
    LessPipeOptions,
    SfcPipeOptions,
    WxssPipeOptions,
} from './types.js'

/**
 * The weapp pipe registry — merged into every WeappCompiler's deltic config.
 * `json`/`json5`/`sfc`/`less`/`css`/`wxss`/`wxml`/`wxs` are weapp-specific;
 * `js`, `depend`, `alias`, `env` etc. keep their deltic builtin meaning.
 *
 * The factories are task-option driven: the task table bakes the concrete
 * options at resolve time, so the registry adapters simply cast.
 */
export const WEAPP_PIPES: Record<string, PipeFactory> = {
    wxml: () => wxmlPipe(),
    wxs: () => wxsPipe(),
    less: (options) => lessPipe((options ?? {}) as unknown as LessPipeOptions),
    css: (options) => cssPipe((options ?? {}) as unknown as CssPipeOptions),
    wxss: (options) => wxssPipe((options ?? {}) as unknown as WxssPipeOptions),
    json: (options) => jsonPipe((options ?? {}) as unknown as JsonPipeOptions),
    json5: (options) =>
        json5Pipe((options ?? {}) as unknown as Omit<JsonPipeOptions, 'json5'>),
    sfc: (options) => sfcPipe((options ?? {}) as unknown as SfcPipeOptions),
}

export type { PipeOptions }
