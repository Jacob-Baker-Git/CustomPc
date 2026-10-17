// The "Find builds" answers as cards, cheapest first: what each is called, what
// it costs over the card before it, and which parts differ from it. Two answers
// that came out as the same parts are one card naming both.

const SHORT = { cheapest: 'Cheapest', middle: 'Best value', best: 'Best' }
const ORDER = ['cheapest', 'middle', 'best']

const idsOf = (o) => Object.fromEntries(Object.entries(o.parts).map(([c, p]) => [c, p?.id]))
const sameParts = (a, b) => {
  const x = idsOf(a)
  const y = idsOf(b)
  const keys = new Set([...Object.keys(x), ...Object.keys(y)])
  return [...keys].every((k) => x[k] === y[k])
}

export function buildCards(result, { budget, fps }) {
  const titles = {
    cheapest: `Cheapest that hits ${fps} fps`,
    middle: 'Best value',
    best: `Best within £${budget}`,
  }
  const cards = []
  for (const kind of ORDER) {
    const option = result[kind]
    if (!option) continue
    const twin = cards.find((c) => sameParts(c.option, option))
    if (twin) {
      const t = titles[kind]
      twin.also = `also ${t[0].toLowerCase()}${t.slice(1)}`
      continue
    }
    const prev = cards.at(-1)
    let step = null
    const changed = new Set()
    if (prev) {
      const pounds = Math.round(option.total - prev.option.total)
      const gain = Math.round(option.fps - prev.option.fps)
      // Best can be the cheaper, slower card when hitting the target costs more
      // than the budget, so a step can run downhill.
      step = pounds < 0
        ? `£${-pounds} less · ${-gain} fps fewer than ${SHORT[prev.kind]}`
        : gain === 0
          ? `+£${pounds} · same fps, better parts`
          : `+£${pounds} · +${gain} fps over ${SHORT[prev.kind]}`
      const a = idsOf(prev.option)
      const b = idsOf(option)
      for (const c of new Set([...Object.keys(a), ...Object.keys(b)])) if (a[c] !== b[c]) changed.add(c)
    }
    cards.push({ kind, title: titles[kind], also: null, option, step, overBudget: option.total > budget, changed })
  }
  return cards
}
