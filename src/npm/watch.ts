import { watch } from 'chokidar'
import type { Compiler as DelticCompiler } from 'deltic'
import type { FSWatcher } from 'chokidar'

import { maybeBuildNpm } from './build.js'
import type { WeappOptions } from '../types.js'

// Watches the npm entry package.json files (they live outside the source
// tree, so deltic's watcher can't see them) and reruns the npm build through
// the compiler's serialized queue.
export function watchNpm(
    engine: DelticCompiler,
    options: WeappOptions,
    npmList: Array<{ path: string; output: string }>
): FSWatcher {
    const watcher = watch(
        npmList.map((entry) => entry.path),
        { ignoreInitial: true }
    )

    watcher.on('all', () => {
        void maybeBuildNpm(engine, options, npmList).catch(() => {})
    })

    return watcher
}
