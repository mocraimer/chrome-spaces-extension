/**
 * Generate a UUID using crypto.randomUUID if available, with fallback
 * @param prefix Optional prefix to include in fallback (e.g., 'space', 'tab')
 * @returns A UUID string
 */
export function generateUUID(prefix?: string): string {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback for environments without crypto.randomUUID
  const random1 = Math.random().toString(36).slice(2);
  const random2 = Math.random().toString(36).slice(2);
  const timestamp = Date.now().toString(36);

  if (prefix) {
    return `${prefix}-${timestamp}-${random1}${random2}`;
  }

  return `${timestamp}-${random1}${random2}`;
}
