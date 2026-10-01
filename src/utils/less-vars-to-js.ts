import { readFileSync } from 'node:fs'
import path from 'node:path'

import less from 'less'

export function getRegexpMatches(
    regexp: RegExp,
    text: string
): RegExpExecArray[] {
    const matches: RegExpExecArray[] = []
    const lastIndex = regexp.lastIndex
    let match: RegExpExecArray | null

    do {
        match = regexp.exec(text)

        if (match !== null) {
            matches.push(match)
        }
        // prevent infinite loops (only global regexes retain `lastIndex`)
    } while (match !== null && regexp.global)

    // don't leak `lastIndex` changes
    regexp.lastIndex = lastIndex

    return matches
}

function replaceSubstring(
    input: string,
    start: number,
    end: number,
    replacement: string
): string {
    return input.substring(0, start) + replacement + input.substring(end)
}

const importRegExp = /^@import\s+['"]([^'"]+)['"];$/gm

function loadLessWithImports(entry: string): {
    code: string
    imports: string[]
} {
    const entryPath = path.resolve(entry)
    const input = readFileSync(entryPath, 'utf8')
    const imports = getRegexpMatches(importRegExp, input).map((match) => {
        const importPath = match[1]!
        const fullImportPath = /\.less$/.test(importPath)
            ? importPath
            : `${importPath}.less`
        const resolvedImportPath = /^~/.test(importPath)
            ? path.resolve('node_modules', fullImportPath.slice(1))
            : path.resolve(path.dirname(entryPath), fullImportPath)

        return {
            match,
            path: resolvedImportPath,
            ...loadLessWithImports(resolvedImportPath),
        }
    })

    return {
        code: imports.reduceRight(
            (acc, { match, code }) =>
                replaceSubstring(
                    acc,
                    match.index,
                    match.index + match[0].length,
                    code
                ),
            input
        ),
        imports: imports.reduce<string[]>(
            (acc, { path: importFile, imports: nestedImports }) => [
                ...acc,
                ...nestedImports,
                importFile,
            ],
            []
        ),
    }
}

const varNameRegExp = /^\s*@([\w-]+)\s*:/gm

function findLessVariables(lessCode: string): string[] {
    return getRegexpMatches(varNameRegExp, lessCode).map((match) => match[1]!)
}

const cssVarRegExp = /--([^:]+): ([^;]*);/g

/**
 * Loads a less file and all of its imports (transitively), compiles it, and
 * returns every resolved variable as `{ name: value }`. TS port of the
 * vendored `less-vars-to-js` (1.0), without the babel/core-js artifact.
 */
export async function loadAndResolveLessVars(
    entry: string,
    lessOptions?: Less.Options
): Promise<Record<string, string>> {
    const { code: lessCode } = loadLessWithImports(entry)
    return resolveLessVariables(lessCode, lessOptions)
}

async function resolveLessVariables(
    lessCode: string,
    lessOptions?: Less.Options
): Promise<Record<string, string>> {
    const varNames = findLessVariables(lessCode)
    let renderResult: Less.RenderOutput

    try {
        renderResult = await less.render(
            `${lessCode} #resolved {\n${varNames
                .map((varName) => `--${varName}: @${varName};`)
                .join('\n')}\n}`,
            lessOptions ?? {}
        )
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)

        throw new Error(
            `Less render failed! (${message}) Less code:\n${lessCode}\nVariables found:\n${varNames.join(', ')}`
        )
    }

    return getRegexpMatches(
        cssVarRegExp,
        renderResult.css.replace(/#resolved {(.*)}/, '$1')
    ).reduce<Record<string, string>>(
        (acc, [, varName, value]) => ({ ...acc, [varName!]: value! }),
        {}
    )
}
