// One way to write money on the site: en-GB thousands separators, £ prefix.
// gbp rounds to whole pounds (totals, budgets, deltas); gbp2 keeps pence
// (a part's own price).
export const gbp = (n) => `£${Math.round(n ?? 0).toLocaleString('en-GB')}`
export const gbp2 = (n) => `£${(n ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
