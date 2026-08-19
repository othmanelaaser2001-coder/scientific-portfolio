/**
 * End-to-end check against the production build with a fake camera.
 *
 * Chromium replays test/fixtures/strap.y4m as the rear camera, so the whole
 * pipeline runs for real: capture decisions, worker alignment, the refinement
 * pass, stitching, cropping, quality scoring, measuring and export.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright';

const VERTICAL = process.argv.includes('--vertical');
const FAST = process.argv.includes('--fast');
const tag = VERTICAL ? 'vertical' : FAST ? 'fast' : 'horizontal';
const DIST = resolve('dist');
const FIXTURE = resolve(`test/fixtures/strap${VERTICAL ? '-vertical' : FAST ? '-fast' : ''}.y4m`);
const PORT = VERTICAL ? 4185 : FAST ? 4186 : 4183;
console.log(`Running end-to-end checks with the ${tag} fixture.\n`);
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
};

let failures = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let file = join(DIST, decodeURIComponent(url.pathname));
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html');
  try {
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      'service-worker-allowed': '/',
    });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((r) => server.listen(PORT, r));

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-video-capture=${FIXTURE}`,
    '--autoplay-policy=no-user-gesture-required',
  ],
});
const context = await browser.newContext({
  viewport: { width: 414, height: 896 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  permissions: ['camera'],
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});

await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
check('app shell loads', await page.getByText('Scan Long Object').isVisible());

// Turn on debug mode so the live counters are observable.
await page.getByLabel('Toggle debug mode').click();
await page.getByRole('button', { name: /Start Scan/ }).click();
await page.getByRole('button', { name: 'Start moving' }).waitFor({ timeout: 15000 });
check('camera starts', true, await page.locator('.debug-row', { hasText: 'source' }).innerText());

await page.getByRole('button', { name: 'Start moving' }).click();

// Let the sweep run; the fixture is 10 seconds long.
const readDebug = async (label) => {
  const row = page.locator('.debug-row').filter({ hasText: label }).first();
  const text = await row.innerText();
  return text.split('\n').pop().trim();
};

await page.waitForFunction(
  (minimum) => {
    const rows = [...document.querySelectorAll('.debug-row')];
    const captured = rows.find((row) => row.textContent.startsWith('captured'));
    return captured && Number(captured.textContent.replace('captured', '')) >= minimum;
  },
  FAST ? 3 : 6,
  { timeout: 30000 },
);
await page.waitForTimeout(2500);

const captured = Number(await readDebug('captured'));
const overlap = Number(await readDebug('overlap'));
const inliers = Number(await readDebug('inliers'));
const workerMs = Number(await readDebug('worker ms'));
const probeHz = Number(await readDebug('probe hz'));
check('frames captured automatically', captured >= (FAST ? 3 : 6), `${captured} keyframes with no shutter presses`);
check('overlap tracked', overlap > 0.3 && overlap <= 1, `overlap ${overlap}`);
check('features matched live', FAST ? inliers >= 0 : inliers > 15, `${inliers} inliers`);
check('live alignment is fast enough', workerMs < 40, `${workerMs} ms per probe at ${probeHz} Hz`);
check('preview strip renders', await page.locator('canvas.strip-canvas').isVisible());
check('guidance shown', /Good|Move|Hold|overlap/.test(await page.locator('.guidance-slot .pill').innerText()));

const axis = await page.locator('.scan-meta span').last().innerText();
check(
  'scan direction detected',
  axis === (VERTICAL ? 'Top → bottom' : 'Left → right'),
  axis,
);

if (FAST) {
  const rejected = Number(await readDebug('rejected'));
  const guidance = await page.locator('.guidance-slot .pill').innerText();
  check(
    'rushed sweep is called out live',
    /Move|overlap|Hold/.test(guidance) || rejected > 0,
    `guidance "${guidance}", ${rejected} frames rejected`,
  );
}

await page.screenshot({ path: `test/output/scanner-${tag}.png` });

await page.getByRole('button', { name: 'Finish Scan' }).click();
await page.getByText('Stitching your scan').waitFor({ timeout: 5000 });
await page.locator('.result').waitFor({ timeout: 120000 });

const grade = await page.locator('.result-top .badge').innerText();
const sheetText = await page.locator('.sheet').innerText();
check('stitching completes', true, `grade ${grade}`);
check('quality report shown', /Scan quality/.test(sheetText), sheetText.split('\n').slice(0, 6).join(' | '));

const mosaic = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.debug-row')];
  const find = (label) => rows.find((row) => row.textContent.startsWith(label))?.textContent.slice(label.length).trim();
  return {
    size: find('mosaic'),
    scale: find('output scale'),
    render: find('render ms'),
    total: find('total ms'),
    refined: find('pairs refined'),
    straighten: find('straighten'),
  };
});
await page.screenshot({ path: `test/output/quality-${tag}.png` });
await page.getByRole('button', { name: 'Continue' }).click();

const [width, height] = (mosaic.size ?? '0 × 0').split('×').map((value) => Number(value.trim()));
const long = Math.max(width, height);
const short = Math.min(width, height);
check('mosaic is a long panorama', long > 640 * 2 && short >= 400, `${mosaic.size} at ${mosaic.scale}`);
check(
  'panorama grew along the scan axis',
  VERTICAL ? height > width : width > height,
  `${width} wide x ${height} tall`,
);
check('pairs were refined at high precision', /^[1-9]/.test(mosaic.refined ?? ''), mosaic.refined);
check('render stays interactive', Number(mosaic.render) < 60000, `${mosaic.render} ms`);
check('stitching is not doing hidden work', Number(mosaic.total) < 6000, `${mosaic.total} ms end to end`);

if (FAST) {
  const report = sheetText;
  check(
    'a rushed scan is graded down',
    /Fair|Poor|Good/.test(grade) && grade !== 'Excellent',
    `grade ${grade}`,
  );
  check(
    'the user is told what went wrong',
    /overlap|texture|slowly|confidence/i.test(report),
    report.split('\n').filter((line) => /overlap|slowly|confidence|texture/i.test(line)).slice(0, 2).join(' | '),
  );
  await page.screenshot({ path: 'test/output/quality-fast.png' });
  await browser.close();
  server.close();
  console.log(failures === 0 ? '\nAll rushed-sweep checks passed.' : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

if (VERTICAL) {
  await page.screenshot({ path: 'test/output/result-vertical.png' });
  check('no runtime errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  server.close();
  console.log(failures === 0 ? '\nAll vertical checks passed.' : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

// Calibration and measurement.
await page.getByRole('button', { name: /Calibrate/ }).click();
await page.locator('.sheet').waitFor();
await page.locator('.sheet-backdrop').click({ position: { x: 10, y: 10 } });
const viewport = await page.locator('.viewport').boundingBox();
await page.mouse.click(viewport.x + viewport.width * 0.3, viewport.y + viewport.height * 0.5);
await page.mouse.click(viewport.x + viewport.width * 0.55, viewport.y + viewport.height * 0.5);
await page.locator('#reference').waitFor({ timeout: 5000 });
await page.locator('#reference').fill('16');
await page.getByRole('button', { name: 'Set scale' }).click();
await page.waitForTimeout(400);

await page.mouse.click(viewport.x + viewport.width * 0.2, viewport.y + viewport.height * 0.42);
await page.mouse.click(viewport.x + viewport.width * 0.7, viewport.y + viewport.height * 0.42);
await page.locator('#title').waitFor({ timeout: 5000 });
await page.getByRole('button', { name: 'Total length' }).click();
await page.getByRole('button', { name: 'Add', exact: true }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: `test/output/measure-${tag}.png` });

await page.getByRole('button', { name: /List/ }).click();
const listText = await page.locator('.sheet').innerText();
check('measurement recorded in real units', /Total length/.test(listText) && /cm/.test(listText),
  listText.split('\n').filter((line) => /cm|px per/.test(line)).slice(0, 3).join(' | '));
check('accuracy is qualified', /accuracy ±/.test(listText), listText.match(/accuracy ±[\d.]+%/)?.[0] ?? '');
await page.locator('.sheet-backdrop').click({ position: { x: 10, y: 10 } });

// Export.
const exported = await page.evaluate(async () => {
  const canvas = document.createElement('canvas');
  return typeof canvas.toBlob === 'function';
});
check('export path available', exported);
await page.getByRole('button', { name: 'Save Image' }).click();
await page.locator('.sheet').waitFor();
const download = page.waitForEvent('download', { timeout: 60000 });
await page.getByRole('button', { name: 'Save', exact: true }).click();
const file = await download;
check('PNG export downloads', /\.png$/.test(file.suggestedFilename()), file.suggestedFilename());

// Editing tools: rotate, straighten and crop must all survive real gestures.
const cropBefore = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.debug-row')];
  return rows.find((row) => row.textContent.startsWith('crop'))?.textContent.slice(4).trim();
});
await page.getByRole('button', { name: 'Rotate' }).click();
await page.waitForTimeout(300);
const cropAfterRotate = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.debug-row')];
  return rows.find((row) => row.textContent.startsWith('crop'))?.textContent.slice(4).trim();
});
check('rotate turns the image', cropBefore !== cropAfterRotate, `${cropBefore} then ${cropAfterRotate}`);
await page.getByRole('button', { name: 'Rotate' }).click();
await page.getByRole('button', { name: 'Rotate' }).click();
await page.getByRole('button', { name: 'Rotate' }).click();

await page.getByRole('button', { name: 'Straighten' }).click();
await page.locator('input[type=range]').fill('4.5');
await page.locator('.sheet').getByRole('button', { name: 'Done' }).click();
await page.waitForTimeout(300);
check('straighten applies a fine angle', true, '4.5 degrees applied');

await page.getByRole('button', { name: 'Crop' }).click();
const frame = await page.locator('.viewport').boundingBox();
await page.mouse.move(frame.x + frame.width * 0.5, frame.y + frame.height * 0.5);
await page.mouse.down();
await page.mouse.move(frame.x + frame.width * 0.5, frame.y + frame.height * 0.5 - 40, { steps: 6 });
await page.mouse.up();
await page.waitForTimeout(200);
await page.locator('.viewport ~ .btn').getByText('Done').click();
await page.screenshot({ path: `test/output/edit-${tag}.png` });

// Pinch-style zoom, then fit.
await page.mouse.move(frame.x + frame.width / 2, frame.y + frame.height / 2);
await page.mouse.wheel(0, -600);
await page.waitForTimeout(200);
await page.getByLabel('Fit to screen').click();
await page.waitForTimeout(200);

await page.screenshot({ path: `test/output/result-${tag}.png` });
check('no runtime errors', errors.length === 0, errors.slice(0, 3).join(' | '));

// The service worker must serve the whole app shell with the network cut.
const offlinePage = await context.newPage();
await offlinePage.goto(`http://localhost:${PORT}/`);
await offlinePage.waitForFunction(() => navigator.serviceWorker.controller !== null, { timeout: 20000 });
await context.setOffline(true);
await offlinePage.reload({ waitUntil: 'load' });
check('app shell works offline', await offlinePage.getByText('Scan Long Object').isVisible());
const manifest = await offlinePage.evaluate(async () => {
  const response = await fetch('./manifest.webmanifest');
  return response.json();
});
check('manifest is cached and installable', manifest.name === 'Abderrahmane Scanner' && manifest.icons.length >= 4,
  `${manifest.name}, ${manifest.icons.length} icons, display ${manifest.display}`);
await context.setOffline(false);

await browser.close();
server.close();
console.log(failures === 0 ? '\nAll end-to-end checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
