import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

// non-Error rejections from less surface through the String(error) branch
vi.mock('less', () => ({
    default: {
        render: vi.fn(async () => {
            throw 'plain-less-failure'
        }),
    },
}))

const { loadAndResolveLessVars } = await import(
    '../../../src/utils/less-vars-to-js.js'
)

let root: string | undefined

afterEach(() => {
    root = undefined
})

describe('loadAndResolveLessVars render failures', () => {
    it('stringifies non-Error failures into the message', async () => {
        root = mkdtempSync(path.join(tmpdir(), 'wgs-less-err-'))
        writeFileSync(path.join(root, 'v.less'), '@a: 1;\n')

        await expect(
            loadAndResolveLessVars(path.join(root, 'v.less'))
        ).rejects.toThrowError(/plain-less-failure/)
    })
})
