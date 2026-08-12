import { defineSecret } from "firebase-functions/params";

/**
 * Reserved for Creator AI Phase 1. Set in Firebase before deploy:
 *   firebase functions:secrets:set OPENAI_API_KEY
 */
export const openAiApiKey = defineSecret("OPENAI_API_KEY");
