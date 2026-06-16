// Set to an Amazon Associates tag to monetise later; empty = plain search links.
export const AMAZON_TAG = ''

export function searchUrl(name) {
  const base = `https://www.amazon.co.uk/s?k=${encodeURIComponent(name)}`
  return AMAZON_TAG ? `${base}&tag=${AMAZON_TAG}` : base
}
