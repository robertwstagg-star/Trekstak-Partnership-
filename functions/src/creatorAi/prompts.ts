import { productKnowledgeBlock } from "./productKnowledge";

export const TOOL_IDS = [
  "trekstak_content",
  "reel_ideas",
  "instagram",
  "youtube",
  "travel_content_ideas",
  "hooks_captions",
] as const;

export type ToolId = (typeof TOOL_IDS)[number];

export interface CreatorContext {
  displayName: string;
  handle: string;
  promoCode: string;
  discountLabel: string;
  publicPageUrl: string;
  appStoreUrl: string;
  instagram: string;
  tiktok: string;
  youtube: string;
  styleProfile?: Record<string, unknown>;
}

export interface GenerateResult {
  title: string;
  sections: Array<{ heading: string; body: string }>;
}

function styleBlock(ctx: CreatorContext): string {
  const sp = ctx.styleProfile;
  if (!sp || Object.keys(sp).length === 0) {
    return "Write in the creator's natural voice: casual, personal, travel-native — not corporate.";
  }
  return `CREATOR STYLE PROFILE (follow closely):\n${JSON.stringify(sp, null, 2)}`;
}

function promoBlock(ctx: CreatorContext, includePromo: boolean): string {
  if (!includePromo) {
    return "Do not mention TrekStak promo codes or links unless the user input explicitly asks.";
  }
  return [
    "When including a TrekStak CTA, use ONLY these facts:",
    `Promo code: ${ctx.promoCode}`,
    `Discount: ${ctx.discountLabel}`,
    `Creator page: ${ctx.publicPageUrl}`,
    `App Store: ${ctx.appStoreUrl}`,
    ctx.handle ? `Handle: ${ctx.handle}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function baseSystem(ctx: CreatorContext): string {
  return [
    "You are Creator AI inside the TrekStak Creator Hub.",
    productKnowledgeBlock(),
    styleBlock(ctx),
    `Creator: ${ctx.displayName}`,
  ].join("\n\n");
}

export function buildMessages(
  toolId: ToolId,
  inputs: Record<string, unknown>,
  ctx: CreatorContext
): { system: string; user: string; maxTokens: number } {
  const includeTrekstak =
    inputs.includeTrekstak === true ||
    inputs.includeTrekstakCta === true ||
    toolId === "trekstak_content";

  const system = [
    baseSystem(ctx),
    promoBlock(ctx, includeTrekstak),
    "OUTPUT FORMAT: Return valid JSON only, no markdown fences:",
    '{"title":"short result title","sections":[{"heading":"Section name","body":"content..."}]}',
    "Use multiple sections with clear headings. Use plain text in body (line breaks allowed).",
  ].join("\n\n");

  switch (toolId) {
    case "trekstak_content":
      return {
        system,
        user: [
          "Generate TrekStak-focused content concepts.",
          `Destination: ${inputs.destination || "not specified"}`,
          `TrekStak feature to highlight: ${inputs.feature || "general app"}`,
          `Platform: ${inputs.platform || "Instagram"}`,
          `Format: ${inputs.format || "Reel"}`,
          `Tone: ${inputs.tone || "casual"}`,
          inputs.additionalContext
            ? `Additional context: ${String(inputs.additionalContext).slice(0, 800)}`
            : "",
          "Sections should include: Content concepts (3 bullets), Hook, Video structure, Talking points, TrekStak demonstration idea, CTA, Caption.",
        ].join("\n"),
        maxTokens: 1800,
      };

    case "reel_ideas":
      return {
        system,
        user: [
          "Generate a short-form travel video concept.",
          `Destination: ${inputs.destination || ""}`,
          `Topic: ${inputs.topic || ""}`,
          `Platform: ${inputs.platform || "Instagram Reels"}`,
          `Style: ${inputs.style || "casual"}`,
          includeTrekstak ? "Include a natural TrekStak integration section." : "No TrekStak mention required.",
          "Sections: Hook, Concept, Shot list (numbered), Talking points, CTA.",
        ].join("\n"),
        maxTokens: 1400,
      };

    case "instagram":
      return {
        system,
        user: [
          "Generate Instagram content from this brief:",
          String(inputs.brief || "").slice(0, 1200),
          includeTrekstak ? "Include a final section with TrekStak CTA copy." : "",
          "If carousel/slides requested, use sections Slide 1, Slide 2, etc.",
        ].join("\n"),
        maxTokens: 1600,
      };

    case "youtube":
      return {
        system,
        user: [
          "Generate YouTube video planning content for:",
          String(inputs.brief || "").slice(0, 1200),
          includeTrekstak ? "Include TrekStak integration points and description CTA." : "",
          "Sections: Title options, Hook, Outline, Talking points, Description draft, CTA.",
        ].join("\n"),
        maxTokens: 1800,
      };

    case "travel_content_ideas":
      return {
        system,
        user: [
          "Generate travel content ideas to grow the creator's audience (not hard-sell TrekStak).",
          `Destination or theme: ${inputs.destination || ""}`,
          `Number of ideas: ${inputs.count || 20}`,
          "Group ideas in sections (e.g. Guides, Food, Tips). Each idea one short line in the body.",
          "Do not include promo codes.",
        ].join("\n"),
        maxTokens: 1600,
      };

    case "hooks_captions":
      const hookN = Math.min(10, Math.max(1, Number(inputs.hookCount) || 5));
      const capN = Math.min(10, Math.max(1, Number(inputs.captionCount) || 3));
      const ctaN = Math.min(10, Math.max(1, Number(inputs.ctaCount) || 5));
      return {
        system,
        user: [
          "Generate social copy for:",
          String(inputs.brief || "").slice(0, 800),
          `Provide exactly ${hookN} hooks, ${capN} captions, and ${ctaN} CTAs in separate sections.`,
          includeTrekstak ? "CTAs should use the creator promo facts when relevant." : "CTAs should not mention TrekStak.",
        ].join("\n"),
        maxTokens: 1200,
      };

    default:
      throw new Error(`Unknown tool: ${toolId}`);
  }
}

export function parseGenerateResult(raw: string): GenerateResult {
  let parsed: GenerateResult;
  try {
    parsed = JSON.parse(raw) as GenerateResult;
  } catch {
    throw new Error("Could not parse AI response.");
  }
  if (!parsed.title || !Array.isArray(parsed.sections)) {
    throw new Error("AI response missing title or sections.");
  }
  parsed.sections = parsed.sections
    .filter((s) => s && s.heading && s.body)
    .map((s) => ({
      heading: String(s.heading).slice(0, 120),
      body: String(s.body).slice(0, 4000),
    }));
  if (!parsed.sections.length) {
    throw new Error("AI returned empty content.");
  }
  parsed.title = String(parsed.title).slice(0, 160);
  return parsed;
}
