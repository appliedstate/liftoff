export type ForcekeyEntry = { key: string; value: string };

export function extractForcekeys(linkUrl?: string): ForcekeyEntry[] {
  if (!linkUrl) return [];
  try {
    const url = new URL(linkUrl);
    const out: ForcekeyEntry[] = [];
    for (const [k, v] of url.searchParams.entries()) {
      if (/^forcekey[A-Z]$/i.test(k)) {
        out.push({ key: k, value: decodeURIComponent(v) });
      }
    }
    // Stable sort by key (A..Z)
    out.sort((a, b) => a.key.localeCompare(b.key));
    return out;
  } catch {
    return [];
  }
}


