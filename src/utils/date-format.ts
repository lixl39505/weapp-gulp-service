const regYear = /(Y+)/i

function pad(num: number): string {
    return num < 10 ? `0${num}` : String(num)
}

/**
 * `YYYY-MM-DD HH:mm:ss` style formatting — port of 1.0's `dateFormat`, used
 * for the default upload description.
 */
export function dateFormat(
    timestamp: number,
    format = 'YYYY-MM-DD HH:mm:ss'
): string {
    const realDate = new Date(Number.parseInt(String(timestamp), 10))

    const date: Array<[string, string | number]> = [
        ['M+', pad(realDate.getMonth() + 1)],
        ['D+', pad(realDate.getDate())],
        ['H+', pad(realDate.getHours())],
        ['m+', pad(realDate.getMinutes())],
        ['s+', pad(realDate.getSeconds())],
        ['q+', Math.floor((realDate.getMonth() + 3) / 3)],
        ['S+', realDate.getMilliseconds()],
    ]

    const year = regYear.exec(format)

    if (year !== null) {
        format = format.replace(
            year[1]!,
            String(realDate.getFullYear()).substring(4 - year[1]!.length)
        )
    }

    for (const [token, value] of date) {
        const match = new RegExp(`(${token})`).exec(format)

        if (match !== null) {
            format = format.replace(
                match[1]!,
                match[1]!.length === 1
                    ? String(value)
                    : `00${value}`.substring(String(value).length)
            )
        }
    }

    return format
}
