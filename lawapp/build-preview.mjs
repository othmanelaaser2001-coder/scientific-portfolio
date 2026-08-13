/**
 * Bundle the app into a single self-contained HTML file.
 *
 *   node build-preview.mjs [outfile]      # default: preview.html
 *
 * Why this exists: the app is normally a folder of ES modules plus a service
 * worker, which needs a server. Hosts that accept exactly one HTML file — a
 * published artifact, a pasted snippet, an email attachment — cannot run that.
 * This inlines the modules, the stylesheet and the icons into one file so the
 * browse/search/schedule-preview side of the app travels anywhere.
 *
 * What the bundle deliberately loses: the service worker, and with it offline
 * caching and background delivery. The banner injected below says so, so a
 * preview is never mistaken for the installable app.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (f) => readFile(resolve(here, f), 'utf8');

/** Strip ES module syntax so several modules can share one classic scope. */
function flatten(src) {
  return src
    .replace(/^\s*import\s+[^;]*?from\s+'[^']+';\s*$/gm, '')
    .replace(/^export\s+(?=(const|let|function|async|class)\b)/gm, '')
    .trim();
}

async function dataUri(file) {
  const svg = await read(file);
  return 'data:image/svg+xml;base64,' + Buffer.from(svg, 'utf8').toString('base64');
}

const BANNER = `
<div class="preview-banner" role="note">
  <p><strong>نسخة للعرض</strong> — التصفح والبحث وجدولة التنبيهات كيخدمو. التنبيهات الحقيقية كتطلب النسخة المثبتة.</p>
  <p><strong>Aperçu</strong> — navigation, recherche et programmation fonctionnent. Les notifications système exigent l'app installée.</p>
</div>`;

const BANNER_CSS = `
.preview-banner {
  max-width: var(--maxw);
  margin: 0 auto;
  padding: 10px 16px;
  border-bottom: 1px solid var(--line-soft);
  background: var(--bg-sunken);
}
.preview-banner p {
  margin: 0;
  font-size: 0.74rem;
  line-height: 1.5;
  color: var(--ink-faint);
}
.preview-banner strong { color: var(--warn); }
`;

const [html, css, store, data, scheduler, app, icon, badge] = await Promise.all([
  read('index.html'),
  read('styles.css'),
  read('store.js'),
  read('data.js'),
  read('scheduler.js'),
  read('app.js'),
  dataUri('icons/icon.svg'),
  dataUri('icons/badge.svg'),
]);

// Body markup only: the artifact host supplies doctype/html/head/body.
const body = html
  .replace(/[\s\S]*?<body[^>]*>/i, '')
  .replace(/<\/body>[\s\S]*/i, '')
  .replace(/<script\b[\s\S]*?<\/script>/gi, '')
  .trim();

// data.js must come first — scheduler and app close over its exports.
const bundle = [data, scheduler, app]
  .map(flatten)
  .join('\n\n')
  .replaceAll("'./icons/icon.svg'", JSON.stringify(icon))
  .replaceAll("'./icons/badge.svg'", JSON.stringify(badge));

const out = `<title>Aref Haqqak</title>
<style>
${css.trim()}
${BANNER_CSS.trim()}
</style>

${BANNER.trim()}
${body}

<script>
self.MLAW_SINGLE_FILE = true;
${store.trim()}
</script>
<script type="module">
${bundle}
</script>
`;

const target = resolve(here, process.argv[2] || 'preview.html');
await writeFile(target, out, 'utf8');
console.log(`wrote ${target} — ${(out.length / 1024).toFixed(1)} KB`);
