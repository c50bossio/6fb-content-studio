import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, 'screenshots');

// Sidebar button labels in order — these are clicked via the sidebar nav
const pages = [
  { name: '01_dashboard',      label: 'Dashboard' },
  { name: '02_clip_extractor', label: 'Clip Extractor' },
  { name: '03_carousel',       label: 'Carousel' },
  { name: '04_video_editor',   label: 'Video Editor' },
  { name: '05_scheduler',      label: 'Scheduler' },
  { name: '06_analytics',      label: 'Analytics' },
  { name: '07_settings',       label: 'Settings' },
];

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // Load the app root (it should now bypass setup)
  console.log('🚀  Loading app...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0', timeout: 20000 });
  // Extra settle time for React/animations
  await new Promise(r => setTimeout(r, 3000));

  for (const { name, label } of pages) {
    console.log(`📸  Capturing ${name} (clicking "${label}")...`);
    try {
      // Find and click the sidebar button with matching text
      const buttons = await page.$$('button');
      let clicked = false;
      for (const btn of buttons) {
        const text = await page.evaluate(el => el.textContent?.trim(), btn);
        if (text && text.includes(label)) {
          await btn.click();
          clicked = true;
          break;
        }
      }
      if (!clicked) {
        console.error(`   ⚠️  Could not find button "${label}" — skipping`);
        continue;
      }

      // Wait for page transition / animations
      await new Promise(r => setTimeout(r, 2000));

      const file = path.join(outDir, `${name}.png`);
      await page.screenshot({ path: file, fullPage: false });
      console.log(`   ✅ saved ${file}`);
    } catch (err) {
      console.error(`   ❌ ${name} failed: ${err.message}`);
    }
  }

  await browser.close();
  console.log('\n🎉 Done! All screenshots in ./screenshots/');
})();
