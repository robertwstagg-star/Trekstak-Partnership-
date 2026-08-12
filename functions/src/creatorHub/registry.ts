/**
 * Maps a normalized email to a Firestore-safe document id for creator_registry.
 */
export function emailToRegistryId(email: string): string {
  return email
    .trim()
    .toLowerCase()
    .replace(/\./g, "_dot_")
    .replace(/@/g, "_at_");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function currentUsageMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function usageDocId(slug: string, month: string): string {
  return `${slug}_${month}`;
}
