# Creator AI — Phase 0 (Foundation)

Phase 0 adds Firebase Cloud Functions, creator email-link auth, Firestore collections for Creator AI, and tighter `creator_pages` write rules.

## What was added

| Area | Path |
|------|------|
| Firebase project config | `firebase.json`, `.firebaserc`, `firestore.indexes.json` |
| Cloud Functions | `functions/` (TypeScript) |
| Callable: health check | `creatorHubPing` |
| Callable: post-login activation | `creatorHubActivateSession` |
| Dashboard auth client | `creator-hub-auth.js` |
| Registry seed script | `scripts/seed-creator-registry.py` |
| Firestore rules | `creator_registry`, `creator_hub_private`, `creator_ai_usage`, `creator_ai_config` |

## Firestore collections

| Collection | Doc id | Client access |
|------------|--------|---------------|
| `creator_registry` | encoded email | **None** (Functions Admin SDK only) |
| `creator_hub_private` | `{slug}` | Read/write if `auth.token.creatorSlug == slug` |
| `creator_ai_usage` | `{slug}_{YYYY-MM}` | Read own month doc; writes via Functions only |
| `creator_ai_config` | e.g. `global` | Admin / Functions only |

`creator_pages/{slug}` writes now require **`creatorSlug` custom claim** matching the slug.

## One-time Firebase Console setup

1. **Authentication → Sign-in method** → enable **Email link (passwordless sign-in)**.
2. **Authentication → Settings → Authorized domains** → add:
   - `partners.trekstakapp.com`
   - `127.0.0.1` (local testing)
3. Install Firebase CLI if needed: `npm install -g firebase-tools`
4. Login: `firebase login`
5. Select project: `firebase use trekstak-3f419`

## Deploy (production)

From this repo root (`Trekstak-Partnership` / `partners-site` on your Mac):

```bash
# 0. Install CLI + function dependencies (no global npm install required)
npm install
npm run functions:install

# 1. Log in to Firebase (browser opens once)
npx firebase login
npx firebase use trekstak-3f419

# 2. Seed creator email → slug registry
npm run seed:registry

# 3. Deploy rules + functions
npm run deploy:creator-hub
```

Or step by step:

```bash
npm run deploy:rules
npm run deploy:functions
```

All `firebase` commands above use the local CLI via `npx firebase` after `npm install` at repo root.

Optional — reserve OpenAI secret for Phase 1 (not used yet):

```bash
firebase functions:secrets:set OPENAI_API_KEY
```

## Local emulators (optional)

```bash
cd functions && npm run serve
```

In the browser console on `localhost`:

```javascript
localStorage.setItem("trekstak-use-firebase-emulators", "1");
```

Then reload the dashboard. Emulators: Auth `9099`, Functions `5001`, Firestore `8080`, UI `4000`.

Seed registry against emulators requires pointing the Python script at emulator (or seed after emulator starts with import).

## Dashboard sign-in flow

1. Creator enters email → **Send sign-in link** (email must exist in `creator-accounts.json` for UX pre-check).
2. Email contains magic link → opens `dashboard.html` → Firebase completes sign-in.
3. Client calls `creatorHubActivateSession` → sets custom claims → refreshes ID token.
4. Dashboard loads partner JSON + Firestore public overlay.

**Local UI-only preview:** `Preview demo locally` on `localhost` (no cloud sync).

## Security notes

- OpenAI key must **only** live in Firebase secrets (Phase 1) — never in `firebase-config.js` or dashboard JS.
- `creator_registry` is not readable from the client.
- Anonymous Firebase auth no longer suffices for `creator_pages` writes; creators must complete email link + activation.

## Troubleshooting npm / deploy

### “firebase: command not found”

You do not need a global install. From repo root:

```bash
npm install
npx firebase login
npx firebase use trekstak-3f419
npm run deploy:creator-hub
```

### `npm warn EBADENGINE Unsupported engine … required: { node: '20' }`

This is a **warning**, not a failure, if you are on Node 22. Safe to ignore.

If `npm install` actually **fails**, install Node 20 (recommended for parity with Cloud Functions):

```bash
# If you use nvm:
nvm install 20
nvm use 20
```

Then rerun `npm install` and `npm run functions:install`.

Check versions:

```bash
node --version   # should be 18, 20, or 22
npm --version
```

### “Cannot find module” or `tsc: command not found`

You ran build before install, or from the wrong folder. From repo root:

```bash
npm run functions:install
npm run functions:build
```

Do **not** run `npm install` only at repo root expecting `functions/` deps — use `npm run functions:install` or `cd functions && npm install`.

### `EACCES` / permission errors on `npm install -g`

Skip global install. Use repo-root `npm install` + `npx firebase` instead.

### `firebase deploy` fails: “HTTP Error: 403” or “Permission denied”

- Run `npx firebase login` with the Google account that owns project `trekstak-3f419`
- Run `npx firebase use trekstak-3f419`

### `seed-creator-registry.py` fails

```bash
pip3 install firebase-admin
```

Ensure `firebase-service-account-key.json` exists in this repo root, or in the parent `Trekstak 1.5` folder on your Mac.

## Next: Phase 1

- `creatorAiGenerate` callable with `OPENAI_API_KEY`
- Creator AI UI tab + six tool forms
- Product knowledge JSON in `functions/assets/`
