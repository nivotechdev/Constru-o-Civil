// Visual + behavioural parity check: the legacy vanilla-JS app (../app) vs. this React build (dist/).
//
// Both apps are served side by side and driven through the same scripted journeys (scenarios.mjs) at
// three viewport widths (phone, tablet, desktop). After every step it compares:
//   - the rendered DOM of #app (tags, class tokens, attributes, inline styles, text, form state);
//   - the computed style and box of every element (catches any CSS difference);
//   - focus (document.activeElement), scroll position and URL;
//   - a screenshot of the whole page (scrolled and stitched), pixel by pixel.
//
// Usage: npm run build && npm run parity
// Options (environment): PARITY_ONLY=<scenario substring> · PARITY_VIEWPORTS=phone,tablet,desktop ·
// PARITY_CONCURRENCY=<journeys at once, default 1> · PARITY_REFERENCE=<dir of the app to compare with>
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pixelmatch from 'pixelmatch';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { SCENARIOS } from './scenarios.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '../..');
const REACT_DIR = path.resolve(webRoot, 'dist');
// The app everything is compared against: the legacy app by default; PARITY_REFERENCE=<dir> points
// at another build instead (e.g. the React build before a refactor, for a zero-difference check).
const REFERENCE_DIR = process.env.PARITY_REFERENCE
  ? path.resolve(process.env.PARITY_REFERENCE)
  : path.resolve(webRoot, '../app');
const REFERENCE_LABEL = process.env.PARITY_REFERENCE ? 'referência' : 'legado';
const OUT = path.resolve(here, 'output');
// pixelmatch's YIQ threshold: 0.01 ignores only ±1-level rasterisation noise in a colour channel.
const PIXEL_THRESHOLD = 0.01;
const AA_MAX_PIXELS = 16;
const AA_MAX_DELTA = 24;

// Largest per-channel difference among the pixels pixelmatch flagged (painted red in `diff`).
function maxChannelDelta(a, b, diff) {
  let max = 0;
  for (let i = 0; i < diff.data.length; i += 4) {
    if (diff.data[i] === 255 && diff.data[i + 1] === 0 && diff.data[i + 2] === 0) {
      for (let c = 0; c < 3; c++) max = Math.max(max, Math.abs(a.data[i + c] - b.data[i + c]));
    }
  }
  return max;
}
const FONT_CACHE = path.resolve(here, '.font-cache');
const FONTS_CSS =
  'https://fonts.googleapis.com/css2?family=Barlow:wght@600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap';
const CHROME_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
// Faces the apps use; loaded explicitly before every capture so both pages always render with them.
const FONT_FACES = [
  '600 16px Barlow',
  '700 16px Barlow',
  '400 16px "Plus Jakarta Sans"',
  '500 16px "Plus Jakarta Sans"',
  '600 16px "Plus Jakarta Sans"',
  '700 16px "Plus Jakarta Sans"',
  '400 16px "Space Mono"',
  '700 16px "Space Mono"'
];

// Google Fonts are fetched once (curl honours the environment's proxy) and then served to both pages
// from disk, so font loading can never make the two captures differ.
function cachedFontFile(url) {
  fs.mkdirSync(FONT_CACHE, { recursive: true });
  const file = path.join(FONT_CACHE, crypto.createHash('sha1').update(url).digest('hex'));
  if (!fs.existsSync(file)) execFileSync('curl', ['-sSfL', '-A', CHROME_UA, '-o', file, url]);
  return file;
}
function prepareFonts() {
  const css = fs.readFileSync(cachedFontFile(FONTS_CSS), 'utf8');
  for (const m of css.matchAll(/url\((https:[^)]+)\)/g)) cachedFontFile(m[1]);
}
async function routeFonts(context) {
  await context.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) => {
    const url = route.request().url();
    const file = cachedFontFile(url);
    route.fulfill({
      status: 200,
      body: fs.readFileSync(file),
      headers: {
        'content-type': url.includes('googleapis') ? 'text/css' : 'font/woff2',
        'access-control-allow-origin': '*'
      }
    });
  });
}

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 800, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 }
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json'
};

function serve(dir) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let file = path.join(dir, url === '/' ? 'index.html' : url);
      if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory())
        file = path.join(dir, 'index.html');
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

// Computed properties compared on every element. Margins are left out: their layout effect is
// already compared through every element's box, and Chrome resolves `margin: auto` inconsistently.
const STYLE_PROPS = [
  'display',
  'position',
  'top',
  'left',
  'right',
  'bottom',
  'z-index',
  'box-sizing',
  'width',
  'height',
  'min-width',
  'max-width',
  'min-height',
  'max-height',

  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'border-top-color',
  'border-bottom-color',
  'border-top-style',
  'border-top-left-radius',
  'border-bottom-right-radius',
  'color',
  'background-color',
  'background-image',
  'opacity',
  'visibility',
  'overflow-x',
  'overflow-y',
  'font-family',
  'font-size',
  'font-weight',
  'line-height',
  'letter-spacing',
  'text-align',
  'text-transform',
  'text-decoration-line',
  'white-space',
  'text-overflow',
  'flex-direction',
  'flex-wrap',
  'flex-grow',
  'flex-shrink',
  'flex-basis',
  'align-items',
  'justify-content',
  'gap',
  'row-gap',
  'column-gap',
  'grid-template-columns',
  'order',
  'transform',
  'filter',
  'backdrop-filter',
  'box-shadow',
  'outline-style',
  'cursor',
  'pointer-events',
  'mask-image',
  'transition-property',
  'transition-duration',
  'animation-name',
  'object-fit',
  'aspect-ratio',
  'scroll-snap-type',
  'user-select'
];

// Serialises #app for comparison. Attributes whose values are generated per implementation (ids,
// the legacy render loop's focus bookkeeping, React's value-attribute syncing) are left out; form state
// is compared through the live properties instead.
function snapshotInPage(styleProps) {
  // Boolean attributes: presence is what matters (the legacy app set some to "true", React to "").
  const BOOLEAN_ATTRS = new Set(['multiple', 'controls', 'disabled', 'readonly', 'required', 'hidden']);
  const SKIP_ATTRS = new Set([
    'id',
    'for',
    'data-focus-id',
    'autofocus',
    'value',
    'checked',
    'selected',
    'class',
    'style',
    'aria-labelledby'
  ]);
  const round = (n) => Math.round(n * 2) / 2;
  const styleOf = (el) =>
    Array.from(el.style)
      .map((p) => `${p}:${el.style.getPropertyValue(p)}`)
      .sort()
      .join(';');
  const boxes = [];
  const walk = (el, pathStr) => {
    const node = { tag: el.tagName.toLowerCase() };
    const cls = Array.from(new Set((el.getAttribute('class') || '').split(/\s+/).filter(Boolean))).sort();
    if (cls.length) node.class = cls.join(' ');
    // Elements that aren't rendered (inside display:none, e.g. the phone tab bar on desktop) can't
    // differ visually; their inline styles and boxes are skipped (tags, classes, attributes and text
    // are still compared).
    const rendered = el.getClientRects().length > 0 || el.tagName === 'svg';
    const st = styleOf(el);
    if (st && rendered) node.style = st;
    const attrs = Array.from(el.attributes)
      .filter((a) => !SKIP_ATTRS.has(a.name))
      .map((a) => (BOOLEAN_ATTRS.has(a.name) ? a.name : `${a.name}=${a.value.replace(/^blob:.*$/, 'blob:')}`))
      .sort();
    if (attrs.length) node.attrs = attrs;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
      node.value = el.value;
      if (el.type === 'checkbox' || el.type === 'radio') node.checked = el.checked;
      if (el.disabled) node.disabled = true;
    }
    const kids = [];
    let text = '';
    const flush = () => {
      if (text.trim()) kids.push({ text });
      text = '';
    };
    // React mirrors a <textarea>'s value into a text child; the value itself is compared above.
    const childNodes = el instanceof HTMLTextAreaElement ? [] : Array.from(el.childNodes);
    childNodes.forEach((c, i) => {
      if (c.nodeType === 3) text += c.nodeValue;
      else if (c.nodeType === 1) {
        flush();
        kids.push(walk(c, `${pathStr}>${c.tagName.toLowerCase()}[${i}]`));
      }
    });
    flush();
    if (kids.length) node.children = kids;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    // A loading spinner's angle depends on the instant of capture; its box/style are not compared.
    if (cs.animationName === 'bicos-spin' || !rendered) return node;
    boxes.push({
      path: pathStr,
      box: [round(r.x), round(r.y + window.scrollY), round(r.width), round(r.height)].join(','),
      style: styleProps.map((p) => cs.getPropertyValue(p)).join('|')
    });
    return node;
  };
  const app = document.getElementById('app');
  const dom = walk(app, 'app');
  const a = document.activeElement;
  const focus =
    a && a !== document.body
      ? `${a.tagName.toLowerCase()}|${a.getAttribute('aria-label') || a.getAttribute('placeholder') || a.textContent.trim().slice(0, 40)}|caret:${a.selectionStart ?? ''}-${a.selectionEnd ?? ''}`
      : 'body';
  return {
    dom,
    boxes,
    focus,
    scrollY: Math.round(window.scrollY),
    hash: location.hash,
    title: document.title,
    bodyClass: document.body.className
  };
}

async function settle(page) {
  await page.evaluate(async (faces) => {
    await Promise.all(faces.map((f) => document.fonts.load(f)));
    await new Promise((r) => requestAnimationFrame(r));
    await document.fonts.ready;
    const imgs = Array.from(document.images).filter((i) => !i.complete && i.loading !== 'lazy');
    await Promise.all(
      imgs.map(
        (i) =>
          new Promise((r) => {
            i.onload = i.onerror = r;
          })
      )
    );
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, FONT_FACES);
  await page.waitForTimeout(60);
}

// The whole page, captured by scrolling the viewport down and stitching the frames. (Playwright's and
// Chrome's own full-page capture briefly resize the window to 1×1, which both apps' photo carousels —
// by design — treat as a resize and reset; that would make the harness itself change the state.)
async function capture(page, { full, animations }) {
  const shoot = async () => PNG.sync.read(await page.screenshot({ animations, caret: 'hide' }));
  if (!full) return shoot();
  const { y0, height, vh } = await page.evaluate(() => ({
    y0: window.scrollY,
    height: document.documentElement.scrollHeight,
    vh: window.innerHeight
  }));
  if (height <= vh) return shoot();
  let out = null;
  for (let y = 0; y < height; y += vh) {
    const top = await page.evaluate((to) => {
      window.scrollTo(0, to);
      return window.scrollY;
    }, y);
    await page.evaluate(async () => {
      const inView = Array.from(document.images).filter((i) => {
        const r = i.getBoundingClientRect();
        return !i.complete && r.bottom > 0 && r.top < window.innerHeight;
      });
      await Promise.race([
        Promise.all(
          inView.map(
            (i) =>
              new Promise((r) => {
                i.onload = i.onerror = r;
              })
          )
        ),
        new Promise((r) => setTimeout(r, 2000))
      ]);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    });
    const frame = await shoot();
    if (!out) out = new PNG({ width: frame.width, height });
    const skip = y - top; // the last frame can't scroll a full viewport further
    for (let row = skip; row < frame.height && top + row < height; row++) {
      frame.data.copy(out.data, (top + row) * out.width * 4, row * frame.width * 4, (row + 1) * frame.width * 4);
    }
  }
  await page.evaluate((to) => window.scrollTo(0, to), y0);
  await page.waitForTimeout(60);
  return out;
}

async function runStep(page, step) {
  const loc = (s) => (typeof s === 'function' ? s(page) : page.locator(s).first());
  if (step.hold) await page.evaluate(() => (window.__parity.hold = true));
  switch (step.do) {
    case 'release':
      await page.evaluate(() => window.__parity.release());
      break;
    case 'hash':
      await page.evaluate((h) => {
        location.hash = h;
      }, step.to);
      await page.waitForTimeout(80);
      break;
    case 'click':
      await loc(step.target).click(step.options || {});
      break;
    case 'fill':
      await loc(step.target).fill(step.value);
      break;
    case 'type':
      await loc(step.target).pressSequentially(step.value, { delay: 5 });
      break;
    case 'press':
      await page.keyboard.press(step.key);
      break;
    case 'select':
      await loc(step.target).selectOption(step.value);
      break;
    case 'files':
      await loc(step.target).setInputFiles(step.files);
      break;
    case 'scroll':
      await page.evaluate((y) => window.scrollTo(0, y), step.y);
      await page.waitForTimeout(120);
      break;
    case 'mouse':
      await page.mouse.move(step.x, step.y);
      break;
    case 'wait':
      await page.waitForTimeout(step.ms);
      break;
    case 'eval':
      await page.evaluate(step.fn);
      break;
    default:
      throw new Error('unknown step ' + step.do);
  }
  await page.waitForTimeout(step.after ?? 50);
}

function diffTree(a, b, p = 'app', out = []) {
  if (out.length > 12) return out;
  for (const k of ['tag', 'class', 'style', 'value', 'checked', 'disabled', 'text']) {
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k]))
      out.push(`${p} ${k}: ${JSON.stringify(a[k])} ≠ ${JSON.stringify(b[k])}`);
  }
  if (JSON.stringify(a.attrs) !== JSON.stringify(b.attrs))
    out.push(`${p} attrs: ${JSON.stringify(a.attrs)} ≠ ${JSON.stringify(b.attrs)}`);
  const ca = a.children || [];
  const cb = b.children || [];
  if (ca.length !== cb.length) out.push(`${p} children: ${ca.length} ≠ ${cb.length}`);
  for (let i = 0; i < Math.min(ca.length, cb.length); i++)
    diffTree(ca[i], cb[i], `${p}>${ca[i].tag || '#text'}[${i}]`, out);
  return out;
}

// One scripted journey at one viewport: both apps side by side, compared after every `snap` step.
async function runScenario(browser, base, vp, scenario) {
  const results = [];
  const pages = {};
  const errors = { legacy: [], react: [] };
  for (const which of ['legacy', 'react']) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      reducedMotion: scenario.motion ? 'no-preference' : 'reduce',
      ignoreHTTPSErrors: true,
      locale: 'pt-BR',
      permissions: scenario.geolocation ? ['geolocation'] : [],
      geolocation: scenario.geolocation
    });
    await routeFonts(context);
    context.setDefaultTimeout(5000);
    const page = await context.newPage();
    page.on('pageerror', (e) => errors[which].push(String(e)));
    await page.addInitScript(() => {
      // Steps with `hold: true` capture a transient "loading" state: while held, the apps' simulated
      // server delays (setTimeout ≥ 300 ms) wait for a `release` step instead of firing on their own,
      // so the capture can't miss the state however loaded the machine is.
      const realSetTimeout = window.setTimeout.bind(window);
      const held = [];
      const parity = {
        hold: false,
        release() {
          parity.hold = false;
          held.splice(0).forEach(([cb, args]) => realSetTimeout(cb, 0, ...args));
        }
      };
      Object.defineProperty(window, '__parity', { value: parity });
      window.setTimeout = (cb, ms, ...args) => {
        if (parity.hold && typeof cb === 'function' && ms >= 300) {
          held.push([cb, args]);
          return 0;
        }
        return realSetTimeout(cb, ms, ...args);
      };
      let seed = 0.5;
      Math.random = () => seed;
      const fixed = new Date('2026-09-25T12:00:00Z').getTime();
      const RealDate = Date;
      // Fixed "today" (post dates) without touching timers.
      globalThis.Date = class extends RealDate {
        constructor(...args) {
          super(...(args.length ? args : [fixed]));
        }
        static now() {
          return fixed;
        }
      };
    });
    await page.goto(base[which] + (scenario.start || '#/splash'));
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(250);
    pages[which] = page;
  }

  let snapIndex = 0;
  const steps = scenario.steps.some((s) => s.do === 'snap')
    ? scenario.steps
    : [...scenario.steps, { do: 'snap', name: 'end' }];
  for (const [stepIndex, step] of steps.entries()) {
    if (step.only && !step.only.includes(vp.name)) continue;
    if (step.do !== 'snap') {
      for (const which of ['legacy', 'react']) {
        try {
          await runStep(pages[which], step);
        } catch (e) {
          errors[which].push(
            `step #${stepIndex} ${step.do} ${step.desc || String(step.target ?? step.to ?? '').slice(0, 60)}: ${String(e).split('\n')[0]}`
          );
        }
      }
      continue;
    }
    snapIndex++;
    const id = `${vp.name}__${scenario.name}__${String(snapIndex).padStart(2, '0')}-${step.name.replace(/[^a-zA-Z0-9-]+/g, '_')}`;
    const shots = {};
    const data = {};
    for (const which of ['legacy', 'react']) {
      await settle(pages[which]);
      data[which] = await pages[which].evaluate(snapshotInPage, STYLE_PROPS);
      shots[which] = await capture(pages[which], {
        full: !step.viewportOnly,
        animations: scenario.motion ? 'allow' : 'disabled'
      });
    }
    const L = data.legacy;
    const R = data.react;
    const domDiff = diffTree(L.dom, R.dom);
    const boxDiff = [];
    const len = Math.max(L.boxes.length, R.boxes.length);
    for (let i = 0; i < len && boxDiff.length < 8; i++) {
      const a = L.boxes[i];
      const b = R.boxes[i];
      if (!a || !b) {
        boxDiff.push(`element count ${L.boxes.length} ≠ ${R.boxes.length}`);
        break;
      }
      if (a.box !== b.box) boxDiff.push(`${a.path} box ${a.box} ≠ ${b.box}`);
      if (a.style !== b.style) {
        const sa = a.style.split('|');
        const sb = b.style.split('|');
        const props = STYLE_PROPS.filter((_, k) => sa[k] !== sb[k]).map(
          (p) => `${p}: ${sa[STYLE_PROPS.indexOf(p)]} ≠ ${sb[STYLE_PROPS.indexOf(p)]}`
        );
        boxDiff.push(`${a.path} style ${props.join('; ')}`);
      }
    }
    let pixels = -1;
    let maxDelta = 0;
    const { width, height } = shots.legacy;
    if (width === shots.react.width && height === shots.react.height) {
      const diff = new PNG({ width, height });
      pixels = pixelmatch(shots.legacy.data, shots.react.data, diff.data, width, height, {
        threshold: PIXEL_THRESHOLD
      });
      maxDelta = maxChannelDelta(shots.legacy, shots.react, diff);
      if (pixels) {
        fs.writeFileSync(path.join(OUT, id + '.diff.png'), PNG.sync.write(diff));
        fs.writeFileSync(path.join(OUT, id + '.legacy.png'), PNG.sync.write(shots.legacy));
        fs.writeFileSync(path.join(OUT, id + '.react.png'), PNG.sync.write(shots.react));
      }
    } else {
      fs.writeFileSync(path.join(OUT, id + '.legacy.png'), PNG.sync.write(shots.legacy));
      fs.writeFileSync(path.join(OUT, id + '.react.png'), PNG.sync.write(shots.react));
    }
    const meta = [];
    for (const k of ['focus', 'scrollY', 'hash', 'title', 'bodyClass'])
      if (L[k] !== R[k]) meta.push(`${k}: ${JSON.stringify(L[k])} ≠ ${JSON.stringify(R[k])}`);
    const structural = domDiff.length === 0 && boxDiff.length === 0 && meta.length === 0;
    // A handful of pixels differing by a few levels, with DOM, styles and boxes identical, is
    // antialiasing noise from the rasteriser (seen on the edges of masked icons), not a difference.
    const antialias = structural && pixels > 0 && pixels <= AA_MAX_PIXELS && maxDelta <= AA_MAX_DELTA;
    const ok = structural && (pixels === 0 || antialias);
    results.push({
      id,
      viewport: vp.name,
      scenario: scenario.name,
      step: step.name,
      hash: L.hash,
      ok,
      pixels,
      antialias,
      size: `${width}x${height}`,
      domDiff,
      boxDiff,
      meta,
      elements: L.boxes.length
    });
    process.stdout.write(
      `${ok ? '✔' : '✘'} ${id} ${ok ? '' : JSON.stringify({ pixels, dom: domDiff.slice(0, 3), box: boxDiff.slice(0, 3), meta })}\n`
    );
  }
  for (const which of ['legacy', 'react']) {
    if (errors[which].length) {
      results.push({
        id: `${vp.name}__${scenario.name}__errors-${which}`,
        viewport: vp.name,
        scenario: scenario.name,
        ok: false,
        errors: errors[which]
      });
      process.stdout.write(`✘ ${vp.name} ${scenario.name} ${which} errors: ${errors[which].join(' | ')}\n`);
    }
    await pages[which].context().close();
  }
  return results;
}

async function main() {
  if (!fs.existsSync(path.join(REACT_DIR, 'index.html'))) throw new Error('Build first: npm run build');
  if (!fs.existsSync(path.join(REFERENCE_DIR, 'index.html'))) throw new Error('No reference app at ' + REFERENCE_DIR);
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  prepareFonts();
  const legacyServer = await serve(REFERENCE_DIR);
  const reactServer = await serve(REACT_DIR);
  const base = {
    legacy: `http://127.0.0.1:${legacyServer.address().port}/index.html`,
    react: `http://127.0.0.1:${reactServer.address().port}/index.html`
  };
  const browser = await chromium.launch();
  const only = process.env.PARITY_ONLY;
  const viewports = VIEWPORTS.filter(
    (v) => !process.env.PARITY_VIEWPORTS || process.env.PARITY_VIEWPORTS.split(',').includes(v.name)
  );
  const jobs = viewports.flatMap((vp) =>
    SCENARIOS.filter((s) => (!only || s.name.includes(only)) && (!s.viewports || s.viewports.includes(vp.name))).map(
      (scenario) => ({ vp, scenario })
    )
  );

  // Journeys are independent (each gets fresh browser contexts), so they can run side by side;
  // the report keeps the fixed viewport × scenario order whatever the completion order.
  const concurrency = Math.max(1, Number(process.env.PARITY_CONCURRENCY) || 1);
  const perJob = new Array(jobs.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, jobs.length) }, async () => {
      while (next < jobs.length) {
        const i = next++;
        perJob[i] = await runScenario(browser, base, jobs[i].vp, jobs[i].scenario);
      }
    })
  );
  const results = perJob.flat();

  await browser.close();
  legacyServer.close();
  reactServer.close();

  const failed = results.filter((r) => !r.ok);
  const snapsTotal = results.filter((r) => r.step).length;
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(results, null, 2));
  const lines = [
    `# Relatório de paridade (${REFERENCE_LABEL} × React)`,
    '',
    `- Referência: \`${path.relative(webRoot, REFERENCE_DIR) || '.'}\``,
    `- Viewports: ${viewports.map((v) => `${v.name} ${v.width}×${v.height}`).join(', ')}`,
    `- Cenários: ${new Set(results.map((r) => r.scenario)).size} · capturas comparadas: ${snapsTotal}`,
    `- Idênticas (DOM + estilos computados + caixas + foco/scroll/URL + pixels): ${snapsTotal - failed.filter((r) => r.step).length}/${snapsTotal}`,
    `- Falhas: ${failed.length}`,
    '',
    '| Viewport | Cenário | Passo | Rota | Elementos | Pixels diferentes | OK |',
    '|---|---|---|---|---|---|---|',
    ...results
      .filter((r) => r.step)
      .map(
        (r) =>
          `| ${r.viewport} | ${r.scenario} | ${r.step} | \`${r.hash}\` | ${r.elements} | ${r.pixels}${r.antialias ? ' (ruído de antialiasing)' : ''} | ${r.ok ? '✅' : '❌'} |`
      )
  ];
  fs.writeFileSync(path.join(OUT, 'report.md'), lines.join('\n') + '\n');
  console.log(
    `\n${snapsTotal - failed.filter((r) => r.step).length}/${snapsTotal} snapshots identical; ${failed.length} failures. Report: ${path.relative(webRoot, OUT)}/report.md`
  );
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
