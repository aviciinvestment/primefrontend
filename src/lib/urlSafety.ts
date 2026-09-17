// Only allow absolute http(s) URLs. Rejecting everything else (javascript:,
// data:, vbscript:, backslashes, protocol-relative "//evil", malformed input)
// closes open-redirect / scheme-injection when a URL arrives via a ?url= query
// param and is later written into window.location.href or an <a href> (A-05).
// Returns '' for anything unsafe so callers can fall back to an internal route.
export function safeExternalUrl(raw: string | null | undefined): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!/^https?:\/\//i.test(trimmed)) return '';
  try {
    const parsed = new URL(trimmed);
    if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || !parsed.hostname) return '';
    return parsed.href;
  } catch {
    return '';
  }
}