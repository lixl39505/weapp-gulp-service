import path from 'node:path'

import camelcase from 'camelcase'
import { deepTraverse, type TreeNode } from './utils/deep-traverse.js'

interface RouteNode extends TreeNode {
    path?: string
    name?: string
    children?: RouteNode[]
    __is__?: string
}

export interface ExtParser {
    appJson: Record<string, unknown>
    routeMap: Record<string, Record<string, unknown>>
    routeNameMap: Record<string, string>
    parse(content: string): void
}

function isPojo(value: unknown): value is Record<string, unknown> {
    return (
        value !== null &&
        typeof value === 'object' &&
        Object.getPrototypeOf(value) === Object.prototype
    )
}

function pascalcase(s: string): string {
    return camelcase(s, { pascalCase: true })
}

interface ParseOptions {
    before?: (is: string) => string
}

class ParserWx implements ExtParser {
    appJson: Record<string, unknown> = {}
    routeMap: Record<string, Record<string, unknown>> = {}
    routeNameMap: Record<string, string> = {}

    parse(content: string): void {
        const config = JSON.parse(content) as Record<string, unknown>

        for (const rawKey of Object.keys(config)) {
            // WeChat's official JSON uses `subpackages`; accept the camelCase
            // `subPackages` spelling too (1.0 only dispatched the lowercase form).
            const key = rawKey === 'subPackages' ? 'subpackages' : rawKey
            const value = config[rawKey]
            const strategyKey = `parse${pascalcase(key)}`
            const strategy = (this as unknown as Record<string, unknown>)[
                strategyKey
            ]

            if (typeof strategy === 'function') {
                this.appJson[rawKey] = (
                    strategy as (value: unknown) => unknown
                ).call(this, value)
            } else {
                this.appJson[rawKey] = value
            }
        }
    }

    normalizeRoute(route: unknown): RouteNode {
        return isPojo(route) ? (route as RouteNode) : { path: route as string }
    }

    // pages option: nested routes flatten into leaf full-paths.
    parsePages(pages: unknown, options: ParseOptions = {}): string[] {
        const result: string[] = []

        deepTraverse<RouteNode>(pages as RouteNode, (route, parent) => {
            const normalized = this.normalizeRoute(route)

            if (!normalized.path) {
                throw new Error(
                    `Invalid Route From app.json，only support 'path' or { path: '' }`
                )
            }

            let is = parent
                ? path.posix.join(parent.__is__!, normalized.path)
                : normalized.path

            if (is.startsWith('/')) {
                is = is.slice(1)
            }

            normalized.__is__ = is

            if (
                normalized.children !== undefined &&
                normalized.children.length > 0
            ) {
                // parent route: keep descending into the children
                return true
            }

            // leaves only
            result.push(options.before !== undefined ? options.before(is) : is)

            const metadata: Record<string, unknown> = {}

            for (const [key, value] of Object.entries(normalized)) {
                if (key !== 'path' && key !== 'children' && key !== '__is__') {
                    metadata[key] = value
                }
            }

            this.routeMap[is] = metadata

            if (normalized.name !== undefined) {
                this.routeNameMap[normalized.name] = is
            }

            return true
        })

        return result
    }

    // subpackages option: pages listed relative to the package root. The
    // camelCase `subPackages` key is normalized to this strategy (see #parse).
    parseSubpackages(
        pkgs: Array<{ root: string; pages?: unknown }>
    ): unknown[] {
        return pkgs.map((pkg) => ({
            ...pkg,
            pages: this.parsePages(
                [
                    {
                        path: pkg.root,
                        children: pkg.pages as RouteNode[],
                    },
                ],
                {
                    before(is: string) {
                        return is.replace(`${pkg.root}/`, '')
                    },
                }
            ),
        }))
    }
}

const parserMap: Record<string, () => ExtParser> = {
    wx: () => new ParserWx(),
}

// Extended app.json (1.0 `core/ext.js`): nested routes, names and metadata
// compile into flat pages plus route maps.
export class Ext {
    content: string
    platform: string
    parser: ExtParser

    constructor(content: string, platform = 'wx') {
        this.content = content
        this.platform = platform

        const factory = parserMap[this.platform]

        if (factory === undefined) {
            throw new Error(`platform:${this.platform} not support`)
        }

        this.parser = factory()
        this.parser.parse(this.content)
    }

    getJson(): Record<string, unknown> {
        return this.parser.appJson
    }

    getRouteMap(): Record<string, Record<string, unknown>> {
        return this.parser.routeMap
    }

    getRouteNameMap(): Record<string, string> {
        return this.parser.routeNameMap
    }

    static from(content: string, platform?: string): Ext {
        return new Ext(content, platform)
    }
}
