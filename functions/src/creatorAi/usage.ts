import * as admin from "firebase-admin";
import { HttpsError } from "firebase-functions/v2/https";
import { currentUsageMonth, usageDocId } from "../creatorHub/registry";

const DEFAULT_LIMIT = 100;

export interface UsageSnapshot {
  month: string;
  requestCount: number;
  limit: number;
  remaining: number;
}

export async function getUsage(slug: string): Promise<UsageSnapshot> {
  const month = currentUsageMonth();
  const ref = admin.firestore().collection("creator_ai_usage").doc(usageDocId(slug, month));
  const snap = await ref.get();
  const limit = snap.exists ? Number(snap.data()?.limit ?? DEFAULT_LIMIT) : DEFAULT_LIMIT;
  const requestCount = snap.exists ? Number(snap.data()?.requestCount ?? 0) : 0;
  return {
    month,
    requestCount,
    limit,
    remaining: Math.max(0, limit - requestCount),
  };
}

export async function assertCanGenerate(slug: string): Promise<UsageSnapshot> {
  const usage = await getUsage(slug);
  if (usage.remaining <= 0) {
    throw new HttpsError(
      "resource-exhausted",
      "You've used all Creator AI generations for this month. Resets next month."
    );
  }
  return usage;
}

export async function recordGeneration(
  slug: string,
  tokenInput: number,
  tokenOutput: number
): Promise<UsageSnapshot> {
  const month = currentUsageMonth();
  const ref = admin.firestore().collection("creator_ai_usage").doc(usageDocId(slug, month));
  const costEstimate = (tokenInput * 0.15 + tokenOutput * 0.6) / 1_000_000;

  await admin.firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const limit = snap.exists ? Number(snap.data()?.limit ?? DEFAULT_LIMIT) : DEFAULT_LIMIT;
    const prevCount = snap.exists ? Number(snap.data()?.requestCount ?? 0) : 0;
    if (prevCount >= limit) {
      throw new HttpsError(
        "resource-exhausted",
        "You've used all Creator AI generations for this month."
      );
    }
    const prevIn = snap.exists ? Number(snap.data()?.tokenCountInput ?? 0) : 0;
    const prevOut = snap.exists ? Number(snap.data()?.tokenCountOutput ?? 0) : 0;
    const prevCost = snap.exists ? Number(snap.data()?.estimatedCostUsd ?? 0) : 0;

    tx.set(
      ref,
      {
        slug,
        month,
        limit,
        requestCount: prevCount + 1,
        tokenCountInput: prevIn + tokenInput,
        tokenCountOutput: prevOut + tokenOutput,
        estimatedCostUsd: prevCost + costEstimate,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });

  return getUsage(slug);
}
