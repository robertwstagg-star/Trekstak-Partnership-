import * as admin from "firebase-admin";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { emailToRegistryId, normalizeEmail } from "../creatorHub/registry";
import { openAiApiKey } from "./secrets";
import {
  buildMessages,
  parseGenerateResult,
  TOOL_IDS,
  type ToolId,
  type CreatorContext,
} from "./prompts";
import { assertCanGenerate, getUsage, recordGeneration } from "./usage";

const MODEL = "gpt-4o-mini";
const MAX_INPUT_CHARS = 2000;

interface RegistryDoc {
  slug: string;
  creatorId: string;
  email: string;
  status: string;
  displayName?: string;
  handle?: string;
  promoCode?: string;
  discountLabel?: string;
  publicPageUrl?: string;
  appStoreUrl?: string;
  socials?: { instagram?: string; tiktok?: string; youtube?: string };
}

async function loadCreatorContext(slug: string, email: string): Promise<CreatorContext> {
  const registryId = emailToRegistryId(email);
  const registrySnap = await admin.firestore().collection("creator_registry").doc(registryId).get();
  if (!registrySnap.exists) {
    throw new HttpsError("permission-denied", "Creator registry entry not found.");
  }
  const reg = registrySnap.data() as RegistryDoc;
  if (reg.slug !== slug) {
    throw new HttpsError("permission-denied", "Session does not match creator registry.");
  }

  const privateSnap = await admin.firestore().collection("creator_hub_private").doc(slug).get();
  const privateData = privateSnap.data() || {};

  const socials = reg.socials || {};
  return {
    displayName: reg.displayName || "Creator",
    handle: reg.handle || "",
    promoCode: reg.promoCode || "",
    discountLabel: reg.discountLabel || "",
    publicPageUrl: reg.publicPageUrl || `https://creators.trekstakapp.com/c/${slug}`,
    appStoreUrl: reg.appStoreUrl || "",
    instagram: socials.instagram || "",
    tiktok: socials.tiktok || "",
    youtube: socials.youtube || "",
    styleProfile: privateData.styleProfile as Record<string, unknown> | undefined,
  };
}

function sanitizeInputs(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "boolean") {
      out[key] = value;
    } else if (typeof value === "number") {
      out[key] = value;
    } else if (typeof value === "string") {
      out[key] = value.slice(0, MAX_INPUT_CHARS);
    }
  }
  return out;
}

async function callOpenAi(
  apiKey: string,
  system: string,
  user: string,
  maxTokens: number
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: maxTokens,
      temperature: 0.75,
      response_format: { type: "json_object" },
    }),
  });

  if (response.status === 429) {
    throw new HttpsError("resource-exhausted", "AI is busy right now. Try again in a minute.");
  }
  if (!response.ok) {
    const errText = await response.text();
    console.error("OpenAI error", response.status, errText.slice(0, 500));
    throw new HttpsError("internal", "Creator AI could not complete that request. Try again.");
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new HttpsError("internal", "Creator AI returned an empty response. Try again.");
  }

  return {
    content,
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  };
}

function requireCreatorSlug(request: { auth?: { token?: Record<string, unknown> } }): string {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  const slug = request.auth.token?.creatorSlug;
  if (!slug || typeof slug !== "string") {
    throw new HttpsError(
      "failed-precondition",
      "Complete dashboard sign-in to use Creator AI."
    );
  }
  return slug;
}

export const creatorAiGetUsage = onCall(async (request) => {
  const slug = requireCreatorSlug(request);
  const usage = await getUsage(slug);
  return usage;
});

export const creatorAiGenerate = onCall(
  { secrets: [openAiApiKey], timeoutSeconds: 120, memory: "256MiB" },
  async (request) => {
    const slug = requireCreatorSlug(request);
    const email = request.auth?.token?.email;
    if (!email || typeof email !== "string") {
      throw new HttpsError("failed-precondition", "Email sign-in required.");
    }

    const toolId = request.data?.toolId;
    if (!toolId || !TOOL_IDS.includes(toolId as ToolId)) {
      throw new HttpsError("invalid-argument", "Choose a valid Creator AI tool.");
    }

    const inputs = sanitizeInputs(request.data?.inputs);
    await assertCanGenerate(slug);
    const ctx = await loadCreatorContext(slug, normalizeEmail(email));
    const { system, user, maxTokens } = buildMessages(toolId as ToolId, inputs, ctx);

    const apiKey = openAiApiKey.value();
    if (!apiKey) {
      throw new HttpsError("failed-precondition", "Creator AI is not configured yet.");
    }

    let openAiResult;
    try {
      openAiResult = await callOpenAi(apiKey, system, user, maxTokens);
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      console.error("OpenAI network error", err);
      throw new HttpsError("unavailable", "Creator AI is temporarily unavailable. Try again.");
    }

    let result;
    try {
      result = parseGenerateResult(openAiResult.content);
    } catch (err) {
      console.error("Parse error", err);
      throw new HttpsError("internal", "Could not read the AI response. Try regenerating.");
    }

    const usage = await recordGeneration(
      slug,
      openAiResult.inputTokens,
      openAiResult.outputTokens
    );

    return {
      toolId,
      result,
      usage,
    };
  }
);
