import { describe, expect, it, vi } from 'vitest'

import { deepTraverse } from '../../../src/utils/deep-traverse.js'

describe('deepTraverse', () => {
    it('walks single objects and forests depth-first', () => {
        const seen: string[] = []

        deepTraverse(
            [{ id: 'a', children: [{ id: 'a1' }, { id: 'a2' }] }, { id: 'b' }],
            (node) => {
                seen.push(node.id as string)
            }
        )

        expect(seen).toEqual(['a', 'a1', 'a2', 'b'])
    })

    it('passes the parent node and stops on false', () => {
        const tree = { id: 'root', children: [{ id: 'leaf' }] }
        const pairs: Array<[string, string | null]> = []

        deepTraverse([tree], (node, parent) => {
            pairs.push([node.id as string, (parent?.id as string) ?? null])
            return node.id !== 'root'
        })

        expect(pairs).toEqual([['root', null]])
    })

    it('accepts a single (non-array) tree and a custom stop', () => {
        const tree = { id: 'a', children: [{ id: 'b' }] }
        const seen: string[] = []

        deepTraverse(tree, (node) => {
            seen.push(node.id as string)
            return true
        })

        expect(seen).toEqual(['a', 'b'])
    })

    it('continues when the callback returns nothing', () => {
        const spy = vi.fn()
        const tree = { id: 'a', children: [{ id: 'b' }] }

        deepTraverse(tree, spy)

        expect(spy).toHaveBeenCalledTimes(2)
    })

    it('stops descending when a child callback returns false', () => {
        const tree = {
            id: 'root',
            children: [{ id: 'stop' }, { id: 'skipped' }],
        }
        const seen: string[] = []

        deepTraverse([tree], (node) => {
            seen.push(node.id as string)
            return node.id !== 'stop'
        })

        expect(seen).toEqual(['root', 'stop'])
    })

    it('supports a custom children key option', () => {
        const tree = { id: 'a', kids: [{ id: 'b' }] } as never
        const seen: string[] = []

        deepTraverse(
            tree,
            (node) => {
                seen.push((node as { id: string }).id)
            },
            { children: 'kids' as never }
        )

        expect(seen).toEqual(['a', 'b'])
    })
})
