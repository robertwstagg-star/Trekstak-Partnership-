import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {
  currentUsageMonth,
  emailToRegistryId,
  normalizeEmail,
  usageDocId,
} from "./registry";

const DEFAULT_MONTHLY_AI_LIMIT = 100;

interface RegistryDoc {
  slug: string;
  creatorId: string;
  email: string;
  status: string;
}

/**
 * Health check for deployed Creator Hub functions (requires Firebase Auth).
 */
export const creatorHubPing = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  return {
    ok: true,
    uid: request.auth.uid,
    email: request.auth.token.email ?? null,
    creatorSlug: request.auth.token.creatorSlug ?? null,
  };
});

/**
 * After email-link sign-in: verify creator registry, set custom claims, init private docs.
 */
export const creatorHubActivateSession = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  const rawEmail = request.auth.token.email;
  if (!rawEmail) {
    throw new HttpsError(
      "failed-precondition",
      "Email sign-in is required for the creator dashboard."
    );
  }

  const email = normalizeEmail(rawEmail);
  const registryId = emailToRegistryId(email);
  const registrySnap = await admin
    .firestore()
    .collection("creator_registry")
    .doc(registryId)
    .get();

  if (!registrySnap.exists) {
    throw new HttpsError(
      "permission-denied",
      "No active creator account is linked to this email."
    );
  }

  const registry = registrySnap.data() as RegistryDoc;
  if (registry.status !== "active") {
    throw new HttpsError("permission-denied", "This creator account is not active.");
  }

  const slug = String(registry.slug || "").trim().toLowerCase();
  if (!slug || slug.length < 2 || slug.length > 64) {
    throw new HttpsError("internal", "Creator registry entry is missing a valid slug.");
  }

  await admin.auth().setCustomUserClaims(request.auth.uid, {
    creatorSlug: slug,
    creatorId: registry.creatorId || null,
  });

  const now = admin.firestore.FieldValue.serverTimestamp();
  const privateRef = admin.firestore().collection("creator_hub_private").doc(slug);
  const privateSnap = await privateRef.get();
  const existingPrivate = privateSnap.data() || {};
  const markPasswordSet = request.data && request.data.passwordSet === true;
  const passwordSet = markPasswordSet || existingPrivate.passwordSet === true;

  await privateRef.set(
    {
      slug,
      email,
      updatedAt: now,
      ...(markPasswordSet ? { passwordSet: true } : {}),
    },
    { merge: true }
  );

  const month = currentUsageMonth();
  const usageRef = admin
    .firestore()
    .collection("creator_ai_usage")
    .doc(usageDocId(slug, month));
  const usageSnap = await usageRef.get();
  if (!usageSnap.exists) {
    await usageRef.set({
      slug,
      month,
      requestCount: 0,
      tokenCountInput: 0,
      tokenCountOutput: 0,
      estimatedCostUsd: 0,
      limit: DEFAULT_MONTHLY_AI_LIMIT,
      updatedAt: now,
    });
  }

  return {
    slug,
    creatorId: registry.creatorId,
    email,
    monthlyAiLimit: DEFAULT_MONTHLY_AI_LIMIT,
    needsPasswordSetup: !passwordSet,
  };
});
