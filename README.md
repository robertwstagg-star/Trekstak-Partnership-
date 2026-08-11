# TrekStak Founding Creator Partner Program

Landing page for `https://partners.trekstakapp.com`.

Founding offer: first 10 creators · $200 starting collaboration · personal promo code (20% off first year) · 25% commission · $1,000 bonus at 500 subs · creator dashboard.

## Creator dashboard

`dashboard.html` — private partner view at `https://partners.trekstakapp.com/dashboard.html`

**Phase 1 (current):** demo login + sample metrics from `data/creator-accounts.json`.

- Sign in with the email on the creator record (demo: `chris@demo.trekstakapp.com`)
- Overview stats, travel reward progress, share kit, earnings table, payout details
- Session stored in `sessionStorage` (clears when the tab closes)

**Phase 2:** replace JSON with Firestore + App Store Server Notifications for live Offer Code metrics; Firebase Auth magic link for sign-in.

### Add a founding creator to the dashboard

Edit `data/creator-accounts.json` — match `slug` / `promoCode` to `creators-site/data/creators.json`.

### Local preview (dashboard + public page)

Use **one server** so dashboard saves appear on the public page:

```bash
./scripts/start-creator-local.sh
```

- **Dashboard:** http://127.0.0.1:8787/partners/dashboard.html — `chris@demo.trekstakapp.com`
- **Public page:** http://127.0.0.1:8787/c/chris

Separate ports (`8787` creators + `8788` partners) do **not** share preview data.

### Partners dashboard only

```bash
cd partners-site
python3 -m http.server 8788
```

Open `http://127.0.0.1:8788/dashboard.html` (no public-page preview sync).

## Desktop upload pack

A copy for easy upload lives at:

`~/Desktop/partners-trekstakapp/`

Edit in `Trekstak 1.5/partners-site/`, then re-copy to Desktop before deploying (or sync with rsync):

```bash
rsync -a --delete --exclude '.git' --exclude '.DS_Store' \
  "/Users/robertstagg/Desktop/Trekstak 1.5/partners-site/" \
  "/Users/robertstagg/Desktop/partners-trekstakapp/"
```

## Application form email

The apply form posts to **FormSubmit** and emails **partners@trekstakapp.com**.

1. Deploy the updated site.
2. Submit one test application.
3. Confirm the FormSubmit activation email the first time (required once).
4. Later submissions arrive as formatted emails.

To change the inbox, edit the form `action` in `index.html`:

`https://formsubmit.co/your@email.com`
