import { read } from '@/js/b'

export default function (name) {
    return read(process.env.APP_PUBLICK_PATH + name)
}
