# GitHub upload checklist — Trekstak-Partnership-

Use **`~/Desktop/partners-trekstakapp/`** as the source. Upload the **whole folder** to the repo root on GitHub — **keep subfolders**, do not flatten files into the root.

## Before you upload

```bash
rsync -a --delete --exclude '.git' --exclude '.DS_Store' \
  "/Users/robertstagg/Desktop/Trekstak 1.5/partners-site/" \
  "/Users/robertstagg/Desktop/partners-trekstakapp/"
```

## Correct repo tree (must match exactly)

```
Trekstak-Partnership-/
├── CNAME
├── README.md
├── GITHUB-UPLOAD.md
├── index.html
├── styles.css
├── script.js
├── finallogo.png              ← no space in filename
├── dashboard.html
├── dashboard.css
├── dashboard.js
├── dashboard-page.js
├── payment-schedule.html
├── data/
│   └── creator-accounts.json
└── js/
    ├── firebase-config.js
    ├── creator-public-store.js
    ├── creator-image-upload.js
    └── smooth-scroll.js
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
├── data/
│   └── creators.json
├── js/
│   └── creator-public-store.js
└── docs/
    └── post-template.md
```

## Firebase (not GitHub — one-time for photo upload)

From the main TrekStak project root:

```bash
firebase deploy --only storage
```

Requires `creator_pages/` rules in `storage.rules`.

## Sync public creator data (optional)

After editing dashboard JSON:

```bash
python3 scripts/sync-creator-public.py
```

Then upload updated `creators-site/data/creators.json` to the creators repo.
