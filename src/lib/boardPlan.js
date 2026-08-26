// Geometry for the motherboard page background.
//
// Pure and React-free on purpose: the routing rules this file exists to enforce
// (45 degree corners, constant bus pitch, length-matched memory traces) are only
// checkable if the thing under test is the path data itself. A component that
// hand-draws paths can only be snapshot-tested, which pins the drawing instead
// of the rules — and hand-drawn paths are exactly how the previous version's
// bundles drifted apart.

const TOL = 1e-6

// Absolute segments [x1,y1,x2,y2] from a path built of M/H/V/L only.
// The generators below emit nothing else, deliberately: curves cannot be
// checked against the 45 degree rule.
export function segmentsOf(d) {
  const out = []
  let x = 0
  let y = 0
  for (const token of String(d).match(/[MHVL][^MHVL]*/g) ?? []) {
    const nums = token.slice(1).trim().split(/[\s,]+/).filter(Boolean).map(Number)
    switch (token[0]) {
      case 'M': [x, y] = nums; break
      case 'H': out.push([x, y, nums[0], y]); x = nums[0]; break
      case 'V': out.push([x, y, x, nums[0]]); y = nums[0]; break
      case 'L': out.push([x, y, nums[0], nums[1]]); [x, y] = nums; break
      default: break
    }
  }
  return out
}

export function pathLength(d) {
  return segmentsOf(d).reduce((sum, [x1, y1, x2, y2]) => sum + Math.hypot(x2 - x1, y2 - y1), 0)
}

export function isOrthoOr45([x1, y1, x2, y2]) {
  const dx = Math.abs(x2 - x1)
  const dy = Math.abs(y2 - y1)
  return dx < TOL || dy < TOL || Math.abs(dx - dy) < TOL
}
