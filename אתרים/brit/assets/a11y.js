/* Accessibility kit for the invitation sites (IS 5568 / WCAG 2.1 AA oriented).
   Load in <head> WITHOUT defer:  <script src="assets/a11y.js"></script>
   It applies saved preferences before first paint, then adds:
   - a skip link, visible keyboard focus, screen-reader fixes (decorative canvases, new-tab links, video labels)
   - a floating "נגישות" menu: text size, high contrast, grayscale, stop animations, highlight links,
     readable font, reset — saved in localStorage
   - an accessibility statement dialog (contact: window.SITE.a11yContact || window.SITE.whatsapp)
   No third-party code, no network. */
(() => {
  const KEY = 'a11y-prefs', root = document.documentElement;
  let prefs = {};
  try { prefs = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (_) {}
  const FLAGS = { contrast: 'a11y-contrast', gray: 'a11y-gray', still: 'a11y-still', links: 'a11y-links', font: 'a11y-font' };
  const apply = () => {
    for (const k in FLAGS) root.classList.toggle(FLAGS[k], !!prefs[k]);
    root.style.setProperty('--a11y-zoom', String(1 + (prefs.size || 0) * 0.15));
    root.classList.toggle('a11y-zoomed', !!prefs.size);
    try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (_) {}
  };
  apply();

  const css = `
[hidden]{display:none!important}
.sr-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0 0 0 0)!important;white-space:nowrap!important;border:0!important}
.a11y-skip{position:fixed;top:-100px;right:16px;z-index:2147483646;background:#111;color:#fff;padding:12px 20px;border-radius:10px;font:700 17px/1.2 system-ui,Arial,sans-serif;text-decoration:underline;transition:top .2s}
.a11y-skip:focus{top:16px}
:focus-visible{outline:3px solid #ffbf47!important;outline-offset:3px!important;box-shadow:0 0 0 6px #111!important}
.a11y-fab{position:fixed;bottom:22px;right:22px;z-index:2147483640;width:56px;height:56px;border-radius:50%;border:2px solid #fff;background:#1453c7;color:#fff;display:grid;place-items:center;cursor:pointer;box-shadow:0 6px 22px rgba(0,0,0,.35)}
.a11y-fab svg{width:32px;height:32px}
.a11y-panel{position:fixed;bottom:88px;right:22px;z-index:2147483641;width:min(330px,calc(100vw - 44px));max-height:calc(100vh - 120px);overflow:auto;background:#fff;color:#111;border-radius:16px;padding:18px;box-shadow:0 20px 60px rgba(0,0,0,.45);font:16px/1.4 system-ui,Arial,sans-serif;direction:rtl;text-align:right}
.a11y-panel[hidden],.a11y-dlg[hidden]{display:none!important}
.a11y-keep,.a11y-keep *{-webkit-text-fill-color:currentColor!important}
.a11y-panel h2{font-size:19px;margin:0 0 12px;color:#111}
.a11y-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.a11y-panel button,.a11y-dlg button{font:700 15px/1.25 system-ui,Arial,sans-serif;color:#111;background:#f1f3f7;border:2px solid #c9ced8;border-radius:10px;padding:10px 8px;cursor:pointer;min-height:48px}
.a11y-panel button[aria-pressed="true"]{background:#1453c7;color:#fff;border-color:#1453c7}
.a11y-panel .a11y-wide{grid-column:1/-1}
.a11y-dlg{position:fixed;inset:0;z-index:2147483645;display:grid;place-items:center;background:rgba(0,0,0,.6);padding:18px}
.a11y-dlg>div{background:#fff;color:#111;max-width:640px;width:100%;max-height:85vh;overflow:auto;border-radius:16px;padding:26px;font:17px/1.6 system-ui,Arial,sans-serif;direction:rtl;text-align:right}
.a11y-dlg h2{font-size:24px;margin:0 0 12px}.a11y-dlg p,.a11y-dlg li{margin:0 0 10px}.a11y-dlg ul{padding-right:22px;margin:0 0 10px}.a11y-dlg a{color:#1453c7;text-decoration:underline}
html.a11y-zoomed main,html.a11y-zoomed header,html.a11y-zoomed footer,html.a11y-zoomed .modal{zoom:var(--a11y-zoom)}
html.a11y-gray body>*:not(.a11y-keep){filter:grayscale(1)}
html.a11y-links a:not(.a11y-keep a){text-decoration:underline!important;text-underline-offset:3px}
html.a11y-links a,html.a11y-links button:not(.a11y-keep button){outline:2px dashed currentColor;outline-offset:2px}
html.a11y-font body,html.a11y-font body *:not(.a11y-keep *){font-family:Arial,"Noto Sans Hebrew",system-ui,sans-serif!important;letter-spacing:normal!important}
html.a11y-still *,html.a11y-still *::before,html.a11y-still *::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}
html.a11y-still canvas,html.a11y-still .intro{display:none!important}
html.a11y-still [data-reveal],html.a11y-still .reveal,html.a11y-still [data-split] .ch,html.a11y-still .rise{opacity:1!important;transform:none!important;filter:none!important;clip-path:none!important}
html.a11y-contrast body,html.a11y-contrast body *:not(.a11y-keep):not(.a11y-keep *){background:#000!important;background-image:none!important;color:#fff!important;-webkit-text-fill-color:#fff!important;text-shadow:none!important;box-shadow:none!important;border-color:#fff!important}
html.a11y-contrast a:not(.a11y-keep a),html.a11y-contrast button:not(.a11y-keep button),html.a11y-contrast .btn{color:#ffe600!important;-webkit-text-fill-color:#ffe600!important;border:2px solid #ffe600!important}
html.a11y-contrast .music-btn .bars i,html.a11y-contrast #music-btn .bars i{background:#ffe600!important}
html.a11y-contrast input,html.a11y-contrast textarea{border:2px solid #fff!important}
html.a11y-contrast canvas,html.a11y-contrast .intro{display:none!important}
@media (prefers-reduced-motion:reduce){[data-reveal],.reveal,[data-split] .ch{opacity:1!important;transform:none!important;filter:none!important;clip-path:none!important}}
@media print{.a11y-fab,.a11y-panel,.a11y-skip{display:none!important}}`;
  const st = document.createElement('style'); st.id = 'a11y-css'; st.textContent = css;
  (document.head || root).appendChild(st);

  const icon = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="4" r="2"/><path d="M21 9h-6v13h-2v-6h-2v6H9V9H3V7h18z"/></svg>';
  const OPTS = [['size+', 'הגדלת טקסט'], ['size-', 'הקטנת טקסט'], ['contrast', 'ניגודיות גבוהה'], ['gray', 'גווני אפור'],
    ['still', 'עצירת אנימציות'], ['links', 'הדגשת קישורים'], ['font', 'גופן קריא']];

  const init = () => {
    const S = window.SITE || {};
    const main = document.querySelector('main') || document.querySelector('[role="main"]');
    if (main && !main.id) main.id = 'main';

    // skip link
    const skip = document.createElement('a'); skip.className = 'a11y-skip a11y-keep';
    skip.href = '#' + (main ? main.id : (document.querySelector('#rsvp') ? 'rsvp' : '')); skip.textContent = 'דילוג לתוכן העמוד';
    document.body.prepend(skip);
    if (document.getElementById('rsvp')) {
      const s2 = skip.cloneNode(); s2.href = '#rsvp'; s2.textContent = 'דילוג לאישור הגעה'; skip.after(s2);
    }

    // screen-reader fixes for things the sites generate
    const fix = () => {
      document.querySelectorAll('canvas:not([aria-hidden]), .progress-bar:not([aria-hidden])').forEach(el => el.setAttribute('aria-hidden', 'true'));
      document.querySelectorAll('a[target="_blank"]:not([data-a11y-nw])').forEach(a => {
        a.dataset.a11yNw = '1'; if (!a.rel.includes('noopener')) a.rel = (a.rel + ' noopener').trim();
        const s = document.createElement('span'); s.className = 'sr-only'; s.textContent = ' (נפתח בחלון חדש)'; a.appendChild(s);
      });
      document.querySelectorAll('video:not([aria-label]):not([title])').forEach(v => v.setAttribute('aria-label', 'סרטון ההזמנה'));
      document.querySelectorAll('img:not([alt])').forEach(i => i.setAttribute('alt', ''));
      document.querySelectorAll('iframe:not([title])').forEach(f => f.setAttribute('title', 'תוכן מוטמע'));
    };
    fix(); setTimeout(fix, 1500);

    // menu
    const fab = document.createElement('button'); fab.type = 'button'; fab.className = 'a11y-fab a11y-keep';
    fab.setAttribute('aria-label', 'תפריט נגישות'); fab.setAttribute('aria-expanded', 'false'); fab.setAttribute('aria-controls', 'a11y-panel'); fab.innerHTML = icon;
    const panel = document.createElement('div'); panel.id = 'a11y-panel'; panel.className = 'a11y-panel a11y-keep'; panel.hidden = true;
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'הגדרות נגישות');
    panel.innerHTML = '<h2>הגדרות נגישות</h2><div class="a11y-grid">' +
      OPTS.map(([k, l]) => `<button type="button" data-a11y="${k}"${k.startsWith('size') ? '' : ' aria-pressed="false"'}>${l}</button>`).join('') +
      '<button type="button" data-a11y="reset">איפוס הגדרות</button>' +
      '<button type="button" class="a11y-wide" data-a11y="statement">הצהרת נגישות</button></div>' +
      '<p class="sr-only" role="status" aria-live="polite" id="a11y-live"></p>';
    document.body.append(fab, panel);
    const live = panel.querySelector('#a11y-live');
    const sync = () => panel.querySelectorAll('[aria-pressed]').forEach(b => b.setAttribute('aria-pressed', String(!!prefs[b.dataset.a11y])));
    sync();
    const toggle = open => { panel.hidden = !open; fab.setAttribute('aria-expanded', String(open)); if (open) panel.querySelector('button').focus(); };
    fab.addEventListener('click', () => toggle(panel.hidden));
    panel.addEventListener('keydown', e => { if (e.key === 'Escape') { toggle(false); fab.focus(); } });
    document.addEventListener('click', e => { if (!panel.hidden && !panel.contains(e.target) && !fab.contains(e.target)) toggle(false); });
    panel.addEventListener('click', e => {
      const b = e.target.closest('[data-a11y]'); if (!b) return; const k = b.dataset.a11y;
      if (k === 'statement') { toggle(false); openStatement(); return; }
      if (k === 'reset') prefs = {};
      else if (k === 'size+') prefs.size = Math.min(4, (prefs.size || 0) + 1);
      else if (k === 'size-') prefs.size = Math.max(0, (prefs.size || 0) - 1);
      else prefs[k] = !prefs[k];
      apply(); sync();
      live.textContent = k === 'reset' ? 'ההגדרות אופסו' : k.startsWith('size') ? `גודל טקסט ${Math.round((1 + (prefs.size || 0) * .15) * 100)}%` : `${b.textContent} ${prefs[k] ? 'הופעל' : 'כובה'}`;
    });

    // statement
    const openStatement = () => {
      const contact = S.a11yContact || S.whatsapp || '';
      const tel = contact ? String(contact).replace(/^972/, '0') : '';
      const dlg = document.createElement('div'); dlg.className = 'a11y-dlg a11y-keep';
      dlg.innerHTML = `<div role="dialog" aria-modal="true" aria-labelledby="a11y-st-h" tabindex="-1">
<h2 id="a11y-st-h">הצהרת נגישות</h2>
<p>אנו רואים חשיבות רבה במתן שירות שוויוני לכל האורחים, ופועלים כדי שאתר ההזמנה יהיה נגיש לאנשים עם מוגבלות, בהתאם לתקן הישראלי 5568 ולהנחיות WCAG 2.1 ברמה AA.</p>
<p>מה נעשה באתר:</p><ul>
<li>תמיכה מלאה בניווט במקלדת וסימון ברור של הרכיב הממוקד.</li>
<li>קישורי דילוג לתוכן ולאישור ההגעה.</li>
<li>התאמה לקוראי מסך: כותרות, תוויות לשדות הטופס, הודעות שגיאה ואישור מוקראות.</li>
<li>תפריט נגישות: הגדלת טקסט, ניגודיות גבוהה, גווני אפור, עצירת אנימציות, הדגשת קישורים וגופן קריא.</li>
<li>כיבוד הגדרת "הפחתת תנועה" של מערכת ההפעלה; המוזיקה אינה מתנגנת ללא לחיצה.</li></ul>
<p>אם נתקלתם ברכיב שאינו נגיש, או שאתם זקוקים לפרטי האירוע בדרך אחרת, נשמח לעזור${tel ? `: <a href="tel:${tel}">${tel}</a>${S.whatsapp ? ` או <a href="https://wa.me/${S.whatsapp}" target="_blank" rel="noopener">בווטסאפ</a>` : ''}` : ''}.</p>
<p>ההצהרה עודכנה לאחרונה: ${new Date(document.lastModified).toLocaleDateString('he-IL')}.</p>
<button type="button" data-close>סגירה</button></div>`;
      const prev = document.activeElement; document.body.appendChild(dlg);
      const box = dlg.firstElementChild; box.focus();
      const close = () => { dlg.remove(); (prev && prev.focus) ? prev.focus() : fab.focus(); };
      dlg.addEventListener('click', e => { if (e.target === dlg || e.target.closest('[data-close]')) close(); });
      dlg.addEventListener('keydown', e => {
        if (e.key === 'Escape') close();
        if (e.key === 'Tab') { const f = [...box.querySelectorAll('a,button')]; const first = f[0], last = f[f.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } }
      });
    };
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
