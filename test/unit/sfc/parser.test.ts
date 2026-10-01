import { describe, expect, it } from 'vitest'

import { SfcParser, parseFor } from '../../../src/sfc/parser.js'

function parse(input: string, tagAlias?: Record<string, string>) {
    const parser = new SfcParser({ tagAlias })
    parser.parse(input)

    return parser
}

describe('parseFor', () => {
    it('parses item/index destructure', () => {
        expect(parseFor('(item, index) in list')).toEqual({
            for: 'list',
            alias: 'item',
            iterator1: 'index',
        })
    })

    it('parses (value, key) of object and custom iterators', () => {
        expect(parseFor('(v, k, i) of obj')).toEqual({
            for: 'obj',
            alias: 'v',
            iterator1: 'k',
            iterator2: 'i',
        })
    })

    it('returns undefined for malformed expressions', () => {
        expect(parseFor('nonsense')).toBeUndefined()
    })
})

describe('SfcParser', () => {
    it('splits template/script/json/style slices', () => {
        const parser = parse(
            [
                '<template><view>{{ msg }}</view></template>',
                '<script>const a = 1</script>',
                '<script name="json">module.exports = { component: true }</script>',
                '<style lang="less">.a { color: red; }</style>',
            ].join('\n')
        )

        expect(parser.wxml).toContain('<view>')
        expect(parser.js).toContain('const a = 1')
        expect(parser.json).toBe('module.exports = { component: true }')
        expect(parser.style).toEqual([
            { lang: 'less', text: '.a { color: red; }' },
        ])
    })

    it('maps vue directives to wx: syntax', () => {
        const parser = parse(
            [
                '<template>',
                '  <view',
                '    v-for="(row, index) in rows"',
                '    :key="row.id"',
                '    :title="row.name"',
                '    @tap="onTap"',
                '    @tap.stop="onStop"',
                '    @touchmove.capture="onMove"',
                '    @touchstart.mut="onStart"',
                '    v-show="visible"',
                '    v-if="ok"',
                '    v-else-if="maybe"',
                '    v-else',
                '  >{{ row }}</view>',
                '</template>',
            ].join('\n')
        )

        const wxml = parser.wxml

        expect(wxml).toContain('wx:for="{{ rows }}"')
        expect(wxml).toContain('wx:for-item="{{ row }}"')
        expect(wxml).not.toContain('wx:for-index')
        expect(wxml).toContain('wx:key="id"')
        expect(wxml).toContain('title="{{ row.name }}"')
        expect(wxml).toContain('bind:tap="onTap"')
        expect(wxml).toContain('catch:tap="onStop"')
        expect(wxml).toContain('capture-bind:touchmove="onMove"')
        expect(wxml).toContain('mut-bind:touchstart="onStart"')
        expect(wxml).toContain('hidden="{{ visible === false }}"')
        expect(wxml).toContain('wx:if="{{ ok }}"')
        expect(wxml).toContain('wx:elif="{{ maybe }}"')
        expect(wxml).toContain('wx:else')
    })

    it('omits wx:for-item/index when they carry the defaults', () => {
        const parser = parse(
            [
                '<template>',
                '  <view v-for="(item, index) in items"',
                '    :key="item.id"',
                '    :title="item.name"',
                '    @tap="onTap"',
                '    @tap.stop="onStop"',
                '    @touchmove.capture="onMove"',
                '    @touchstart.mut="onStart"',
                '    v-show="visible"',
                '    v-if="ok"',
                '    v-else-if="maybe"',
                '    v-else',
                '  >{{ item }}</view>',
                '</template>',
            ].join('\n')
        )

        const wxml = parser.wxml

        expect(wxml).toContain('wx:for="{{ items }}"')
        // the default 'item' alias is omitted, as is the default index
        expect(wxml).not.toContain('wx:for-item')
        expect(wxml).not.toContain('wx:for-index')
        expect(wxml).toContain('wx:key="id"')
        expect(wxml).toContain('title="{{ item.name }}"')
        expect(wxml).toContain('bind:tap="onTap"')
        expect(wxml).toContain('catch:tap="onStop"')
        expect(wxml).toContain('capture-bind:touchmove="onMove"')
        expect(wxml).toContain('mut-bind:touchstart="onStart"')
        expect(wxml).toContain('hidden="{{ visible === false }}"')
        expect(wxml).toContain('wx:if="{{ ok }}"')
        expect(wxml).toContain('wx:elif="{{ maybe }}"')
        expect(wxml).toContain('wx:else')
    })

    it('does not emit wx:for-item when the alias is empty or "item"', () => {
        const empty = parse(
            '<template><view v-for="() in items"></view></template>'
        )

        expect(empty.wxml).toContain('wx:for="{{ items }}"')
        expect(empty.wxml).not.toContain('wx:for-item')

        const item = parse(
            '<template><view v-for="item in items"></view></template>'
        )

        expect(item.wxml).not.toContain('wx:for-item')
    })

    it('maps vue directives to wx: syntax (legacy shape)', () => {
        const parser = parse(
            [
                '<template>',
                '  <view',
                '    v-for="(item, idx) in items"',
                '    :key="item.id"',
                '    :title="item.name"',
                '    @tap="onTap"',
                '    @tap.stop="onStop"',
                '    @touchmove.capture="onMove"',
                '    @touchstart.mut="onStart"',
                '    v-show="visible"',
                '    v-if="ok"',
                '    v-else-if="maybe"',
                '    v-else',
                '  >{{ item }}</view>',
                '</template>',
            ].join('\n')
        )

        const wxml = parser.wxml

        expect(wxml).toContain('wx:for="{{ items }}"')
        expect(wxml).toContain('wx:for-index="{{ idx }}"')
        expect(wxml).not.toContain('wx:for-item')
        expect(wxml).toContain('wx:key="id"')
        expect(wxml).toContain('title="{{ item.name }}"')
        expect(wxml).toContain('bind:tap="onTap"')
        expect(wxml).toContain('catch:tap="onStop"')
        expect(wxml).toContain('capture-bind:touchmove="onMove"')
        expect(wxml).toContain('mut-bind:touchstart="onStart"')
        expect(wxml).toContain('hidden="{{ visible === false }}"')
        expect(wxml).toContain('wx:if="{{ ok }}"')
        expect(wxml).toContain('wx:elif="{{ maybe }}"')
        expect(wxml).toContain('wx:else')
    })

    it('defaults wx:for-item/index and keeps plain attributes', () => {
        const parser = parse(
            '<template><view v-for="item in items" data-x="1"></view></template>'
        )

        expect(parser.wxml).toContain('wx:for="{{ items }}"')
        expect(parser.wxml).not.toContain('wx:for-item')
        expect(parser.wxml).not.toContain('wx:for-index')
        expect(parser.wxml).toContain('data-x="1"')
    })

    it('skips empty v-for bodies', () => {
        const parser = parse('<template><view v-for="x in "></view></template>')

        expect(parser.wxml).not.toContain('wx:for')
    })

    it('skips wx:for-item for empty aliases and untouched v- directives', () => {
        const parser = parse(
            '<template><view v-for="() in items" v-custom="keep">x</view></template>'
        )

        expect(parser.wxml).not.toContain('wx:for-item')
        expect(parser.wxml).toContain('v-custom="keep"')
    })

    it('constructs with default options', () => {
        const parser = new SfcParser()

        parser.parse('<template><view/></template>')

        expect(parser.wxml).toContain('<view>')
    })

    it('applies tag aliases on open and close tags', () => {
        const parser = parse('<template><div><span>x</span></div></template>', {
            div: 'view',
            span: 'text',
        })

        expect(parser.wxml).toBe('<view><text>x</text></view>')
    })

    it('joins multiple style slices and keeps the last json script', () => {
        const parser = parse(
            [
                '<template><view/></template>',
                '<script name="json">module.exports = { a: 1 }</script>',
                '<script name="json">module.exports = { a: 2 }</script>',
                '<style>.a{}</style>',
                '<style lang="less">.b{}</style>',
            ].join('\n')
        )

        expect(parser.json).toBe('module.exports = { a: 2 }')
        expect(parser.style).toEqual([
            { lang: 'css', text: '.a{}' },
            { lang: 'less', text: '.b{}' },
        ])
    })

    it('preserves comments inside templates and handles self-closing roots', () => {
        const parser = parse('<template><!-- comment --><img /></template>')

        expect(parser.wxml).toContain('<!-- comment -->')
        expect(parser.level).toBe(0)
    })
})
