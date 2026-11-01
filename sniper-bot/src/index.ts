import http from 'node:http';
import { CHAINS, cfg, env, isEvm, nativeSymbol } from './config.js';
import { closeAll, startMonitor, statusText } from './positions.js';
import { startScanner } from './scanner.js';
import { handleHeliusWebhook, pollEvm, walletCounts } from './smartmoney.js';
import { save, state } from './state.js';
import { startCommands, tg } from './telegram.js';
import { morningReport, startNightly } from './nightly.js';
import { startTracker } from './tracker.js';
import { errMsg, log } from './util.js';

// ---- HTTP: health + Helius webhook ----
const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, mode: cfg.mode, paused: state.paused, open: state.positions.filter((p) => p.status !== 'closed').length }));
  }
  if (req.method === 'POST' && req.url === '/webhook/helius') {
    if (req.headers.authorization !== env('HELIUS_WEBHOOK_AUTH')) {
      res.writeHead(401);
      return res.end();
    }
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        handleHeliusWebhook(JSON.parse(body));
      } catch (e) {
        log.warn('webhook parse', { err: errMsg(e) });
      }
      res.writeHead(200);
      res.end('ok');
    });
    return;
  }
  res.writeHead(404);
  res.end();
});
server.listen(Number(process.env.PORT || 8080));

// ---- Telegram komutları ----
void startCommands({
  '/status': async () => statusText(),
  '/rapor': async () => {
    // Sabah Raporu'nu şimdi üret (07:45 gönderimi sayılmaz); Telegram 4096 sınırı için parçala
    const text = morningReport();
    for (let i = 0; i < text.length - 3900; i += 3900) await tg(text.slice(i, i + 3900));
    return text.slice(Math.floor((text.length - 1) / 3900) * 3900);
  },
  '/pause': async () => {
    state.paused = true;
    state.pauseReason = 'telegram';
    save();
    return '⏸ yeni girişler durdu (açık pozisyonlar yönetilmeye devam ediyor)';
  },
  '/resume': async () => {
    state.paused = false;
    save();
    return '▶️ devam';
  },
  '/panic': async () => {
    state.paused = true;
    state.pauseReason = 'panic';
    save();
    await closeAll('panic');
    return '🛑 tüm pozisyonlar satıldı, bot durdu';
  },
});

// ---- Döngüler ----
for (const c of CHAINS) if (cfg.chains[c].enabled) startScanner(c);
startMonitor();
startTracker();
for (const c of CHAINS) {
  if (isEvm(c) && cfg.chains[c].enabled) setInterval(() => pollEvm(c).catch((e) => log.warn(`${c} wallets`, { err: errMsg(e) })), 15_000);
}

if (cfg.nightly.enabled || process.env.NIGHTLY_EXIT === '1') startNightly({ exitAtEnd: process.env.NIGHTLY_EXIT === '1' });

const wc = walletCounts();
log.info('started', { mode: cfg.mode, wallets: wc });
void tg(`🤖 bot başladı · <b>${cfg.mode.toUpperCase()}</b> · izlenen cüzdan ${CHAINS.map((c) => `${nativeSymbol(c)} ${wc[c]}`).join(' / ')}`);

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    save();
    log.info('shutdown', { sig });
    process.exit(0);
  });
}
process.on('unhandledRejection', (e) => log.error('unhandled', { err: errMsg(e) }));
