# TrekStak Partners (GitHub Pages)

Landing page for `https://partners.trekstakapp.com`.

## Files

- `index.html` — affiliate / partners landing page
- `styles.css` — layout and motion
- `script.js` — header scroll state + section reveals
- `CNAME` — custom domain for GitHub Pages

## Publish to GitHub

Your empty repo: `robertwstagg-star/Trekstak-Partnership-`

```bash
cd partners-site
git init
git add .
git commit -m "Add TrekStak Partners landing page"
git branch -M main
git remote add origin https://github.com/robertwstagg-star/Trekstak-Partnership-.git
git push -u origin main
```

Then in the repo:

1. **Settings → Pages** → Deploy from branch → `main` / `/ (root)` → Save
2. Custom domain: `partners.trekstakapp.com` → Save
3. Wait for DNS check + enable **Enforce HTTPS**

**Note:** Private repos need GitHub Pro for Pages. Make the repo **Public** if Pages stays disabled.

DNS (Namecheap) should already have:

| Type | Host | Value |
|------|------|-------|
| CNAME | partners | robertwstagg-star.github.io. |

## Edit later

- Application email: update the `mailto:` link in `index.html` if you use a different inbox
- Commission details: fill in rates in the “Program snapshot” panel once locked
