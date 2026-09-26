// ==========================================================
// 新しく追加されたライブ情報から、インスタのストーリー用の画像（1080×1920）を作る
// GitHub Actions（.github/workflows/story.yml）から動く
//
// ・microCMS のライブ情報を全部読み、posted.json にまだ無いライブだけ画像にする
//   （誤字を直して保存し直しても、同じライブの画像は二度作らない）
// ・終わったライブ（今日より前）は作らない
// ・画像は .github/story/out/ に出る
// ==========================================================
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const SERVICE_DOMAIN = 'junkie2631150';
const API_KEY = process.env.MICROCMS_API_KEY; // GitHub の Secrets に入れておく
if (!API_KEY) throw new Error('MICROCMS_API_KEY がありません（GitHub の Secrets に入れてください）');

const dir = path.dirname(fileURLToPath(import.meta.url));
const postedPath = path.join(dir, 'posted.json');
const outDir = path.join(dir, 'out');

const res = await fetch(`https://${SERVICE_DOMAIN}.microcms.io/api/v1/live?limit=100`, {
  headers: { 'X-MICROCMS-API-KEY': API_KEY },
});
if (!res.ok) throw new Error('microCMS から読めませんでした: ' + res.status);
const lives = (await res.json()).contents;

// 初めて動いたときは、今あるライブを「作成済み」にするだけ（昔のライブの画像を一度に作らない）
if (!existsSync(postedPath)) {
  writeFileSync(postedPath, JSON.stringify(lives.map((l) => l.id), null, 2) + '\n');
  console.log('posted.json を作りました（' + lives.length + '件）。次のライブから画像を作ります。');
  process.exit(0);
}

const posted = JSON.parse(readFileSync(postedPath, 'utf8'));
const fresh = lives.filter((l) => !posted.includes(l.id));
if (fresh.length === 0) {
  console.log('新しいライブはありません。');
  process.exit(0);
}

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
today.setHours(0, 0, 0, 0);

for (const live of fresh) {
  await page.goto(pathToFileURL(path.join(dir, 'story.html')).href, { waitUntil: 'networkidle' });
  const d = await page.evaluate((raw) => LiveFormat.parseDate(raw), live.date || '');
  if (d.year && new Date(d.year, d.month - 1, d.day) < today) {
    console.log('終わったライブなので作りません: ' + live.date);
  } else {
    await page.evaluate((item) => renderStory(item), live);
    await page.waitForTimeout(500);
    const file = path.join(outDir, (d.ymd || live.id).replace(/\./g, '') + '_' + live.id + '.png');
    await page.screenshot({ path: file });
    console.log('作りました: ' + file);
  }
  posted.push(live.id);
}
await browser.close();
writeFileSync(postedPath, JSON.stringify(posted, null, 2) + '\n');
