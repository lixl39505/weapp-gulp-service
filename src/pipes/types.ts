// Object-literal type aliases (not interfaces): assignable to deltic's
// `PipeOptions = Record<string, unknown>` so the registry adapters can cast.
import type { Base64Options, LessOptions, Px2rpxOptions } from '../types.js'

/** Options for the `less` pipe (baked from merged options at resolve time). */
export type LessPipeOptions = {
    lessVar: string
    less: LessOptions
    px2rpx: Px2rpxOptions
    base64: Base64Options
    /** Output extname from `css.rename.extname` (default '.wxss'). */
    extname: string
}

/** Options for the `css` pipe. */
export type CssPipeOptions = {
    px2rpx: Px2rpxOptions
    base64: Base64Options
    /** Output extname from `css.rename.extname` (default '.wxss'). */
    extname: string
}

/** Options for the `wxss` pipe. */
export type WxssPipeOptions = {
    base64: Base64Options
}

/** Options for the `json`/`json5` pipes (the `app.json` branch included). */
export type JsonPipeOptions = {
    json5?: boolean
    /** Mini-program platform for the extended app.json parser (default 'wx'). */
    platform?: string
}

/** Options for the `sfc` pipe (slices reuse the style/json pipes). */
export type SfcPipeOptions = {
    tagAlias: Record<string, string>
    alias: Record<string, string>
    less: LessPipeOptions
    css: CssPipeOptions
    wxss: WxssPipeOptions
    json: JsonPipeOptions
}
