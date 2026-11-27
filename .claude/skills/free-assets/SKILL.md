---
name: free-assets
description: Find and download copyright-free images, music, sound effects and fonts from the internet into a project's local assets/ folder, for HyperFrames videos and the event sites. Only CC0 / Public Domain media (fonts: SIL OFL from Google Fonts). Use whenever a video, invitation or site needs a photo, background, music, sound or font — before writing any <img>, <audio>, @font-face or Google Fonts link.
argument-hint: "[what is needed, e.g. 'calm piano music' or 'wedding flowers background']"
---

# Copyright-free assets, downloaded locally

The user's rule: **images, fonts and music come from the internet, are downloaded to the
project folder, and the video is built from the local files with HyperFrames. Most important:
no copyright at all.**

## Hard rules

1. **License — images and audio: only `CC0` or Public Domain (`pdm`).** Not CC-BY, not
   CC-BY-SA, not "free with attribution", not "royalty free", not the Pixabay/Unsplash/Pexels
   custom licenses, not YouTube Audio Library, not Incompetech. If in doubt — don't use it.
2. **Fonts: Google Fonts (SIL OFL 1.1)** — free for any use including commercial, no credit
   needed in the video. Download the files; never a `fonts.googleapis.com` `<link>` in a
   HyperFrames composition.
3. **Local only.** Every asset sits in `<project>/assets/` and is referenced by a relative path
   (`assets/music.mp3`, `assets/fonts.css`). A HyperFrames composition must not load anything
   from the network (render is deterministic, no network fetches).
4. **Record it.** Every file is listed in `<project>/assets/CREDITS.json` with source page and
   license — `tools/fetch_free_asset.py` does this automatically. Anything added by hand must be
   added there too.
5. **No real people, logos or brands** in downloaded photos (faces of identifiable people,
   trademarks, characters such as Spider-Man/Disney princesses — draw those with CSS/SVG in an
   original style instead).
6. Don't synthesize music with a script as the first choice — search the internet first. Only
   if nothing suitable (CC0/PD) exists, say so and offer a generated track.

## Tool

All from the repo root `/home/golan/Documents/GolanAI` (search terms in English work best):

```bash
# search (prints: id, license, size/duration, title, source page)
python3 tools/fetch_free_asset.py search image "wedding flowers" --n 10 --orientation tall
python3 tools/fetch_free_asset.py search audio "calm piano" --n 10 --min-sec 60

# download by id into <project>/assets/ (refuses anything that is not cc0/pdm)
python3 tools/fetch_free_asset.py get image <id> <project-dir> --name bg.jpg
python3 tools/fetch_free_asset.py get audio <id> <project-dir> --name music.mp3

# fonts -> <project>/assets/fonts/*.woff + assets/fonts.css
python3 tools/fetch_free_asset.py font "Rubik:wght@400;700;900" <project-dir> --font "Suez One"
```

Source: the Openverse API (indexes Wikimedia Commons, Flickr, Freesound, Jamendo-free parts,
museums, …) filtered server-side to `license=cc0,pdm`, re-checked before download.

## Workflow

1. Decide what's needed (background photo, music bed, whoosh/chime sounds, Hebrew fonts).
2. `search` → pick results that fit; for audio prefer `--min-sec` ≥ the video length (or one
   that loops cleanly). Open the source page if the title looks like it may be someone else's
   work re-uploaded (e.g. a commercial song "remix", a movie still) and skip it.
3. `get` into the project. Then prepare with ffmpeg locally if needed:
   - trim/fade music: `ffmpeg -i assets/raw.mp3 -t 30 -af "afade=t=in:d=1,afade=t=out:st=28:d=2,loudnorm" assets/music.m4a`
   - resize photos: `ffmpeg -i assets/raw.jpg -vf scale=1080:-2 assets/bg.jpg`
   Update the `file` in `CREDITS.json` if the final file name changed.
4. Use in the composition:
   - `<link rel="stylesheet" href="assets/fonts.css">` and `font-family: 'Rubik'`
   - `<audio src="assets/music.m4a" data-start="0" ...>` / `<img src="assets/bg.jpg">`
5. Run the HyperFrames check/snapshot as usual (see the `/hyperframes` skill). Before finishing,
   grep the project for `http` in `src=`/`href=`/`url(` — there must be none for media or fonts.
   **Text-fit gate (mandatory before render):** `python3 tools/check_text_fit.py <project-dir>`
   must print OK. No date, name or title may stick out of its card or the frame. Big one-line
   text gets `white-space:nowrap` and a font-size that fits the card's inner width (a date like
   `10.12.26` in an 880px card with 60px padding ≈ 190px Secular One, not 230px). If the check
   fails, shrink the font or widen the card and run it again, then view a frame of each scene in
   the final MP4.
6. In the reply, list the assets used with their license (from `CREDITS.json`).

## Hebrew fonts on Google Fonts (all OFL)

Rubik, Heebo, Assistant, Secular One, Suez One, Frank Ruhl Libre, David Libre, Amatic SC,
Karantina, Varela Round, Alef, Bellefair, Miriam Libre, Noto Sans/Serif Hebrew, Playpen Sans Hebrew.
