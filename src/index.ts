import { WeappCompiler, createWeappCompiler, toUserConfig } from './compiler.js'
import { resolveWeappOptions } from './config/resolve.js'
import { loadWeappConfig } from './config/load-config.js'
import { createDefaults } from './config/defaults.js'
import { weappTasks } from './preset/index.js'
import { WEAPP_PIPES } from './pipes/index.js'
import {
    buildNpm as wxBuildNpm,
    upload as wxUpload,
    getWx,
} from './wx-tool/index.js'
import { WxCI } from './wx-tool/ci.js'
import { WxDevtoolCli } from './wx-tool/cli.js'
import { resolveNpmList } from './npm/index.js'

// The default export keeps 1.0's `new Compiler(options)` shape alive for
// programmatic users; named exports are the v2 surface.
export {
    WeappCompiler,
    createWeappCompiler,
    toUserConfig,
    resolveWeappOptions,
    loadWeappConfig,
    createDefaults,
    weappTasks,
    WEAPP_PIPES,
    wxUpload,
    wxBuildNpm,
    getWx,
    WxCI,
    WxDevtoolCli,
    resolveNpmList,
}

export { Ext } from './ext.js'
export { SfcParser } from './sfc/parser.js'
export { encodeStylesheet } from './pipes/img-base64.js'
export { dateFormat } from './utils/date-format.js'
export { deepTraverse } from './utils/deep-traverse.js'
export { loadAndResolveLessVars } from './utils/less-vars-to-js.js'
export { lessPipe, cssPipe, wxssPipe } from './pipes/less.js'
export { jsonPipe, json5Pipe, weappJsonMatcher } from './pipes/json.js'
export { sfcPipe } from './pipes/sfc.js'
export { appJsonPipe } from './pipes/app-json.js'
export { wxmlPipe, wxsPipe } from './pipes/wxml.js'
export { createAsyncTransform, runPipeline } from './pipes/stream.js'
export { checkNpmPkg, makeCmd } from './npm/cmd.js'
export { runCli, main, type CliDeps } from './cli.js'

// pipe option types
export type {
    LessPipeOptions,
    CssPipeOptions,
    WxssPipeOptions,
    JsonPipeOptions,
    SfcPipeOptions,
} from './pipes/types.js'

export type {
    WeappOptions,
    WeappUserConfig,
    WeappConfigCallback,
    WeappConfigContext,
    CssOptions,
    LessOptions,
    Px2rpxOptions,
    Base64Options,
    Base64Exclude,
    MpOptions,
    EnvValue,
} from './types.js'

// deltic re-exports for config/plugin authors
export {
    Compiler,
    defineConfig,
    preset,
    compileCachePlugin,
    cleanPlugin,
    depGraphPlugin,
    defaultPlugins,
    definePlugin,
    createTransform,
    deriveFile,
    wrapPipeError,
    objectMerge,
} from 'deltic'

export type {
    UserConfig,
    ResolvedOptions,
    TaskConfig,
    PipeFactory,
    Plugin,
    PluginContext,
    SessionContext,
    Matcher,
    BufferVinyl,
} from 'deltic'

export default WeappCompiler
