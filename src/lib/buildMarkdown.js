// Renders the selected build as a GitHub/forum-friendly Markdown table.
// rows: [{ label, name, price }]; total: number.
export function buildMarkdown(rows, total) {
  const header = '| Component | Part | Price |\n| --- | --- | --- |'
  const body = rows.map((r) => `| ${r.label} | ${r.name} | £${r.price.toFixed(2)} |`).join('\n')
  const totalRow = `| **Total** |  | **£${total.toFixed(2)}** |`
  return [header, body, totalRow].filter(Boolean).join('\n')
}
