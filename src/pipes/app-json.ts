import path from 'node:path'

import { deriveFile } from 'deltic'
import type { BufferVinyl } from 'deltic'
import type { Transform } from 'streamx'

import { Ext } from '../ext.js'
import { createAsyncTransform } from './stream.js'

export interface AppJsonPipeOptions {
    platform?: string
}

// Extended app.json compilation: nested routes flatten into the emitted
// app.json, and the route maps are emitted as final virtual files (their
// context is shared, so the clean plugin attributes them to app.json).
// Only app.json triggers the branch; other json files pass through (1.0
// guarded with a basename check too — without it sitemap.json would emit
// empty route maps over the real ones).
export function appJsonPipe(options: AppJsonPipeOptions = {}): Transform {
    const { platform = 'wx' } = options

    return createAsyncTransform('app-json', async (file: BufferVinyl) => {
        if (path.basename(file.path) !== 'app.json') {
            return [file]
        }

        const appExt = Ext.from(file.contents.toString(), platform)
        const appJson = appExt.getJson()
        const routeMap = appExt.getRouteMap()
        const routeNameMap = appExt.getRouteNameMap()

        const rewritten = deriveFile(file, {
            path: file.path,
            contents: Buffer.from(JSON.stringify(appJson, null, 4)),
        })

        const routeMapFile = deriveFile(file, {
            path: path.join(path.dirname(file.path), 'route-map.js'),
            contents: Buffer.from(
                `export default ${JSON.stringify(routeMap, null, 4)}`
            ),
        })

        const routeNameMapFile = deriveFile(file, {
            path: path.join(path.dirname(file.path), 'route-name-map.js'),
            contents: Buffer.from(
                `export default ${JSON.stringify(routeNameMap, null, 4)}`
            ),
        })

        return [rewritten, routeMapFile, routeNameMapFile]
    })
}
