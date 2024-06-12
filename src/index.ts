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
        .option('pts', '-p <times:number> 改变每个帧的显示时间戳（大于 1 为减速，小于则为加速）', { fallback: 1 })
        .action(async ({ session, options }, gif) => {
            const { pts } = options
            if (pts <= 0) return 'PTS 必须大于 0'
            if (!gif) {
                const [msgId] = await session.send('在 50 秒内发送想要倒放的 GIF')
                const content = await session.prompt(50000)
                if (content !== undefined) {
                    gif = h.select(content, 'img')[0]?.attrs
                }
                try {
                    session.bot.deleteMessage(session.channelId, msgId)
                } catch { }
            }

            const quote = h.quote(session.messageId)
            if (!gif) return `${quote}未检测到图片输入。`

            const file = await ctx.http.file(gif.src)
            if (!['image/gif', 'application/octet-stream', 'video/mp4'].includes(file.type)) {
                return `${quote}无法处理非 GIF 图片。`
            }
            const path = join(TMP_DIR, `gif-reverse-${Date.now()}`)
            await writeFile(path, Buffer.from(file.data))
            let vf = 'reverse,split[s0][s1];[s0]palettegen=stats_mode=single[p];[s1][p]paletteuse=new=1'
            if (pts !== 1) {
                vf = `setpts=${pts}*PTS,` + vf
            }
            const buf = await ctx.ffmpeg
                .builder()
                .input(path)
                .outputOption('-vf', vf, '-f', 'gif', '-gifflags', '-offsetting')
                .run('buffer')
            unlink(path)
            if (buf.length === 0) return `${quote}图片生成失败。`
            return [quote, h.img(buf, 'image/gif')]
        })
}
