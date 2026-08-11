# Partners GitHub — upload these at REPO ROOT (flat is OK)

Live site was failing because `js/...` files 404’d. Scripts now load from the **root**.

## Must be next to dashboard.html on GitHub

- `dashboard.html`  (updated)
- `dashboard-page.js`  (updated — shows real save errors)
- `dashboard.js`
- `dashboard.css`
- `firebase-config.js`          ← REQUIRED
- `creator-public-store.js`     ← REQUIRED (writes Firestore)
- `creator-image-upload.js`     ← REQUIRED
- `smooth-scroll.js`
- `data/creator-accounts.json`  (or `creator-accounts.json` if flat)
- `styles.css`, `index.html`, `script.js`, `finallogo.png`, etc.

## After upload — verify in browser

Open these URLs (must NOT say Page not found):

1. https://partners.trekstakapp.com/firebase-config.js
2. https://partners.trekstakapp.com/creator-public-store.js
3. https://partners.trekstakapp.com/creator-image-upload.js

Then dashboard → Save profile.

## Firebase checklist

1. Firestore Rules published (`creator_pages` block)
2. Authentication → Sign-in method → **Anonymous** = Enabled
3. Authentication → Settings → Authorized domains includes:
   - `partners.trekstakapp.com`
   - `creators.trekstakapp.com`
   - `localhost`
