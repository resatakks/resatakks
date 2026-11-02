// npm run nightly → botu gece penceresi bitene kadar çalıştırır, 07:45'te sabah raporu, 08:00'de çıkış.
process.env.NIGHTLY_EXIT = '1';
await import('./index.js');
