// Renders teaser.html frame-by-frame with headless Chromium and writes PNGs.
// usage: node render.js <outDir> [fps] [--preview t1,t2,...] [--from frameIndex]
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
(async () => {
  const outDir = process.argv[2]; const fps = Number(process.argv[3] || 60);
  const previewIdx = process.argv.indexOf('--preview');
  const previewTimes = previewIdx > -1 ? process.argv[previewIdx + 1].split(',').map(Number) : null;
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => { console.error('PAGE ERROR', e); process.exitCode = 1; });
  await page.goto('file://' + path.resolve(__dirname, 'teaser.html'));
  await page.evaluate(() => window.ready);
  const dur = await page.evaluate(() => window.DUR);
  const fromIdx = process.argv.indexOf('--from'); const from = fromIdx > -1 ? Number(process.argv[fromIdx + 1]) : 0;
  const times = previewTimes || Array.from({ length: Math.round(dur * fps) }, (_, i) => i / fps);
  const t0 = Date.now();
  for (let i = from; i < times.length; i++) {
    await page.evaluate(t => window.render(t), times[i]);
    await page.screenshot({ path: path.join(outDir, previewTimes ? `p_${times[i].toFixed(2)}.png` : `f${String(i).padStart(4, '0')}.png`), type: 'png' });
    if (i % 120 === 0) console.log(`frame ${i}/${times.length} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  await browser.close(); console.log('done', times.length, 'frames');
})();
