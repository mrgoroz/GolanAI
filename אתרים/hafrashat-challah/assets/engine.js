/* Invitation site engine — scroll reveals, pinned story, countdown, music, calendar, Waze, WhatsApp, RSVP, themed particles.
   Canonical copy: tools/site-kit/engine.js (copy into each site's assets/). Pair with assets/a11y.js.
   Configure with window.SITE = {
     event:{title,start,end,location,address, lat?, lng?},   // lat/lng → exact Waze pin
     whatsapp:'9725XXXXXXXX',          // host number, international format, digits only
     whatsappText?:'...',              // prefilled text for the [data-whatsapp] button
     rsvp?:{ endpoint:'https://script.google.com/...' },  // optional: POST answers to a Google Sheet
     rsvpNoText?:'...',                // thank-you line shown when the guest is not coming
     particles:'web'|'rain'|'sparkle'|'flour'|'bubbles'|'stars', colors:[...], introMs } */
(() => {
  const S = window.SITE || {};
  const $ = (q, r = document) => r.querySelector(q), $$ = (q, r = document) => [...r.querySelectorAll(q)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

  /* ---------- split text into letters ---------- */
  $$('[data-split]').forEach(el => {
    const words = el.textContent.trim().split(/\s+/);
    el.textContent = ''; el.setAttribute('aria-label', words.join(' '));
    let i = 0;
    words.forEach((w, wi) => {
      const ws = document.createElement('span'); ws.className = 'w'; ws.setAttribute('aria-hidden', 'true');
      [...w].forEach(c => { const s = document.createElement('span'); s.className = 'ch'; s.textContent = c; s.style.setProperty('--i', i++); ws.appendChild(s); });
      el.appendChild(ws); if (wi < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
  });

  /* ---------- intro / loader ---------- */
  document.body.classList.add('loading');
  const go = () => {
    document.body.classList.add('ready');
    setTimeout(() => document.body.classList.remove('loading'), 300);
  };
  const ready = Promise.all([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise(r => setTimeout(r, reduce ? 0 : (S.introMs ?? 2200)))]);
  ready.then(go);
  setTimeout(go, 6000);

  /* ---------- reveal on scroll ---------- */
  // clip-path variants have zero visible area, so watch their parent instead
  const watch = new Map();
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { (watch.get(e.target) || []).forEach(el => el.classList.add('in')); io.unobserve(e.target); } }), { threshold: .12, rootMargin: '0px 0px -6% 0px' });
  $$('[data-reveal]').forEach(el => { if (el.dataset.delay) el.style.transitionDelay = el.dataset.delay + 's';
    const t = /^(clip|iris)$/.test(el.dataset.reveal) ? el.parentElement : el; if (!watch.has(t)) watch.set(t, []); watch.get(t).push(el); io.observe(t); });

  /* ---------- scroll-driven variables ---------- */
  const progEls = $$('[data-progress]'), stories = $$('[data-story]'), bar = $('.progress-bar');
  let ticking = false;
  const onScroll = () => {
    ticking = false;
    const vh = innerHeight, y = scrollY, H = document.documentElement.scrollHeight - vh;
    document.documentElement.style.setProperty('--scroll', y);
    document.documentElement.style.setProperty('--page', (H > 0 ? y / H : 0).toFixed(4));
    if (bar) bar.style.transform = `scaleX(${H > 0 ? y / H : 0})`;
    progEls.forEach(el => { const r = el.getBoundingClientRect(); el.style.setProperty('--p', clamp((vh - r.top) / (r.height + vh)).toFixed(4)); });
    stories.forEach(el => {
      const r = el.getBoundingClientRect(), n = +el.dataset.story;
      const p = clamp(-r.top / (r.height - vh));
      el.style.setProperty('--sp', p.toFixed(4));
      const step = Math.min(n - 1, Math.floor(p * n * .999 + (p > 0.02 ? 0 : 0)));
      if (el.dataset.step != step) { el.dataset.step = step; $$('[data-at]', el).forEach(s => s.classList.toggle('on', +s.dataset.at <= step)); $$('[data-only]', el).forEach(s => s.classList.toggle('on', +s.dataset.only === step)); }
      $$('.story-dots i', el).forEach((d, i) => d.classList.toggle('on', i === step));
    });
    document.body.classList.toggle('scrolled', y > 40);
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  addEventListener('resize', onScroll); onScroll();

  /* ---------- pointer glow / tilt ---------- */
  addEventListener('pointermove', e => {
    document.documentElement.style.setProperty('--mx', (e.clientX / innerWidth).toFixed(3));
    document.documentElement.style.setProperty('--my', (e.clientY / innerHeight).toFixed(3));
  }, { passive: true });
  $$('[data-tilt]').forEach(el => {
    el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      el.style.transform = `perspective(900px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg)`; el.style.setProperty('--gx', (x + .5) * 100 + '%'); el.style.setProperty('--gy', (y + .5) * 100 + '%'); });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });

  /* ---------- countdown ---------- */
  const cd = $('[data-countdown]');
  if (cd) {
    const target = new Date(cd.dataset.countdown).getTime();
    cd.setAttribute('role', 'timer'); cd.setAttribute('aria-live', 'off'); $$('.cd-box', cd).forEach(b => b.setAttribute('aria-hidden', 'true'));
    const set = (k, v) => { const el = $(`[data-cd="${k}"]`, cd); if (el && el.textContent !== String(v).padStart(2, '0')) { el.textContent = String(v).padStart(2, '0'); el.classList.remove('tick'); void el.offsetWidth; el.classList.add('tick'); } };
    const tick = () => { let d = Math.max(0, target - Date.now()); const days = Math.floor(d / 864e5); d -= days * 864e5; const h = Math.floor(d / 36e5); d -= h * 36e5; const m = Math.floor(d / 6e4); d -= m * 6e4; const s = Math.floor(d / 1e3);
      set('d', days); set('h', h); set('m', m); set('s', s);
      const lbl = `עד האירוע: ${days} ימים, ${h} שעות ו-${m} דקות`; if (cd.getAttribute('aria-label') !== lbl) cd.setAttribute('aria-label', lbl); };
    tick(); setInterval(tick, 1000);
  }

  /* ---------- music ---------- */
  const mb = $('.music-btn');
  if (mb) {
    const a = new Audio('assets/music.m4a'); a.loop = true; a.volume = .7;
    mb.setAttribute('aria-pressed', 'false');
    const setMb = on => { mb.classList.toggle('playing', on); mb.setAttribute('aria-pressed', String(on)); mb.setAttribute('aria-label', on ? 'השתקת המוזיקה' : 'הפעלת מוזיקה'); };
    mb.addEventListener('click', () => { if (a.paused) { a.play().then(() => setMb(true)).catch(() => {}); } else { a.pause(); setMb(false); } });
  }

  /* ---------- calendar + navigation ---------- */
  const E = S.event;
  if (E) {
    const fmt = d => d.replace(/[-:]/g, '').replace(/\.\d+/, '');
    $$('[data-ics]').forEach(b => b.addEventListener('click', () => {
      const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//GolanAI//Invite//HE', 'BEGIN:VEVENT', `UID:${Date.now()}@invite`, `DTSTART;TZID=Asia/Jerusalem:${fmt(E.start)}`, `DTEND;TZID=Asia/Jerusalem:${fmt(E.end)}`, `SUMMARY:${E.title}`, `LOCATION:${E.location}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
      const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
      const l = document.createElement('a'); l.href = url; l.download = 'invite.ics'; l.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }));
    $$('[data-gcal]').forEach(b => { b.href = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(E.title)}&dates=${fmt(E.start)}/${fmt(E.end)}&ctz=Asia/Jerusalem&location=${encodeURIComponent(E.location)}`; });
    $$('[data-waze]').forEach(b => { b.href = E.lat != null && E.lng != null ? `https://waze.com/ul?ll=${E.lat},${E.lng}&navigate=yes` : `https://waze.com/ul?q=${encodeURIComponent(E.address)}&navigate=yes`;
      if (!b.getAttribute('aria-label')) b.setAttribute('aria-label', `ניווט ב-Waze אל ${E.location}`); });
    $$('[data-gmaps]').forEach(b => { b.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(E.address)}`; });
  }

  /* ---------- WhatsApp ---------- */
  const wa = (text) => `https://wa.me/${S.whatsapp}?text=${encodeURIComponent(text)}`;
  if (S.whatsapp) $$('[data-whatsapp]').forEach(b => { b.href = wa(S.whatsappText || `היי, יש לי שאלה לגבי ${E ? E.title : 'האירוע'}`);
    b.target = '_blank'; b.rel = 'noopener'; if (!b.getAttribute('aria-label')) b.setAttribute('aria-label', 'שליחת הודעת ווטסאפ למארחים'); });
  else $$('[data-whatsapp]').forEach(b => { b.hidden = true; });

  /* ---------- RSVP: name, phone, coming yes/no, guests (only when coming) ----------
     Delivery: SITE.rsvp.endpoint (POST, e.g. Google Apps Script → Sheet), otherwise WhatsApp to SITE.whatsapp.
     Always kept in localStorage too. */
  const form = $('.rsvp-form');
  if (form) {
    form.noValidate = true;
    const status = $('.form-status', form) || (() => { const p = document.createElement('p'); p.className = 'form-status'; p.setAttribute('role', 'status'); p.setAttribute('aria-live', 'polite'); form.appendChild(p); return p; })();
    const gField = $('.guests-field', form), gInp = $('input[name="guests"]', form);
    const isComing = () => (form.elements.coming ? form.elements.coming.value : 'yes') !== 'no';
    const syncGuests = () => { if (!gField) return; const on = isComing(); gField.hidden = !on; if (gInp) gInp.disabled = !on; };
    $$('input[name="coming"]', form).forEach(r => r.addEventListener('change', syncGuests)); syncGuests();
    $$('.stepper', form).forEach(st => { const inp = $('input', st), lo = +(inp.min || 1), hi = +(inp.max || 20);
      $$('button', st).forEach(b => b.addEventListener('click', () => { inp.value = clamp((+inp.value || lo) + (+b.dataset.d), lo, hi); status.textContent = `מספר המגיעים: ${inp.value}`; })); });

    const err = (inp, msg) => {
      const f = inp.closest('.field'); let e = f && $('.field-error', f);
      if (!e && f) { e = document.createElement('p'); e.className = 'field-error'; e.id = inp.id + '-err'; f.appendChild(e); }
      inp.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (e) { e.textContent = msg || ''; if (msg) inp.setAttribute('aria-describedby', e.id); else inp.removeAttribute('aria-describedby'); }
      return !msg;
    };
    const phoneOk = v => /^(?:\+?972|0)(?:[23489]\d{7}|5\d{8}|7\d{8})$/.test(v.replace(/[\s\-().]/g, ''));

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const nm = form.elements.name, ph = form.elements.phone;
      const ok = [
        err(nm, nm.value.trim().length < 2 ? 'נא למלא שם (לפחות 2 תווים)' : ''),
        err(ph, !ph.value.trim() ? 'נא למלא מספר טלפון' : !phoneOk(ph.value) ? 'מספר הטלפון לא תקין, לדוגמה 050-1234567' : ''),
        !gInp || !isComing() || err(gInp, +gInp.value >= 1 && +gInp.value <= +(gInp.max || 20) ? '' : `נא לבחור בין 1 ל-${gInp.max || 20} מגיעים`)
      ].every(Boolean);
      if (!ok) { status.textContent = 'יש לתקן את השדות המסומנים'; $('[aria-invalid="true"]', form).focus(); return; }

      const coming = isComing();
      const data = { ...Object.fromEntries(new FormData(form)), coming: coming ? 'yes' : 'no', guests: coming ? String(+(gInp && gInp.value) || 1) : '0', event: E ? E.title : document.title, at: new Date().toISOString() };
      try { localStorage.setItem('rsvp:' + location.pathname, JSON.stringify(data)); } catch (_) {}

      const lines = [`אישור הגעה – ${data.event}`, `שם: ${data.name}`, `טלפון: ${data.phone}`, coming ? `מגיעים: כן, ${data.guests} ${data.guests === '1' ? 'אורח' : 'אורחים'}` : 'מגיעים: לא'];
      if (data.blessing) lines.push(`ברכה: ${data.blessing}`);
      const waUrl = S.whatsapp ? wa(lines.join('\n')) : '';
      const viaEndpoint = !!(S.rsvp && S.rsvp.endpoint);

      if (viaEndpoint) {
        status.textContent = 'שולח…';
        try { await fetch(S.rsvp.endpoint, { method: 'POST', mode: 'no-cors', body: new URLSearchParams(data) }); }
        catch (_) { status.textContent = 'השליחה נכשלה – נסו שוב או צרו קשר בטלפון'; return; }
      } else if (waUrl) { window.open(waUrl, '_blank', 'noopener'); }

      form.classList.add('sent'); form.setAttribute('aria-hidden', 'true'); form.inert = true;
      const msg = $('.rsvp-done', form.parentElement);
      if (msg) {
        const n = $('.rsvp-name', msg); if (n) n.textContent = data.name || '';
        if (!coming) { const p = $('p', msg); if (p) p.textContent = S.rsvpNoText || 'תודה שעדכנתם – נתגעגע אליכם!'; }
        const wb = $('[data-rsvp-wa]', msg); if (wb && waUrl && !viaEndpoint) { wb.href = waUrl; wb.hidden = false; }
        msg.setAttribute('role', 'status'); msg.tabIndex = -1; msg.classList.add('show'); msg.focus({ preventScroll: true });
      }
      if (coming) burst(innerWidth / 2, innerHeight / 2, 120);
    });
  }

  /* ---------- particles ---------- */
  const cv = document.createElement('canvas'); cv.className = 'fx'; document.body.prepend(cv);
  const ctx = cv.getContext('2d'); let W, H, DPR;
  const fit = () => { DPR = Math.min(2, devicePixelRatio || 1); W = cv.width = innerWidth * DPR; H = cv.height = innerHeight * DPR; cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px'; };
  fit(); addEventListener('resize', fit);
  const type = S.particles || 'stars', cols = S.colors || ['#fff'];
  const R = Math.random, P = [];
  const count = reduce ? 0 : ({ rain: 140, web: 0, sparkle: 70, flour: 70, bubbles: 60, stars: 80 }[type] ?? 60);
  const spawn = (init) => ({ x: R() * W, y: init ? R() * H : (type === 'bubbles' || type === 'flour' ? H + 20 : -20), r: (type === 'rain' ? 1 : 1 + R() * 3) * DPR, v: (type === 'rain' ? 14 + R() * 10 : .3 + R() * 1.1) * DPR, s: R() * 6.28, c: cols[(R() * cols.length) | 0], a: .3 + R() * .7 });
  for (let i = 0; i < count; i++) P.push(spawn(true));
  const B = []; // confetti bursts
  function burst(x, y, n) { if (reduce || document.documentElement.classList.contains('a11y-still')) return; for (let i = 0; i < n; i++) { const a = R() * 6.28, sp = (4 + R() * 10) * DPR; B.push({ x: x * DPR, y: y * DPR, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 6 * DPR, r: (4 + R() * 6) * DPR, c: cols[(R() * cols.length) | 0], rot: R() * 6, vr: R() * .3 - .15, life: 1 }); } }
  window.inviteBurst = burst;
  $$('[data-burst]').forEach(b => b.addEventListener('click', e => burst(e.clientX, e.clientY, 60)));
  let mx = -999, my = -999; addEventListener('pointermove', e => { mx = e.clientX * DPR; my = e.clientY * DPR; if (type === 'sparkle' && !reduce && R() > .5) P.push({ ...spawn(true), x: mx, y: my, trail: 1, v: .6 * DPR }); }, { passive: true });
  const star = (x, y, r) => { ctx.beginPath(); ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y + r); ctx.quadraticCurveTo(x, y, x - r, y); ctx.quadraticCurveTo(x, y, x, y - r); ctx.fill(); };
  let t = 0, lastY = scrollY;
  (function loop() {
    if (document.documentElement.classList.contains('a11y-still')) { ctx.clearRect(0, 0, W, H); B.length = 0; return void setTimeout(() => requestAnimationFrame(loop), 500); }
    t += .016; ctx.clearRect(0, 0, W, H);
    const dy = (scrollY - lastY) * DPR; lastY = scrollY;
    if (type === 'web') { // web strands from the top corners that stretch with scroll & pointer
      ctx.strokeStyle = cols[0]; ctx.globalAlpha = .18; ctx.lineWidth = 1.2 * DPR;
      const corners = [[W, 0, Math.PI / 2, Math.PI], [0, 0, 0, Math.PI / 2]];
      corners.forEach(([cx, cy, a0, a1]) => { const sp = 9, L = Math.min(W, H) * .55 + Math.sin(t) * 6 * DPR;
        for (let i = 0; i <= sp; i++) { const a = a0 + (a1 - a0) * i / sp; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * L, cy + Math.sin(a) * L); ctx.stroke(); }
        for (let r = L / 7; r < L; r += L / 7) { ctx.beginPath(); for (let i = 0; i <= sp; i++) { const a = a0 + (a1 - a0) * i / sp, am = a - (a1 - a0) / sp / 2; const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r; if (!i) ctx.moveTo(px, py); else ctx.quadraticCurveTo(cx + Math.cos(am) * r * .9, cy + Math.sin(am) * r * .9, px, py); } ctx.stroke(); } });
      if (mx > 0) { ctx.globalAlpha = .35; ctx.beginPath(); ctx.moveTo(W, 0); ctx.lineTo(mx, my); ctx.stroke(); }
    }
    for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; ctx.globalAlpha = p.a; ctx.fillStyle = p.c; ctx.strokeStyle = p.c;
      if (type === 'rain') { p.y += p.v + dy * .2; p.x -= p.v * .2; ctx.lineWidth = 1.2 * DPR; ctx.globalAlpha = p.a * .5; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.v * .25, p.y - p.v * 2.4); ctx.stroke(); if (p.y > H + 40) Object.assign(p, spawn(false), { x: R() * W * 1.2 }); continue; }
      if (type === 'bubbles') { p.y -= p.v * 1.6 + dy * .1; p.x += Math.sin(t * 2 + p.s) * .4 * DPR; ctx.lineWidth = 1.2 * DPR; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 1.6, 0, 6.28); ctx.stroke(); if (p.y < -20) Object.assign(p, spawn(false)); continue; }
      if (type === 'flour') { p.y -= p.v * .5 + dy * .05; p.x += Math.sin(t + p.s) * .5 * DPR; ctx.globalAlpha = p.a * .6; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.28); ctx.fill(); if (p.y < -20) Object.assign(p, spawn(false)); continue; }
      if (p.trail) { p.a -= .02; p.y += p.v; if (p.a <= 0) { P.splice(i, 1); continue; } star(p.x, p.y, p.r * 2.2); continue; }
      // stars / sparkle: twinkle & drift with scroll
      p.y -= dy * (.05 + p.r / DPR * .04); if (p.y < -10) p.y = H + 10; if (p.y > H + 10) p.y = -10;
      ctx.globalAlpha = p.a * (.5 + .5 * Math.sin(t * 2 + p.s)); if (p.r > 2.6 * DPR) star(p.x, p.y, p.r * 2); else { ctx.beginPath(); ctx.arc(p.x, p.y, p.r * .7, 0, 6.28); ctx.fill(); }
    }
    for (let i = B.length - 1; i >= 0; i--) { const b = B[i]; b.vy += .35 * DPR; b.vx *= .99; b.x += b.vx; b.y += b.vy; b.rot += b.vr; b.life -= .008; if (b.life <= 0 || b.y > H + 40) { B.splice(i, 1); continue; }
      ctx.save(); ctx.globalAlpha = Math.min(1, b.life * 2); ctx.translate(b.x, b.y); ctx.rotate(b.rot); ctx.fillStyle = b.c; ctx.fillRect(-b.r / 2, -b.r / 4, b.r, b.r / 2); ctx.restore(); }
    ctx.globalAlpha = 1; requestAnimationFrame(loop);
  })();
})();
