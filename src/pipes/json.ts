import path from 'node:path'

import fastGlob from 'fast-glob'
import type { Transform } from 'streamx'
import {
    dependPipe,
    envPipe,
    strJson5Pipe,
    toGlobPath,
    type FileContext,
    type Matcher,
    type Vinyl,
} from 'deltic'

import { Ext } from '../ext.js'
import { appJsonPipe } from './app-json.js'
import { createAsyncTransform } from './stream.js'
import type { JsonPipeOptions } from './types.js'

function isPojo(value: unknown): value is Record<string, unknown> {
    return (
        value !== null &&
        typeof value === 'object' &&
        Object.getPrototypeOf(value) === Object.prototype
    )
}

// Collects usingComponents / pages / subpackages(+subPackages) references so
// the dep graph can trigger reverse recompiles. Requests resolve the same way
// module resolution would (compiler.resolve), then expand to concrete files:
// `<request>.{vue,mp}` plus everything inside `<request>/`.
export function weappJsonMatcher(file: Vinyl, context: FileContext): string[] {
    let jo: Record<string, unknown> = {}
    const reqs: string[] = []
    const deps: string[] = []

    try {
        jo = JSON.parse((file.contents as Buffer).toString()) as Record<
            string,
            unknown
        >
    } catch {
        jo = {}
    }

    // usingComponents
    if (jo.usingComponents !== undefined && isPojo(jo.usingComponents)) {
        reqs.push(...Object.values(jo.usingComponents).map(String))
    }

    // pages (flat strings or { path })
    if (Array.isArray(jo.pages)) {
        for (const page of jo.pages) {
            if (page !== null && typeof page === 'object' && 'path' in page) {
                reqs.push(String((page as { path: unknown }).path))
            } else if (page !== null && page !== undefined) {
                reqs.push(String(page))
            }
        }
    }

    // subpackages — both spellings merged (1.0 only read `subpackages`)
    const packages = [
        ...(Array.isArray(jo.subpackages) ? (jo.subpackages as unknown[]) : []),
        ...(Array.isArray(jo.subPackages) ? (jo.subPackages as unknown[]) : []),
    ]

    for (const entry of packages) {
        if (!isPojo(entry)) {
            continue
        }

        const pkg = entry as { root: string; pages?: unknown }

        if (!Array.isArray(pkg.pages)) {
            continue
        }

        for (const page of pkg.pages) {
            const value =
                page !== null && typeof page === 'object' && 'path' in page
                    ? (page as { path: unknown }).path
                    : page

            reqs.push(toGlobPath(path.join(pkg.root, String(value ?? ''))))
        }
    }

    for (const request of reqs) {
        let target = context.resolve(request, file.path)
        const basename = path.basename(target)

        // collapse a duplicated trailing part (…/index/index → …/index),
        // separator-agnostic (1.0's string check missed Windows paths)
        if (target.endsWith(`${path.sep}${basename}${path.sep}${basename}`)) {
            target = target.slice(0, target.length - basename.length - 1)
        }

        deps.push(
            ...fastGlob.sync([
                `${toGlobPath(target)}.{vue,mp}`,
                `${toGlobPath(target)}/*.*`,
            ])
        )
    }

    return deps
}

// json/json5 combo: env ⊕ (json5) ⊕ app.json branch ⊕ depend. Instance-level
// registration under the `json`/`json5` names intentionally overrides the
// deltic builtins — for a weapp build, "json" means the weapp pipeline.
export function jsonPipe(options: JsonPipeOptions = {}): Transform[] {
    const stages: Transform[] = [envPipe()]

    if (options.json5 === true) {
        stages.push(strJson5Pipe())
    }

    stages.push(appJsonPipe({ platform: options.platform }))
    stages.push(dependPipe({ matchers: [weappJsonMatcher] }))

    return stages
}

export function json5Pipe(
    options: Omit<JsonPipeOptions, 'json5'> = {}
): Transform[] {
    return jsonPipe({ ...options, json5: true })
}
