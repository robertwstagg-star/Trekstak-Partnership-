import * as fs from "fs";
import * as path from "path";

export interface ProductKnowledge {
  version: number;
  appName: string;
  summary: string;
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
  return [
    `PRODUCT: ${p.appName}`,
    p.summary,
    `Subscription: list ~$${p.subscription.listPriceAnnualUsd}/year. ${p.subscription.creatorDiscountExample}`,
    `Redemption: ${p.subscription.redemption}`,
    `Creator program: ${p.creatorProgram.commission}. ${p.creatorProgram.publicPage}`,
    "FEATURES (only reference these):",
    features,
    `Coverage: ${p.coverage.citiesNote}`,
    "VOICE RULES:",
    rules,
  ].join("\n");
}
