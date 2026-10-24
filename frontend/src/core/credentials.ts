export function cleanCredential(value: string): string {
  if (!value) return '';
  return value
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, '')
    .trim();
}
