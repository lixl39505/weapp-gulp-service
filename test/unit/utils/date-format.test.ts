import { describe, expect, it } from 'vitest'

import { dateFormat } from '../../../src/utils/date-format.js'

describe('dateFormat', () => {
    it('formats with the default pattern', () => {
        const out = dateFormat(new Date(2026, 0, 2, 3, 4, 5).getTime())

        expect(out).toBe('2026-01-02 03:04:05')
    })

    it('supports custom tokens (quarter, ms, short year)', () => {
        const date = new Date(2026, 9, 1, 0, 0, 0, 123)

        expect(dateFormat(date.getTime(), 'q')).toBe('4')
        expect(dateFormat(date.getTime(), 'S')).toBe('123')
        expect(dateFormat(date.getTime(), 'YYYY')).toBe('2026')
    })

    it('pads two-digit tokens and trims the year', () => {
        const date = new Date(2026, 0, 2, 3, 4, 5)

        expect(dateFormat(date.getTime(), 'MM-DD HH:mm:ss')).toBe(
            '01-02 03:04:05'
        )
        expect(dateFormat(date.getTime(), 'Y')).toBe('6')
    })
})
