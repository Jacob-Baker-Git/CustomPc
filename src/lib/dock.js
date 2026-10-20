import { stepsFor } from '../hooks/useHashView'

const LABEL = { build: 'Build', performance: 'Performance', peripherals: 'Peripherals', summary: 'Summary' }
const pounds = (n) => `£${Math.round(n).toLocaleString('en-GB')}`

// The phone dock's total (spec 2026-10-16). Peripherals are counted apart from
// the build budget, so they are named as their own figure wherever they are in
// play rather than silently added to, or left out of, the build's price.
export function dockTotalLabel({ view, build, desk }) {
  const showDesk = view === 'peripherals' || (view === 'summary' && desk > 0)
  return showDesk ? `Build ${pounds(build)} + peripherals ${pounds(desk)}` : `Build ${pounds(build)}`
}

// The dock's primary action: the next step of the build's path. Summary is the
// end of every path and gets Save and Share instead.
export function dockAction({ view, path }) {
  if (view === 'summary') return null
  const steps = stepsFor(path)
  const to = steps[steps.indexOf(view) + 1]
  return to ? { label: `Next: ${LABEL[to]}`, to } : null
}
