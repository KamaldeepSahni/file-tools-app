export function sanitizeFilename(name: string, fallback = 'merged'): string {
  const base = (name || fallback)
    .replace(/[/\\?%*:|"<>]/g, ' ') // disallow unsafe chars
    .replace(/\s+/g, ' ')
    .trim();
  return base.length ? base : fallback;
}
