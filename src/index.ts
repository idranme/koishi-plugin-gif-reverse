import { Schema, Context, h } from 'koishi'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { unlink, writeFile } from 'node:fs/promises'
import { } from 'koishi-plugin-ffmpeg'

export const name = 'gif-reverse'
export const inject = {
    required: ['http', 'ffmpeg']
}

export interface Config { }

export const Config: Schema<Config> = Schema.object({})

export function apply(ctx: Context, cfg: Config) {
    const TMP_DIR = tmpdir()
    ctx.command('gif-reverse [gif:image]', '对 GIF 图片进行倒放')
        .alias('倒放')
        .action(async ({ session }, gif) => {
            /*if (!gif && session.quote) {
                const { quote } = session
                if (quote.elements) {
                    gif = h.select(quote.elements, 'img')[0].attrs
                } else {
                    const { elements } = await session.bot.getMessage(session.channelId, quote.id)
                    gif = h.select(elements, 'img')[0].attrs
                }
            }*/

            const quote = h.quote(session.messageId)
            if (!gif) return `${quote}未检测到图片输入。`

            const file = await ctx.http.file(gif.src)
            if (!['image/gif', 'application/octet-stream'].includes(file.mime)) {
                return `${quote}无法处理非 GIF 图片。`
            }
            const path = join(TMP_DIR, `gif-reverse-${Date.now()}`)
            await writeFile(path, Buffer.from(file.data))
            const buf = await ctx.ffmpeg
                .builder()
                .input(path)
                .outputOption('-vf', 'reverse,split[s0][s1];[s0]palettegen=stats_mode=single[p];[s1][p]paletteuse=new=1', '-f', 'gif', '-gifflags', '-offsetting')
                .run('buffer')
            await unlink(path)
            if (buf.length === 0) return `${quote}图片生成失败。`
            return [quote, h.img(buf, 'image/gif')]
        })
}
