import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
    getRegexpMatches,
    loadAndResolveLessVars,
} from '../../../src/utils/less-vars-to-js.js'

let root: string | undefined

afterEach(() => {
    root = undefined
})

describe('less-vars-to-js', () => {
    it('resolves variables with imports', async () => {
        root = mkdtempSync(path.join(tmpdir(), 'wgs-less-'))
        mkdirSync(path.join(root, 'styles'), { recursive: true })
        writeFileSync(
            path.join(root, 'styles', 'base.less'),
            '@width: 100px;\n'
        )
        writeFileSync(
            path.join(root, 'styles', 'entry.less'),
            "@import './base.less';\n@color: red;\n"
        )

        const vars = await loadAndResolveLessVars(
            path.join(root, 'styles', 'entry.less')
        )

        expect(vars).toEqual({ width: '100px', color: 'red' })
    })

    it('applies less options (javascriptEnabled)', async () => {
        root = mkdtempSync(path.join(tmpdir(), 'wgs-less-'))
        writeFileSync(path.join(root, 'v.less'), '@a: 1;\n')

        const vars = await loadAndResolveLessVars(path.join(root, 'v.less'), {
            javascriptEnabled: true,
        })

        expect(vars).toEqual({ a: '1' })
    })

    it('appends the .less extension to extensionless imports', async () => {
        root = mkdtempSync(path.join(tmpdir(), 'wgs-less-'))
        writeFileSync(path.join(root, 'base.less'), '@w: 2px;\n')
        writeFileSync(path.join(root, 'entry.less'), "@import './base';\n")

        const vars = await loadAndResolveLessVars(path.join(root, 'entry.less'))

        expect(vars).toEqual({ w: '2px' })
    })

    it('resolves ~ prefixed imports from node_modules', async () => {
        root = mkdtempSync(path.join(tmpdir(), 'wgs-less-'))
        const oldCwd = process.cwd()

        process.chdir(root)
        mkdirSync(path.join(root, 'node_modules', 'theme'), { recursive: true })
        writeFileSync(
            path.join(root, 'node_modules', 'theme', 'vars.less'),
            '@c: #010203;\n'
        )
        writeFileSync(path.join(root, 'entry.less'), "@import '~theme/vars';\n")

        try {
            const vars = await loadAndResolveLessVars(
                path.join(root, 'entry.less')
            )

            expect(vars).toEqual({ c: '#010203' })
        } finally {
            process.chdir(oldCwd)
        }
    })

    it('wraps less render failures with context', async () => {
        root = mkdtempSync(path.join(tmpdir(), 'wgs-less-'))
        writeFileSync(
            path.join(root, 'bad.less'),
            '@a: ;\nbody { color: @missing; }\n'
        )

        await expect(
            loadAndResolveLessVars(path.join(root, 'bad.less'))
        ).rejects.toThrowError(/Less render failed!/)
    })

    it('getRegexpMatches collects matches and restores lastIndex', () => {
        const regexp = /@(\w+)/g
        const matches = getRegexpMatches(regexp, '@a @b')

        expect(matches.map((match) => match[1])).toEqual(['a', 'b'])
        expect(regexp.lastIndex).toBe(0)
    })

    it('getRegexpMatches stops for non-global regexes', () => {
        const matches = getRegexpMatches(/@(\w+)/, '@a @b')

        expect(matches).toHaveLength(1)
    })
})
