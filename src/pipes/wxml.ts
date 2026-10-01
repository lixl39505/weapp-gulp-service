import { aliasPipe } from 'deltic'
import type { Transform } from 'streamx'

// .wxml: alias rewriting with the html attribute strategy.
export function wxmlPipe(): Transform {
    return aliasPipe({ strategies: { '.wxml': 'html' } })
}

// .wxs: alias rewriting with the js import strategy.
export function wxsPipe(): Transform {
    return aliasPipe({ strategies: { '.wxs': 'js' } })
}
