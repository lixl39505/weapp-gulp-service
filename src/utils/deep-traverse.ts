type ChildrenKey = 'children'

export interface TreeNode {
    children?: TreeNode[]
    [key: string]: unknown
}

/**
 * Depth-first tree walk with early exit — port of 1.0's `deepTraverse`, used
 * by the extended app.json route parser. The callback returns `false` to stop
 * descending into the current node; returning `undefined`/`true` continues.
 */
export function deepTraverse<T extends TreeNode>(
    forest: T | T[],
    callback: (node: T, parent: T | null) => boolean | void,
    options: { children?: ChildrenKey } = {}
): void {
    const trees = (Array.isArray(forest) ? forest : [forest]) as T[]
    const { children = 'children' } = options

    function iterate(node: T, parent: T | null): boolean {
        const isContinue = callback(node, parent)

        if ((isContinue ?? true) && node[children] !== undefined) {
            for (const child of node[children]!) {
                if (!iterate(child as T, node)) {
                    return false
                }
            }
        }

        return isContinue ?? true
    }

    for (const root of trees) {
        if (!iterate(root, null)) {
            return
        }
    }
}
