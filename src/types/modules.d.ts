declare module 'postcss-px2rpx' {
    interface Px2rpxPluginOptions {
        times?: number
        [key: string]: unknown
    }

    import type { PluginCreator } from 'postcss'

    const px2rpx: PluginCreator<Px2rpxPluginOptions>
    export default px2rpx
}

declare module 'requireg' {
    function requireg(name: string): unknown
    export = requireg
}

declare module 'dashify' {
    function dashify(input: string): string
    export = dashify
}
