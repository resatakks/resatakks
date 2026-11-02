// Haftalık filtre + çıkış optimizasyonu (walk-forward). Config'i ASLA otomatik değiştirmez.
// Kullanım: npm run optimize            (data/ altındaki jsonl'ler)
//           DATA_DIR=./pulled npm run optimize
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from '../src/config.js';
import { runOptimization } from '../src/optimizer.js';
import { utcDay } from '../src/util.js';

const { report } = runOptimization();
const out = path.join(DATA_DIR, `optimize-${utcDay()}.md`);
fs.writeFileSync(out, report);
console.log(report);
console.log(`\n→ ${out}`);
