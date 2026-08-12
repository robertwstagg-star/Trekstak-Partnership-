# GitHub — Trekstak-Partnership

This folder **is** the GitHub repo ([Trekstak-Partnership](https://github.com/robertwstagg-star/Trekstak-Partnership-)). It includes the **partners site** and **Firebase backend** (`functions/`), not the iOS app.

## Push changes (recommended)

```bash
cd "/Users/robertstagg/Desktop/Trekstak 1.5/partners-site"
git add .
git commit -m "your message"
git push origin main
```

GitHub Pages updates `partners.trekstakapp.com` after push.

## Deploy Firebase (Creator AI + auth)

From this same folder:

```bash
npm install
npm run functions:install
npx firebase login
npx firebase use trekstak-3f419
npm run deploy:creator-hub
```

See `docs/CREATOR_AI_PHASE0.md` and `docs/CREATOR_AI_PHASE1.md`.

## Manual Desktop copy (optional)

Use **`~/Desktop/partners-trekstakapp/`** if you upload via the GitHub website instead of `git push`:

```bash
rsync -a --delete --exclude '.git' --exclude '.DS_Store' \
  --exclude 'node_modules' --exclude 'functions/node_modules' --exclude 'functions/lib' \
  "/Users/robertstagg/Desktop/Trekstak 1.5/partners-site/" \
  "/Users/robertstagg/Desktop/partners-trekstakapp/"
```

## Repo tree (key paths)

```
Trekstak-Partnership-/
├── firebase.json, .firebaserc, firestore.rules
├── package.json
├── functions/                 ← Cloud Functions (Creator AI)
├── docs/CREATOR_AI_PHASE0.md
├── dashboard.html, creator-ai.js, creator-hub-auth.js, …
├── finallogo.png, Instagram_Glyph_Gradient.png, youtube-icon.svg
├── data/creator-accounts.json
└── js/                        ← mirrored scripts for Pages
```

## Common mistakes (fix these if you see them)

| Wrong | Right |
|-------|--------|
| `creator-accounts.json` at repo root | `data/creator-accounts.json` |
| `creator-image-upload.js` at root | `js/creator-image-upload.js` |
| `creator-public-store.js` at root | `js/creator-public-store.js` |
| `smooth-scroll.js` at root | `js/smooth-scroll.js` |
| `finallogo .png` (space) | `finallogo.png` |
| Missing `styles.css` | Add from Desktop pack |
| Missing `js/firebase-config.js` | Add from Desktop pack |

## After upload — smoke test

1. **Landing:** `https://partners.trekstakapp.com` — mobile shows **Dashboard** + **Apply** in header.
2. **Dashboard:** `https://partners.trekstakapp.com/dashboard.html` — sign in with `chris@demo.trekstakapp.com`.
3. **Button:** top-right says **View public page** (not the raw URL).
4. **Sections:** scroll to **Page profile** and **Posts** — forms load.
5. **DevTools (optional):** no 404s for `styles.css`, `data/creator-accounts.json`, or anything under `js/`.

## Creators site (separate repo)

Upload **`~/Desktop/creators-trekstakapp/`** to the creators GitHub Pages repo:

```
creators-site/
├── CNAME
├── index.html
├── 404.html
├── app.js
├── styles.css
├── finallogo.png
├── apple-badge-black.png
├── Instagram_Glyph_Gradient.png
├── youtube-icon.svg
├── data/
│   └── creators.json
├── js/
│   └── creator-public-store.js
└── docs/
    └── post-template.md
```

## Firebase storage (iOS app project — separate)

Photo upload rules live in the main TrekStak iOS project (`Trekstak 1.5/storage.rules`). Deploy from there if you change storage rules:

```bash
cd "/Users/robertstagg/Desktop/Trekstak 1.5"
npx firebase deploy --only storage
```

## Sync public creator data (optional)

After editing dashboard JSON:

```bash
python3 scripts/sync-creator-public.py
```

Then upload updated `creators-site/data/creators.json` to the creators repo.
