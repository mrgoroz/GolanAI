# GolanAI

Hebrew event invitations: sites in `אתרים/<event>/` and HyperFrames videos (rendered MP4s in `סרטונים/`).

## Assets — images, fonts, music (most important rule)

- **Copyright-free only.** Images, music and sound effects must be **CC0 or Public Domain** —
  no CC-BY / "free with attribution" / royalty-free / stock-site custom licenses. Fonts:
  Google Fonts (SIL OFL). If the license is unclear, don't use it.
- **From the internet, downloaded locally.** Search online, download into the project's
  `assets/` folder, and build the HyperFrames video from the local files. No hotlinked media
  and no Google Fonts `<link>` inside a composition.
- Use the `/free-assets` skill and `tools/fetch_free_asset.py` (searches Openverse with
  `license=cc0,pdm`, downloads, and logs every file in `assets/CREDITS.json`).
- Prefer a real downloaded CC0/PD music track over music synthesized by a script; generate
  only if nothing suitable exists, and say so.
- No identifiable people, logos, or trademarked characters in downloaded media.

## Every site: accessible + Waze + WhatsApp + RSVP

- Every site in `אתרים/` must be accessible (♿ menu, accessibility statement, keyboard, screen
  readers), with a **Waze** button to the venue, a **WhatsApp** button to the hosts, and an
  **RSVP** form: name, phone, coming yes/no, and number of guests (only when coming).
- Follow the `/site-essentials` skill. The shared code lives in `tools/site-kit/` (edit there, then
  copy to every site's `assets/`). Run `python3 tools/check_site_essentials.py` until it prints OK.

## Text must fit — nothing outside its card or the frame

- Every text element (dates, names, venues) must sit fully inside its card/bubble/pill and the
  1080×1920 frame. Size big one-line text (dates like `10.12.26`, names) to the card's inner
  width: `white-space:nowrap`, and keep `font-size` ≈ inner width ÷ (characters × 0.6) or less.
- **Before every render** run `python3 tools/check_text_fit.py <video-project-dir>` and only
  render once it prints OK. It runs `hyperframes inspect` at each scene's settled moments and
  fails on any text overflow (plain `inspect` reports these only as "info", which is how
  the brit date slipped through). Decoration that crosses an edge on purpose (tape, ribbons)
  gets `data-layout-allow-overflow`.
- Then look at a frame from each scene in the final MP4 (ffmpeg `-ss <t> -frames:v 1`).
