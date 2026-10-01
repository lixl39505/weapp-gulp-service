import { existsSync, lstatSync, readFileSync, unlinkSync } from 'node:fs'
import path from 'node:path'

import type { Base64Options } from '../types.js'

// Cache regexes (ported from gulp-base64-v2/lib/encode.js — the `base64:skip`
// comment escape keeps working).
const rImages =
    /([\s\S]*?)(url\(([^)]+)\))(?!\s*[;,]?\s*\/\*\s*base64:skip\s*\*\/)|([\s\S]+)/gim
const rExternal = /^(http|https|\/\/)/
const rSchemeless = /^\/\//
const rData = /^data:/
const rQuotes = /['"]/g
const rParams = /([?#].*)$/g

const MIME_TYPES: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    webp: 'image/webp',
    ico: 'image/x-icon',
    bmp: 'image/bmp',
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    otf: 'font/otf',
    eot: 'application/vnd.ms-fontobject',
}

function mimeOf(file: string): string | undefined {
    return MIME_TYPES[file.split('.').pop()!.toLowerCase()]
}

function getDataUri(mimeType: string | undefined, image: Buffer): string {
    return `data:${mimeType ?? 'application/octet-stream'};base64,${image.toString('base64')}`
}

async function fetchImage(url: string): Promise<Buffer | null> {
    try {
        const response = await fetch(url)

        if (response.status !== 200) {
            return null
        }

        return Buffer.from(await response.arrayBuffer())
    } catch {
        return null
    }
}

/**
 * Inlines local/remote images referenced by `url(...)` as data URIs — a
 * faithful port of gulp-base64-v2's stylesheet encoder minus the unused
 * `extensions` option. Images larger than `maxImageSize` (encoded length),
 * `exclude`d ones, and unreadable ones are left untouched.
 */
export async function encodeStylesheet(
    file: { path: string; contents: Buffer; cwd?: string },
    options: Base64Options
): Promise<Buffer> {
    const src = file.contents.toString()
    let result = ''
    let lastIndex = 0
    let match: RegExpExecArray | null
    const cache = new Map<string, string>()

    rImages.lastIndex = 0

    while ((match = rImages.exec(src)) !== null) {
        if (match[4] !== undefined) {
            // no further url(...) — keep the rest verbatim
            result += match[4]
            break
        }

        result += match[1]!

        const rawUrl = match[3]!.trim()
        const declaration = match[2]!
        const image = rawUrl.replace(rQuotes, '').replace(rParams, '')

        const excluded =
            options.exclude?.some((pattern) =>
                typeof pattern === 'function'
                    ? pattern(rawUrl)
                    : typeof pattern === 'string'
                      ? rawUrl.includes(pattern)
                      : pattern.test(rawUrl)
            ) ?? false

        if (excluded) {
            if (options.debug) {
                console.log(`${image} skipped by exclude filters`)
            }

            result += declaration
            continue
        }

        const cached = cache.get(image)

        if (cached !== undefined) {
            result += cached
            continue
        }

        const isLocalFile = !rData.test(image) && !rExternal.test(image)
        let location = image

        if (isLocalFile) {
            location = options.baseDir
                ? path.join(options.baseDir, image)
                : path.join(path.dirname(file.path), image)

            if (!existsSync(location)) {
                if (options.debug) {
                    console.log(`in ${location} file doesn't exist`)
                }

                location = path.join(file.cwd ?? process.cwd(), image)
            }
        } else if (rSchemeless.test(location)) {
            location = `http:${location}`
        }

        let encoded: string | null = null

        if (rData.test(image)) {
            encoded = image
        } else if (isLocalFile) {
            if (!existsSync(location) || !lstatSync(location).isFile()) {
                if (options.debug) {
                    console.warn(`File ${location} does not exist`)
                }
            } else {
                if (options.debug) {
                    console.info(`Encoding file: ${location}`)
                }

                const imageBuffer = readFileSync(location)
                encoded = getDataUri(mimeOf(location), imageBuffer)
            }
        } else {
            const imageBuffer = await fetchImage(location)

            if (imageBuffer === null) {
                console.error(`Unable to get ${location}.`)
            } else {
                encoded = getDataUri(mimeOf(location), imageBuffer)
            }
        }

        if (
            encoded !== null &&
            options.maxImageSize > 0 &&
            encoded.length > options.maxImageSize
        ) {
            if (options.debug) {
                console.log(
                    `Skipping ${location} (greater than ${options.maxImageSize} bytes)`
                )
            }

            encoded = null
        }

        if (encoded === null) {
            result += declaration
            continue
        }

        const url = `url(${encoded})`
        result += url
        cache.set(image, url)

        if (options.deleteAfterEncoding && isLocalFile) {
            if (options.debug) {
                console.info(`Deleting file: ${location}`)
            }

            unlinkSync(location)
        }
    }

    return Buffer.from(result)
}
