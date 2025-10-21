export function extractHook({ title, body, caption, cardsText }: { title?: string; body?: string; caption?: string; cardsText?: string }): string {
  const parts = [title, body, caption, cardsText].filter(Boolean).map(s => (s || '').trim());
  const text = parts.join(' \n ').replace(/\s+/g, ' ').trim();
  if (!text) return '';

  // Prefer first sentence-like chunk
  const match = text.match(/(^.{0,180}?([.!?]|$))/);
  let hook = match ? match[1] : text.slice(0, 180);
  hook = hook.trim();
  // Clean trailing separators
  hook = hook.replace(/[\-–|,:;]+$/g, '').trim();
  return hook;
}


