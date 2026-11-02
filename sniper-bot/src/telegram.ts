import { env } from './config.js';
import { errMsg, getJson, log, sleep } from './util.js';

const api = (m: string) => `https://api.telegram.org/bot${env('TELEGRAM_BOT_TOKEN')}/${m}`;

export async function tg(text: string) {
  try {
    await getJson(api('sendMessage'), {
      method: 'POST',
      body: JSON.stringify({ chat_id: env('TELEGRAM_CHAT_ID'), text, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
  } catch (e) {
    log.warn('telegram send', { err: errMsg(e) });
  }
}

export type Commands = Record<string, (args: string[]) => Promise<string>>;

// Long-polling; yalnız TELEGRAM_CHAT_ID'den gelen komutlar işlenir.
export async function startCommands(cmds: Commands) {
  const chatId = env('TELEGRAM_CHAT_ID');
  let offset = 0;
  for (;;) {
    try {
      const r = await getJson<any>(api(`getUpdates?timeout=30&offset=${offset}`), {}, 40_000);
      for (const u of r.result ?? []) {
        offset = u.update_id + 1;
        const msg = u.message;
        if (!msg?.text || String(msg.chat.id) !== chatId) continue;
        const [cmd, ...args] = msg.text.trim().split(/\s+/);
        const h = cmds[cmd.replace(/@.*/, '').toLowerCase()];
        await tg(h ? await h(args).catch((e) => `hata: ${errMsg(e)}`) : `komutlar: ${Object.keys(cmds).join(' ')}`);
      }
    } catch (e) {
      log.warn('telegram poll', { err: errMsg(e) });
      await sleep(5000);
    }
  }
}
