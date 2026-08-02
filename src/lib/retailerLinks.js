// Plain search links, deliberately. There is no affiliate tag here and no
// affiliate relationship anywhere on the site — we earn nothing when someone
// clicks through, which is why no commission disclosure is rendered next to
// these links and why the terms page has no affiliate section.
//
// Do not reintroduce a tag without also restoring that disclosure: the CMA and
// ASA require it visible before the click, and Amazon's own terms would then
// forbid showing our curated price snapshot beside the link at all.
export function searchUrl(name, brand) {
  const term = brand ? `${brand} ${name}` : name
  return `https://www.amazon.co.uk/s?k=${encodeURIComponent(term)}`
}
