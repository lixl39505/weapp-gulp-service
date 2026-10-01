export type EnvValue = string | boolean | number | undefined

export interface CssOptions {
    rename: {
        extname: string
    }
}

export interface LessOptions extends Record<string, unknown> {
    javascriptEnabled?: boolean
}

export interface Px2rpxOptions extends Record<string, unknown> {
    /** px → rpx conversion multiplier. */
    times?: number
}

export type Base64Exclude = string | RegExp | ((rawUrl: string) => boolean)

export interface Base64Options {
    /** Resolved against the css file's directory when empty. */
    baseDir: string
    exclude: Base64Exclude[]
    maxImageSize: number
    deleteAfterEncoding: boolean
    debug: boolean
}

export interface MpOptions {
    tagAlias: Record<string, string>
}

/**
 * Context handed to the config `callback` — mirrors 1.0's `(options, {Compiler})`.
 */
export interface WeappConfigContext {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Compiler?: any
}

export type WeappConfigCallback = (
    options: WeappOptions,
    context: WeappConfigContext
) => WeappOptions | void | Promise<WeappOptions | void>

/**
 * Fully merged weapp options: defaults ⊕ user config ⊕ CLI args, after the
 * `callback` ran. This is what pipes and the compiler consume.
 */
export interface WeappOptions {
    /** Loaded .env values ⊕ user env (drives the `env` pipe and wx-tool). */
    env: Record<string, string>
    /** CLI args (1.0 parity). */
    args: Record<string, unknown>
    /** Free-form app data (1.0 parity). */
    app: Record<string, unknown>
    /** Absolute config file path (empty when none was found). */
    config: string
    mode: string
    output: string
    source: string
    ignore: string[]
    /** Extensions routed to the `img` task. */
    imgType: string[]
    alias: Record<string, string>
    css: CssOptions
    /** Global less-vars file (source-relative); empty disables the feature. */
    lessVar: string
    less: LessOptions
    px2rpx: Px2rpxOptions
    base64: Base64Options
    mp: MpOptions
    /** Run the mini-program npm build after full compiles (default true). */
    buildNpm: boolean
    callback?: WeappConfigCallback
}

/**
 * Shape of a `weapp.config.ts` export: everything optional, runtime-only
 * fields excluded, env values stay unstringified until resolution.
 */
export type WeappUserConfig = Partial<
    Omit<WeappOptions, 'args' | 'config' | 'mode' | 'env' | 'callback'> & {
        env: Record<string, EnvValue>
        callback?: WeappConfigCallback
    }
>
