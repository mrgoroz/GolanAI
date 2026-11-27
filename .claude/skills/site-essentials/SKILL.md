---
name: site-essentials
description: Mandatory features for every event invitation site in אתרים/ — accessibility (נגישות: menu, skip links, keyboard, screen readers, accessibility statement), a Waze navigation button to the venue, a WhatsApp button to the hosts, and an RSVP form (אישור הגעה) with name, phone, coming yes/no and number of guests when coming. Use whenever creating a new site, editing an existing one, or when the user mentions accessibility, Waze, WhatsApp or RSVP on a site.
argument-hint: "[site folder, e.g. אתרים/brit — or empty for all sites]"
---

# Site essentials: accessible + Waze + WhatsApp + RSVP

The user's rule: **every site must be accessible and must include a Waze button to the venue, a
WhatsApp button, and an RSVP form with name, phone, and how many people are coming (if they
are coming).** A site is not done until `tools/check_site_essentials.py` prints OK.

## The shared kit — `tools/site-kit/`

| File | What it gives |
|---|---|
| `a11y.js` | Accessibility menu (text size, high contrast, grayscale, stop animations, highlight links, readable font, reset, saved in localStorage), an accessibility statement dialog (IS 5568 / WCAG 2.1 AA), skip links to `#main` and `#rsvp`, visible focus ring, screen-reader fixes (decorative canvases, "(נפתח בחלון חדש)" on new-tab links, video/iframe labels), and prefers-reduced-motion support. No third-party code. |
| `engine.js` | Waze/Google Maps/calendar links, WhatsApp links, RSVP validation and delivery, music button with `aria-pressed`, countdown as `role="timer"`. |
| `base.css` | Shared styles, including the RSVP form, error and status styles, and `[hidden]`. |

**The kit is the source of truth.** Edit only the files in `tools/site-kit/`, then copy them into
**every** site that uses them:

```bash
for d in אתרים/*/; do cp tools/site-kit/a11y.js "$d/assets/";
  [ -f "$d/assets/engine.js" ] && cp tools/site-kit/{engine.js,base.css} "$d/assets/"; done
```

A site that doesn't use engine.js (such as `hila-binyamin-site`) still loads `a11y.js` and
implements the same features in its own script. Use that site as the reference.

## Wiring a site (engine-based)

In `<head>`, right after base.css (no `defer`, so saved preferences apply before first paint):

```html
<link rel="stylesheet" href="assets/base.css">
<script src="assets/a11y.js"></script>
```

Location section (the engine fills in the hrefs and aria-labels):

```html
<a class="btn primary" data-waze target="_blank" rel="noopener">ניווט ב-Waze</a>
<a class="btn" data-whatsapp target="_blank" rel="noopener">ווטסאפ למארחים</a>
<a class="btn" data-gmaps target="_blank" rel="noopener">Google Maps</a>
```

RSVP (keep the site's themed wording, but keep this structure, names and ids):

```html
<section class="sec" id="rsvp"> …
<form class="rsvp-form">
  <div class="field"><label for="n">שם מלא</label><input id="n" name="name" required autocomplete="name" aria-required="true"></div>
  <div class="field"><label for="p">טלפון</label><input id="p" name="phone" type="tel" inputmode="tel" autocomplete="tel" required dir="ltr" placeholder="050-1234567" style="text-align:right"></div>
  <fieldset class="choice"><legend>האם תגיעו?</legend>
    <label><input type="radio" name="coming" value="yes" checked><span>נגיע בשמחה</span></label>
    <label><input type="radio" name="coming" value="no"><span>לא נוכל להגיע</span></label>
  </fieldset>
  <div class="field guests-field"><label for="g">כמה תהיו?</label><div class="stepper">
    <button type="button" data-d="-1" aria-label="הפחתת מספר המגיעים">−</button>
    <input id="g" name="guests" type="number" min="1" max="20" value="2" inputmode="numeric">
    <button type="button" data-d="1" aria-label="הוספת מגיע">+</button></div></div>
  <!-- optional extra fields, e.g. <textarea name="blessing"> -->
  <button class="btn primary" type="submit">שליחה</button>
  <p class="form-status" role="status" aria-live="polite"></p>
  <p class="demo-note">שאלות? <a data-whatsapp target="_blank" rel="noopener">כתבו לנו בווטסאפ</a> או התקשרו: <a href="tel:0501234567" dir="ltr">050-1234567</a></p>
</form>
<div class="rsvp-done"><h3>תודה <span class="rsvp-name"></span>!</h3><p>מחכים לראותכם</p>
  <a class="btn primary" data-rsvp-wa hidden target="_blank" rel="noopener">שליחת האישור בווטסאפ</a></div>
```

Config:

```js
window.SITE = { whatsapp: '972501234567',            // hosts' number: digits only, 972 + number without the leading 0
  event: { title, start, end, location, address, lat, lng },   // lat/lng optional → exact Waze pin
  rsvp: { endpoint: 'https://script.google.com/macros/s/…/exec' }, // optional, see below
  rsvpNoText: 'חבל! נחגוג איתכם בהזדמנות אחרת', … };
```

### What the RSVP does
- Name is at least 2 characters. The phone must be a valid Israeli number (05X, landline, or +972).
  Errors appear under the field, are announced to screen readers (`aria-invalid` +
  `aria-describedby`), and focus moves to the first invalid field.
- **"No" hides the guest count**. "Yes" shows it, from 1 to 20.
- Delivery: if `SITE.rsvp.endpoint` is set, the answer is sent there by POST (a Google Apps Script
  that appends a row to a Sheet). Otherwise **WhatsApp opens to the hosts** with a prefilled
  message (name, phone, coming, number of guests, blessing), and the thank-you box shows a
  "שליחת האישור בווטסאפ" fallback button. A copy is always saved in localStorage.

## Accessibility checklist (beyond the kit)
- `<html lang="he" dir="rtl">`, a single `<main>`, a logical order of h1→h2→h3.
- Every input has a `<label for>` (or `aria-label`). Group radios in a `fieldset` with a `legend`.
- Icon-only buttons get an `aria-label`. Decorative SVGs get `aria-hidden="true"`. Images get `alt` (`alt=""` if decorative).
- `<video>` gets an `aria-label`. Never autoplay sound. The music starts only on a click.
- Text contrast is at least 4.5:1 (3:1 for large text). Don't use `--muted` for small text on a light background without checking.
- Tap targets are at least 44×44px. Don't remove `outline` without a replacement.
- Intros and animations don't hide content from screen readers. Set `aria-hidden` only on decoration.

## Verify (required before saying it's done)
1. `python3 tools/check_site_essentials.py` → `OK` (every site, or pass a folder).
2. Open the site in a browser (`python3 -m http.server` + Chrome/puppeteer) and test: empty submit → errors;
   "No" → the guest count disappears; a valid submit → a correct WhatsApp link; the ♿ menu → contrast and statement; Tab reaches everything.
3. In the final reply, remind the user that the phone/WhatsApp numbers in the sites must be the hosts' real numbers.
