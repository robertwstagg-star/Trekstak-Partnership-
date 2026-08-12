import * as fs from "fs";
import * as path from "path";

export interface ProductKnowledge {
  version: number;
  appName: string;
  summary: string;
  branding?: {
    slogan?: string;
    oneLiner?: string;
    positioning?: string;
    promise?: string;
    whoItsFor?: string;
    whatItIsNot?: string;
    howItWorks?: string;
    platform?: string;
    coverageLine?: string;
    trialLine?: string;
    wordsWeUse?: string[];
    wordsWeAvoid?: string[];
    explain15sec?: string;
    explain60sec?: string;
  };
  subscription: Record<string, string | number>;
  creatorProgram: Record<string, string>;
  features: Array<{ id: string; label: string; description: string }>;
  coverage: Record<string, string>;
  voiceRules: string[];
}

let cached: ProductKnowledge | null = null;

export function loadProductKnowledge(): ProductKnowledge {
  if (cached) return cached;
  const filePath = path.join(__dirname, "..", "..", "assets", "trekstak-product.json");
  const raw = fs.readFileSync(filePath, "utf8");
  cached = JSON.parse(raw) as ProductKnowledge;
  return cached;
}

export function productKnowledgeBlock(): string {
  const p = loadProductKnowledge();
  const features = p.features
    .map((f) => `- ${f.label}: ${f.description}`)
    .join("\n");
  const rules = p.voiceRules.map((r) => `- ${r}`).join("\n");
  const b = p.branding || {};
  const brandingLines = [
    b.slogan ? `Slogan: ${b.slogan}` : "",
    b.oneLiner ? `One-liner: ${b.oneLiner}` : "",
    b.positioning ? `Positioning: ${b.positioning}` : "",
    b.promise ? `Promise: ${b.promise}` : "",
    b.whoItsFor ? `Who it's for: ${b.whoItsFor}` : "",
    b.whatItIsNot ? `What it is not: ${b.whatItIsNot}` : "",
    b.howItWorks ? `How it works: ${b.howItWorks}` : "",
    b.platform ? `Platform: ${b.platform}` : "",
    b.coverageLine ? `Coverage: ${b.coverageLine}` : "",
    b.trialLine ? `Trial: ${b.trialLine}` : "",
    b.explain15sec ? `15-second explain: ${b.explain15sec}` : "",
    b.explain60sec ? `60-second explain: ${b.explain60sec}` : "",
    b.wordsWeUse && b.wordsWeUse.length ? `Words we use: ${b.wordsWeUse.join("; ")}` : "",
    b.wordsWeAvoid && b.wordsWeAvoid.length ? `Words we avoid: ${b.wordsWeAvoid.join("; ")}` : "",
  ].filter(Boolean);

  return [
    `PRODUCT: ${p.appName}`,
    p.summary,
    brandingLines.length ? "BRANDING AND MESSAGING (source of truth):" : "",
    ...brandingLines,
    `Subscription: list ~$${p.subscription.listPriceAnnualUsd}/year. ${p.subscription.creatorDiscountExample}`,
    `Redemption: ${p.subscription.redemption}`,
    `Creator program: ${p.creatorProgram.commission}. ${p.creatorProgram.publicPage}`,
    "FEATURES (only reference these):",
    features,
    `Coverage: ${p.coverage.citiesNote} ${p.coverage.inAppCheck || ""}`.trim(),
    "VOICE RULES:",
    rules,
  ]
    .filter(Boolean)
    .join("\n");
}
