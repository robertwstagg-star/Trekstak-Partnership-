# Creator AI — Phase 1

Phase 1 adds **Creator AI** to the partners dashboard: six purpose-built tools, OpenAI via Cloud Functions, usage limits, and copy/regenerate UX.

## Before deploy

### 1. Set OpenAI secret (required for generation)

```bash
npx firebase functions:secrets:set OPENAI_API_KEY
```

Paste your OpenAI API key when prompted.

### 2. Re-seed registry (promo + public URLs for AI CTAs)

```bash
npm run seed:registry
```

This updates `creator_registry` with `promoCode`, `discountLabel`, `publicPageUrl`, etc.

### 3. Build and deploy

```bash
npm run functions:build
npx firebase deploy --only functions
```

Push this repo to GitHub (`git push origin main`) so GitHub Pages updates `partners.trekstakapp.com`.

## Dashboard

Bottom nav: **Creator AI** tab (between Page and Earn).

| Tool | Purpose |
|------|---------|
| TrekStak Content | TrekStak-native concepts, hooks, structure, CTA |
| Reel Ideas | Short-form video concepts + shot lists |
| Instagram | Carousels, Stories, captions |
| YouTube | Titles, hooks, outlines, descriptions |
| Travel Content Ideas | Audience growth ideas (not hard-sell) |
| Hooks & Captions | Quick hooks, captions, CTAs |

**Usage:** 100 generations/month per creator (tracked in `creator_ai_usage`).

## Architecture

- **UI:** `creator-ai.js`, `creator-ai.css`
- **Functions:** `creatorAiGenerate`, `creatorAiGetUsage`
- **Prompts:** `functions/src/creatorAi/prompts.ts`
- **Product facts:** `functions/assets/trekstak-product.json`
- **Model:** `gpt-5.6` (same as the iOS Trekker Mini Guide; server-side only)

## Local testing

Creator AI requires **email link sign-in** + deployed functions (or emulators). Local **Preview demo locally** does not call OpenAI.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Creator AI is not configured yet" | Set `OPENAI_API_KEY` secret and redeploy functions |
| "Complete dashboard sign-in" | Use email magic link, not local demo preview |
| "No generations left" | Wait for next month or raise `limit` on `creator_ai_usage/{slug}_{month}` in Firestore |
| Empty or parse errors | Regenerate; check Functions logs in Firebase Console |

## Next (Phase 2)

- Creator style profile editor in dashboard
- Destination-aware context from TrekStak city/walk data
- Save output to post draft
