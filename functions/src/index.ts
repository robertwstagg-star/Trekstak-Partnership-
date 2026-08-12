import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

export { creatorHubPing, creatorHubActivateSession } from "./creatorHub/activateSession";
export { creatorAiGenerate, creatorAiGetUsage } from "./creatorAi/generate";
