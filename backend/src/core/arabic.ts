export function normalizeArabic(s: string): string {
  return s
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ىئ]/g, 'ي')
    .replace(/[ؤ]/g, 'و')
    .replace(/[ک]/g, 'ك')
    .replace(/[\u064B-\u065F]/g, '');
}
