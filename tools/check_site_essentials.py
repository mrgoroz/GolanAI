#!/usr/bin/env python3
"""Check that event sites have the required essentials:
accessibility kit, Waze button, WhatsApp button, and an RSVP form with
name + phone + coming yes/no + number of guests.

Usage:  python3 tools/check_site_essentials.py [site-dir ...]
        (no args = every folder in אתרים/)
Exit code 0 = all OK, 1 = something is missing (each problem is printed).
"""
import hashlib
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KIT = ROOT / 'tools' / 'site-kit'


class Collect(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags = []          # (tag, attrs dict)
        self.label_for = set()
        self.stack = []         # open tags, to know if an input sits inside a <label>

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        a['_in_label'] = 'label' in self.stack
        self.tags.append((tag, a))
        if tag == 'label' and a.get('for'):
            self.label_for.add(a['for'])
        if tag not in ('input', 'img', 'br', 'meta', 'link', 'source', 'hr'):
            self.stack.append(tag)

    def handle_endtag(self, tag):
        if tag in self.stack:
            while self.stack and self.stack.pop() != tag:
                pass


def md5(p):
    return hashlib.md5(p.read_bytes()).hexdigest()


def check(site: Path):
    probs = []
    html_p = site / 'index.html'
    if not html_p.exists():
        return ['no index.html']
    s = html_p.read_text(encoding='utf-8')
    c = Collect()
    c.feed(s)
    tags = c.tags

    def has(tag, **want):
        return [a for t, a in tags if t == tag and all(
            (k in a) if v is True else (v(a.get(k)) if callable(v) else a.get(k) == v)
            for k, v in want.items())]

    # --- page basics
    if not re.search(r'<html[^>]*lang="he"[^>]*dir="rtl"|<html[^>]*dir="rtl"[^>]*lang="he"', s):
        probs.append('<html> needs lang="he" dir="rtl"')
    if not has('main'):
        probs.append('no <main> element (skip link target)')

    # --- accessibility kit
    if not has('script', src='assets/a11y.js'):
        probs.append('missing <script src="assets/a11y.js"></script> in <head>')
    for f in ('a11y.js',) + (('engine.js', 'base.css') if 'assets/engine.js' in s else ()):
        p = site / 'assets' / f
        if not p.exists():
            probs.append(f'assets/{f} missing — copy from tools/site-kit/')
        elif md5(p) != md5(KIT / f):
            probs.append(f'assets/{f} differs from tools/site-kit/{f} — copy the current kit')

    # --- Waze
    if not (has('a', **{'data-waze': True}) or 'waze.com/ul' in s):
        probs.append('no Waze button (<a class="btn primary" data-waze>ניווט ב-Waze</a>)')

    # --- WhatsApp
    if not has('a', **{'data-whatsapp': True}):
        probs.append('no WhatsApp button (<a class="btn" data-whatsapp>…</a>)')
    if not re.search(r"whatsapp:\s*['\"]972\d{8,9}['\"]", s):
        probs.append("window.SITE.whatsapp not set (international digits, e.g. '972521234567')")

    # --- RSVP form
    names = {a.get('name') for t, a in tags if t in ('input', 'textarea')}
    ids = {a.get('id') for t, a in tags if t in ('input', 'textarea')}
    engine = 'assets/engine.js' in s
    if engine:
        if 'name' not in names:
            probs.append('RSVP: no name field (name="name")')
        tel = has('input', type='tel')
        if not tel:
            probs.append('RSVP: no phone field (type="tel")')
        elif not any('required' in a for a in tel):
            probs.append('RSVP: phone field must be required')
        if not has('input', type='radio', name='coming', value='yes') or not has('input', type='radio', name='coming', value='no'):
            probs.append('RSVP: needs coming yes/no radios (name="coming" value="yes|no")')
        if 'guests' not in names:
            probs.append('RSVP: no guests count (name="guests")')
        if 'guests-field' not in s:
            probs.append('RSVP: wrap the guests field in .guests-field (hidden when not coming)')
        if 'role="status"' not in s:
            probs.append('RSVP: add <p class="form-status" role="status" aria-live="polite"></p>')
        if '<fieldset class="choice"' not in s:
            probs.append('RSVP: yes/no must be <fieldset class="choice"><legend>האם תגיעו?</legend>')
    else:  # hand-written site: look for the same pieces by id
        for need, msg in (('name', 'name field'), ('phone', 'phone field')):
            if need not in ids:
                probs.append(f'RSVP: no {msg} (id="{need}")')
        if not re.search(r'data-v="yes"|value="yes"', s) or not re.search(r'data-v="no"|value="no"', s):
            probs.append('RSVP: needs coming yes/no')
        if 'guests' not in s:
            probs.append('RSVP: no guests count')

    # --- labels / alt text
    for t, a in tags:
        if t in ('input', 'textarea', 'select') and a.get('type') not in ('hidden', 'submit', 'button'):
            if not (a.get('id') in c.label_for or a.get('aria-label') or a.get('aria-labelledby') or a['_in_label']):
                probs.append(f'<{t} name="{a.get("name") or a.get("id")}"> has no label')
        if t == 'img' and a.get('alt') is None:
            probs.append(f'<img src="{a.get("src")}"> needs alt ("" if decorative)')
        if t == 'video' and not (a.get('aria-label') or a.get('title')):
            probs.append('<video> needs aria-label')
        if t in ('audio', 'video') and 'autoplay' in a and 'muted' not in a:
            probs.append(f'<{t}> must not autoplay with sound')
    return probs


def main():
    args = sys.argv[1:]
    sites = [Path(a) for a in args] if args else sorted(p for p in (ROOT / 'אתרים').iterdir() if p.is_dir())
    bad = 0
    for site in sites:
        probs = check(site)
        if probs:
            bad += 1
            print(f'✗ {site.name}')
            for p in probs:
                print(f'    - {p}')
        else:
            print(f'✓ {site.name}')
    print('OK' if not bad else f'{bad} site(s) need fixes')
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
