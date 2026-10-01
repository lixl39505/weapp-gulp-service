import { Parser } from 'htmlparser2'

const forAliasRE = /([\s\S]*?)\s+(?:in|of)\s+([\s\S]*)/
const forIteratorRE = /,([^,\}\]]*)(?:,([^,\}\]]*))?$/
const stripParensRE = /^\(|\)$/g

export interface ParsedFor {
    for: string
    alias: string
    iterator1?: string
    iterator2?: string
}

// v-for="(item, index) in arr" → { for, alias, iterator1 }
export function parseFor(exp: string): ParsedFor | undefined {
    const inMatch = exp.match(forAliasRE)

    if (inMatch === null) {
        return undefined
    }

    const result: ParsedFor = {
        for: inMatch[2]!.trim(),
        alias: '',
    }

    const alias = inMatch[1]!.trim().replace(stripParensRE, '')
    const iteratorMatch = alias.match(forIteratorRE)

    if (iteratorMatch !== null) {
        result.alias = alias.replace(forIteratorRE, '').trim()
        result.iterator1 = iteratorMatch[1]!.trim()

        if (iteratorMatch[2] !== undefined) {
            result.iterator2 = iteratorMatch[2]!.trim()
        }
    } else {
        result.alias = alias
    }

    return result
}

export interface SfcStyleSlice {
    lang: string
    text: string
}

type Attrs = Record<string, string>

interface Modifiers {
    stop?: boolean
    capture?: boolean
    mut?: boolean
    [key: string]: boolean | undefined
}

export interface SfcParserOptions {
    tagAlias?: Record<string, string>
}

export interface SfcParseResult {
    wxml: string
    js: string
    json: string
    style: SfcStyleSlice[]
}

// Mini-program single-file-component parser (1.0 `utils/sfc-parser.js`):
// walks the SFC tree and compiles the template with Vue-like directives
// (v-for/v-if/v-show/:prop/@event) into wx: syntax. Events fire only on
// write()/end(), so reading fields after end() is safe.
export class SfcParser extends Parser {
    root = ''
    rootAttrs: Attrs | null = null
    level = 0

    wxml = ''
    js = ''
    json = ''
    style: SfcStyleSlice[] = []

    constructor(options: SfcParserOptions = {}) {
        const tagAlias = options.tagAlias ?? {}

        super(
            {
                onopentag: (tagName: string, attributes: Attrs) => {
                    if (this.level === 0) {
                        this.root = tagName
                        this.rootAttrs = attributes
                    }

                    this.level++

                    if (this.root === 'template' && this.level > 1) {
                        let attrs = ''

                        if (attributes['v-for'] !== undefined) {
                            const vfor = attributes['v-for']

                            delete attributes['v-for']
                            delete attributes['wx:for']
                            delete attributes['wx:for-item']
                            delete attributes['wx:for-index']

                            const parsed = parseFor(vfor)

                            if (parsed !== undefined && parsed.for !== '') {
                                attrs += ` wx:for="{{ ${parsed.for} }}"`

                                if (
                                    parsed.alias !== '' &&
                                    parsed.alias !== 'item'
                                ) {
                                    attrs += ` wx:for-item="{{ ${parsed.alias} }}"`
                                }

                                if (
                                    parsed.iterator1 !== undefined &&
                                    parsed.iterator1 !== 'index'
                                ) {
                                    attrs += ` wx:for-index="{{ ${parsed.iterator1} }}"`
                                }
                            }
                        }

                        for (let [name, value] of Object.entries(attributes)) {
                            if (name === ':key') {
                                // :key="item.id" → wx:key="id"
                                name = 'wx:key'
                                value = value.split('.').pop()!
                            } else if (name.startsWith(':')) {
                                // :prop="value" → prop="{{ value }}"
                                name = name.slice(1)
                                value = `{{ ${value.trim()} }}`
                            } else if (name.startsWith('@')) {
                                // @event="handler" → bind:event
                                // @event.stop     → catch:event
                                // @event.capture  → capture-bind:event
                                // @event.mut      → mut-bind:event
                                // combos allowed; `mut` wins
                                name = name.slice(1)
                                let modifier: Modifiers = {}
                                const sep = name.indexOf('.')

                                if (sep >= 0) {
                                    modifier = name
                                        .slice(sep + 1)
                                        .split('.')
                                        .reduce<Modifiers>((acc, key) => {
                                            acc[key] = true
                                            return acc
                                        }, {})
                                    name = name.slice(0, sep)
                                }

                                if (modifier.mut === true) {
                                    name = `mut-bind:${name}`
                                } else {
                                    name =
                                        modifier.stop === true
                                            ? `catch:${name}`
                                            : `bind:${name}`

                                    if (modifier.capture === true) {
                                        name = `capture-${name}`
                                    }
                                }
                            } else if (name.startsWith('v-')) {
                                if (name === 'v-show') {
                                    name = 'hidden'
                                    value = `{{ ${value} === false }}`
                                } else if (name === 'v-if') {
                                    name = 'wx:if'
                                    value = `{{ ${value} }}`
                                } else if (name === 'v-else-if') {
                                    name = 'wx:elif'
                                    value = `{{ ${value} }}`
                                } else if (name === 'v-else') {
                                    name = 'wx:else'
                                    value = ''
                                }
                            }

                            if (value) {
                                attrs += ` ${name}="${value}"`
                            } else {
                                attrs += ` ${name}`
                            }
                        }

                        this.wxml += `<${tagAlias[tagName] ?? tagName}${attrs}>`
                    }
                },
                ontext: (text: string) => {
                    if (this.root === 'script') {
                        if (this.rootAttrs?.name === 'json') {
                            // keep the last json script
                            this.json = text.trim()
                        } else {
                            this.js += text.trimLeft()
                        }
                    } else if (this.root === 'style') {
                        this.style.push({
                            lang: this.rootAttrs?.lang ?? 'css',
                            text: text.trim(),
                        })
                    } else if (this.root === 'template') {
                        this.wxml += text
                    }
                },
                onclosetag: (tagName: string) => {
                    if (this.root === 'template' && this.level > 1) {
                        this.wxml += `</${tagAlias[tagName] ?? tagName}>`
                    }

                    this.level--

                    if (this.level === 0) {
                        this.root = ''
                        this.rootAttrs = null
                    }
                },
                oncomment: (data: string) => {
                    this.wxml += `<!--${data}`
                },
                oncommentend: () => {
                    this.wxml += '-->'
                },
            },
            {
                lowerCaseTags: false,
                lowerCaseAttributeNames: false,
                recognizeSelfClosing: true,
            }
        )
    }

    parse(input: string): void {
        this.write(input)
        this.end()
    }
}
