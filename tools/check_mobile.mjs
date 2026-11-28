#!/usr/bin/env node
/* Mobile-fit gate for the event sites in אתרים/.
   Opens every site in headless Chrome as a phone (touch, mobile viewport) at several screen sizes,
   scrolls through the whole page so every reveal/animation runs, and fails on:
     - a missing/blocked viewport meta (needs width=device-width; never user-scalable=no / maximum-scale<2)
     - horizontal scrolling, or visible content (text, buttons, images, inputs) sticking out of the screen
     - text clipped inside its own box (nowrap/overflow:hidden text wider than the box)
     - tap targets (buttons, .btn links, radio labels, inputs) smaller than 44×44px
     - inputs with font-size < 16px (iOS zooms the page in when they get focus)
     - body text smaller than 12px
     - fixed floating buttons (♿, music, WhatsApp…) overlapping each other or leaving the screen
   Decoration that crosses the edge on purpose gets data-layout-allow-overflow (on it or an ancestor);
   horizontal carousels inside an overflow-x:auto/scroll box are fine.

   Usage:  node tools/check_mobile.mjs [site-dir ...] [--shots <dir>]
           (no dirs = every folder in אתרים/;  --shots saves phone screenshots to look at)
   Exit 0 = OK, 1 = problems (each printed with the viewport and a selector). Needs Google Chrome. */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VIEWPORTS = [
  { name: '320×568 small phone', width: 320, height: 568 },
  { name: '375×667 iPhone SE', width: 375, height: 667 },
  { name: '390×844 iPhone', width: 390, height: 844, shots: true },
  { name: '430×932 large phone', width: 430, height: 932 },
  { name: '844×390 phone landscape', width: 844, height: 390 },
  { name: '768×1024 tablet', width: 768, height: 1024 },
];

const args = process.argv.slice(2);
let shotsDir = null;
const dirs = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--shots') shotsDir = path.resolve(args[++i]);
  else dirs.push(path.resolve(args[i]));
}
const sites = dirs.length ? dirs : fs.readdirSync(path.join(ROOT, 'אתרים'), { withFileTypes: true })
  .filter(d => d.isDirectory()).map(d => path.join(ROOT, 'אתרים', d.name)).sort();
if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });

const CHROME = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']
  .map(b => process.env.PATH.split(':').map(p => path.join(p, b)).find(f => fs.existsSync(f))).find(Boolean)
  || process.env.CHROME;
if (!CHROME) { console.error('Google Chrome not found (set CHROME=/path/to/chrome)'); process.exit(2); }

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- minimal CDP client (Node 22 has a built-in WebSocket) ---------- */
async function launch() {
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'mobilecheck-'));
  const proc = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${prof}`,
    '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--mute-audio',
    '--allow-file-access-from-files', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', 'about:blank'], { stdio: 'ignore' });
  const portFile = path.join(prof, 'DevToolsActivePort');
  for (let i = 0; i < 100 && !fs.existsSync(portFile); i++) await sleep(100);
  const [port] = fs.readFileSync(portFile, 'utf8').split('\n');
  return { proc, prof, port };
}

async function openPage(port) {
  const t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const wait = new Map(); const listeners = [];
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && wait.has(m.id)) { const { res, rej } = wait.get(m.id); wait.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
    else if (m.method) listeners.forEach(l => l(m));
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; wait.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  const once = method => new Promise(res => { const l = m => { if (m.method === method) { listeners.splice(listeners.indexOf(l), 1); res(m.params); } }; listeners.push(l); });
  const evaluate = async (fn, ...a) => {
    const r = await send('Runtime.evaluate', { expression: `(${fn})(...${JSON.stringify(a)})`, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  await send('Page.enable'); await send('Runtime.enable');
  return { send, once, evaluate, close: () => { ws.close(); return fetch(`http://127.0.0.1:${port}/json/close/${t.id}`); } };
}

/* ---------- runs inside the page ---------- */
function measure() {
  const vw = innerWidth, vh = innerHeight, out = [];
  const css = (el) => getComputedStyle(el);
  const sel = (el) => {
    if (el.id) return `#${el.id}`;
    let s = el.tagName.toLowerCase();
    if (el.classList.length) s += '.' + [...el.classList].slice(0, 3).join('.');
    const p = el.parentElement;
    return p && p !== document.body ? `${p.id ? '#' + p.id : p.tagName.toLowerCase() + (p.classList[0] ? '.' + p.classList[0] : '')} > ${s}` : s;
  };
  const txt = (el) => (el.innerText || el.value || el.getAttribute('aria-label') || el.alt || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  const visible = (el) => {
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const s = css(e);
      if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity < 0.05) return false;
      if (e.hasAttribute('data-layout-allow-overflow') || e.closest('.a11y-skip')) return false;
    }
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  // horizontal clip box from ancestors; null = sits in a horizontal scroller (carousel) → fine
  const clipX = (el) => {
    let l = -Infinity, r = Infinity;
    for (let e = el.parentElement; e && e !== document.body && e !== document.documentElement; e = e.parentElement) {
      const ox = css(e).overflowX;
      if (ox === 'auto' || ox === 'scroll') return null;
      if (ox === 'hidden' || ox === 'clip') { const b = e.getBoundingClientRect(); l = Math.max(l, b.left); r = Math.min(r, b.right); }
    }
    return { l, r };
  };

  // 1) page-level horizontal scroll
  const sw = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
  const ox = css(document.documentElement).overflowX + '/' + css(document.body).overflowX;
  if (sw > vw + 1 && !/hidden|clip/.test(ox)) out.push(['hscroll', `page scrolls sideways: ${sw}px wide in a ${vw}px screen`]);

  const all = [...document.body.querySelectorAll('*')].filter(el => !el.closest('svg') || el.tagName === 'svg');
  const hasText = (el) => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
  const isTap = (el) => el.matches('button, .btn, input:not([type=radio]):not([type=checkbox]):not([type=hidden]), select, textarea, .choice label, [role=button]')
    || (el.matches('a[href]') && !el.closest('p, li, .demo-note, footer') );
  const seen = new Set();
  for (const el of all) {
    const content = hasText(el) || el.matches('img, video, input, textarea, select, button, a[href], iframe');
    if (!content || !visible(el)) continue;
    const r = el.getBoundingClientRect(), s = css(el);
    const fixed = s.position === 'fixed' || s.position === 'sticky';

    // 2) sticking out of the screen (after ancestor clipping)
    const c = clipX(el);
    if (c && !fixed) {
      const left = Math.max(r.left, c.l), right = Math.min(r.right, c.r);
      if (right > left && (right > vw + 1 || left < -1)) {
        const k = 'out' + sel(el);
        if (!seen.has(k)) { seen.add(k); out.push(['offscreen', `${sel(el)} "${txt(el)}" sticks out of the screen (${Math.round(left)}…${Math.round(right)}px of ${vw}px)`]); }
      }
      // visible part clipped by an ancestor (text cut off)
      if (hasText(el) && (r.right > c.r + 2 || r.left < c.l - 2) && c.r - c.l < vw + 2 && c.r !== Infinity) {
        const k = 'cut' + sel(el);
        if (!seen.has(k)) { seen.add(k); out.push(['clipped', `${sel(el)} "${txt(el)}" is cut off by its container (${Math.round(r.width)}px wide, container shows ${Math.round(c.r - c.l)}px)`]); }
      }
    }
    // 3) text wider than its own box
    if (hasText(el) && (s.whiteSpace === 'nowrap' || /hidden|clip/.test(s.overflowX)) && el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0 && !el.matches('.sr-only')) {
      out.push(['textfit', `${sel(el)} "${txt(el)}" text is wider than its box (${el.scrollWidth}px in ${el.clientWidth}px)`]);
    }
    // 3b) text squeezed into a narrow column (one or two words per line)
    if (hasText(el) && !fixed) {
      const words = el.innerText.trim().split(/\s+/).length, lh = parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.3;
      const lines = Math.round(r.height / lh);
      if (words >= 4 && lines >= 3 && lines >= words * 0.6 && r.width < vw * 0.4) {
        out.push(['squeezed', `${sel(el)} "${txt(el)}" is squeezed into a ${Math.round(r.width)}px column (${lines} lines for ${words} words)`]);
      }
    }
    // 4) tap targets
    if (isTap(el) && !el.matches('.sr-only') && (r.width < 43.5 || r.height < 43.5) && !(el.matches('input') && el.closest('.choice'))) {
      out.push(['tap', `${sel(el)} "${txt(el)}" tap target ${Math.round(r.width)}×${Math.round(r.height)}px (min 44×44)`]);
    }
    // 5) iOS zoom on focus
    if (el.matches('input:not([type=radio]):not([type=checkbox]), textarea, select') && parseFloat(s.fontSize) < 16) {
      out.push(['input', `${sel(el)} font-size ${s.fontSize} — inputs need ≥16px or iOS zooms in on focus`]);
    }
    // 6) tiny text
    if (hasText(el) && parseFloat(s.fontSize) < 12 && !el.closest('[aria-hidden=true]')) {
      out.push(['small', `${sel(el)} "${txt(el)}" font-size ${s.fontSize} (min 12px on a phone)`]);
    }
  }
  // 7) floating buttons: inside the screen and not on top of each other
  const floats = all.filter(el => css(el).position === 'fixed' && el.matches('button, a[href], [role=button]') && visible(el) && !el.closest('.a11y-panel, .a11y-dlg, dialog, .modal, [role=dialog]'));
  floats.forEach((a, i) => {
    const ra = a.getBoundingClientRect();
    if (ra.left < -1 || ra.right > vw + 1 || ra.top < -1 || ra.bottom > vh + 1) out.push(['float', `floating ${sel(a)} is outside the screen`]);
    floats.slice(i + 1).forEach(b => {
      const rb = b.getBoundingClientRect();
      if (ra.left < rb.right - 2 && rb.left < ra.right - 2 && ra.top < rb.bottom - 2 && rb.top < ra.bottom - 2) out.push(['float', `floating ${sel(a)} overlaps ${sel(b)}`]);
    });
  });
  return out;
}

// wait until every finite CSS animation/transition has finished (looping decoration is ignored)
function idle() {
  return new Promise(res => {
    const t0 = performance.now();
    (function poll() {
      const busy = document.getAnimations().some(a => a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity);
      if ((!busy && performance.now() - t0 > 250) || performance.now() - t0 > 1500) return res();
      setTimeout(poll, 100);
    })();
  });
}

async function settle(page) {
  // let the intro run (engine sites: body.ready; envelope sites: click the open button)
  await page.evaluate(() => new Promise(res => {
    const t0 = Date.now();
    (function poll() {
      const btn = document.querySelector('#intro .open-btn, [data-intro-open]');
      if (btn && !btn.dataset.clicked) { btn.dataset.clicked = 1; btn.click(); }
      if (document.body.classList.contains('ready') && !document.body.classList.contains('loading') || Date.now() - t0 > 4500) return res();
      setTimeout(poll, 150);
    })();
  }));
}

async function checkSite(port, site) {
  const html = path.join(site, 'index.html');
  if (!fs.existsSync(html)) return ['no index.html'];
  const src = fs.readFileSync(html, 'utf8');
  const probs = [];
  const meta = src.match(/<meta[^>]+name=["']viewport["'][^>]*>/i)?.[0] || '';
  if (!/width=device-width/.test(meta)) probs.push('missing <meta name="viewport" content="width=device-width, initial-scale=1">');
  if (/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/.test(meta)) probs.push('viewport meta blocks pinch-zoom (remove user-scalable=no / maximum-scale) — accessibility');

  const url = pathToFileURL(html).href;
  const perVp = await Promise.all(VIEWPORTS.map(vp => checkViewport(port, site, url, vp)));
  return probs.concat(...perVp);
}

async function checkViewport(port, site, url, vp) {
  const probs = [];
  {
    const page = await openPage(port);
    try {
      await page.send('Emulation.setDeviceMetricsOverride', { width: vp.width, height: vp.height, deviceScaleFactor: vp.shots && shotsDir ? 2 : 1, mobile: true, screenOrientation: vp.width > vp.height ? { type: 'landscapePrimary', angle: 90 } : { type: 'portraitPrimary', angle: 0 } });
      await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
      await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
      const loaded = page.once('Page.loadEventFired');
      await page.send('Page.navigate', { url });
      await Promise.race([loaded, sleep(8000)]);
      await settle(page);
      await page.evaluate(idle);
      const found = new Map();
      const add = list => list.forEach(([k, m]) => found.has(m) || found.set(m, k));
      add(await page.evaluate(measure));
      // scroll down the whole page; measure at every screen so reveals / pinned stories are checked too
      const total = await page.evaluate(() => document.documentElement.scrollHeight);
      let shot = 0;
      for (let y = 0; y < total; y += Math.round(vp.height * 0.8)) {
        await page.evaluate(y => window.scrollTo(0, y), y);
        await page.evaluate(idle);
        add(await page.evaluate(measure));
        if (vp.shots && shotsDir) {
          const { data } = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 70 });
          fs.writeFileSync(path.join(shotsDir, `${path.basename(site)}-${vp.width}-${String(shot++).padStart(2, '0')}.jpg`), Buffer.from(data, 'base64'));
        }
      }
      for (const [m] of found) probs.push(`[${vp.name}] ${m}`);
    } catch (e) {
      probs.push(`[${vp.name}] check failed: ${e.message}`);
    } finally { await page.close(); }
  }
  return probs;
}

const { proc, prof, port } = await launch();
let bad = 0;
try {
  const results = new Array(sites.length);
  let next = 0;   // check 2 sites at a time (each runs all viewports in parallel)
  await Promise.all([0, 1].map(async () => { while (next < sites.length) { const i = next++; results[i] = await checkSite(port, sites[i]); } }));
  sites.forEach((site, i) => {
    const probs = results[i];
    if (probs.length) { bad++; console.log(`✗ ${path.basename(site)}`); probs.forEach(p => console.log(`    - ${p}`)); }
    else console.log(`✓ ${path.basename(site)}`);
  });
} finally {
  const exited = new Promise(r => proc.once('exit', r));
  proc.kill(); await Promise.race([exited, sleep(3000)]);
  try { fs.rmSync(prof, { recursive: true, force: true }); } catch (_) {}
}
if (shotsDir) console.log(`screenshots (390px phone): ${shotsDir}`);
console.log(bad ? `${bad} site(s) need mobile fixes` : 'OK');
process.exit(bad ? 1 : 0);
