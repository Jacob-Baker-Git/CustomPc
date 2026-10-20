import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from 'react'
import { SHOWROOM_SLOTS, COMPACT_IDS } from '../../lib/showroom.js'
import { categoryLabel } from '../../lib/categories.js'
import PartPictogram from './PartPictogram.jsx'

const ALL_IDS = SHOWROOM_SLOTS.map((s) => s.id)
const SIDE = Object.fromEntries(SHOWROOM_SLOTS.map((s) => [s.id, s.side]))
// Label column edges (% of the frame): left 3 + width 33, right 3 + width 33.
const EDGE = { l: 36, r: 64 }
const gbp = (n) => `£${Number(n ?? 0).toLocaleString('en-GB')}`

const ShowroomOverlay = forwardRef(function ShowroomOverlay(
  { parts, ids = ALL_IDS, anchors, hot, setHot, compact, chip },
  ref,
) {
  const dots = useRef({})
  const lines = useRef({})
  const rows = useRef({}) // id -> label-edge point, set during render
  const pos = useRef({}) // id -> last placed {x, y, visible}

  const picked = ids.filter((id) => parts?.[id])
  const compactIds = COMPACT_IDS.filter((id) => picked.includes(id))
  const shown = compact ? compactIds : picked

  if (!compact) {
    for (const side of ['l', 'r']) {
      const col = picked.filter((id) => SIDE[id] === side)
      col.forEach((id, i) => { rows.current[id] = { x: EDGE[side], y: ((i + 0.5) / col.length) * 100 } })
    }
  }

  // Direct DOM writes only: this runs every rendered 3D frame.
  const place = (id, x, y, visible) => {
    pos.current[id] = { x, y, visible }
    const dot = dots.current[id]
    const line = lines.current[id]
    const show = visible !== false
    if (dot) {
      dot.style.display = show ? '' : 'none'
      dot.style.left = `${x}%`
      dot.style.top = `${y}%`
    }
    if (line) {
      const from = rows.current[id]
      line.style.display = show && from ? '' : 'none'
      if (from) line.setAttribute('points', `${from.x},${from.y} ${x},${y}`)
    }
  }
  useImperativeHandle(ref, () => ({ place }))

  // After every render: static anchors, else replay the last live position.
  useLayoutEffect(() => {
    for (const id of shown) {
      const a = anchors?.[id] ?? pos.current[id]
      if (a) place(id, a.x, a.y, a.visible)
      else if (dots.current[id]) dots.current[id].style.display = 'none'
    }
  })

  if (!picked.length) return null
  const sel = hot && parts[hot] ? hot : null
  const dotCls = (id) =>
    `absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-brass ${hot === id ? 'bg-brass' : 'bg-surface'}`

  return (
    <div className="pointer-events-none absolute inset-0">
      {!compact && (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          {picked.map((id) => (
            <polyline
              key={id}
              data-line={id}
              ref={(el) => { lines.current[id] = el }}
              fill="none"
              vectorEffect="non-scaling-stroke"
              strokeWidth={hot === id ? 2 : 1}
              strokeOpacity={hot === id ? 1 : 0.6}
              className="stroke-brass"
            />
          ))}
        </svg>
      )}

      {shown.map((id, i) =>
        compact ? (
          <button
            key={id}
            type="button"
            data-dot={id}
            aria-label={categoryLabel(id)}
            ref={(el) => { dots.current[id] = el }}
            onClick={() => setHot(id)}
            className={`${dotCls(id)} pointer-events-auto grid h-8 w-8 place-items-center text-sm font-bold ${hot === id ? 'text-accent-ink' : 'text-brass'}`}
          >
            {i + 1}
          </button>
        ) : (
          <span key={id} data-dot={id} ref={(el) => { dots.current[id] = el }} className={`${dotCls(id)} h-2.5 w-2.5`} />
        ),
      )}

      {!compact &&
        picked.map((id) => {
          const on = hot === id
          const right = SIDE[id] === 'r'
          return (
            <div
              key={id}
              data-label={id}
              onMouseEnter={() => setHot(id)}
              onMouseLeave={() => setHot(null)}
              style={{ top: `${rows.current[id].y}%` }}
              className={`pointer-events-auto absolute w-[33%] -translate-y-1/2 border px-2 py-1.5 transition-colors ${right ? 'right-[3%] text-right' : 'left-[3%]'} ${on ? 'border-brass bg-brass text-accent-ink' : 'border-line bg-surface'}`}
            >
              <div className={`flex gap-2 text-[12px] uppercase tracking-wide ${right ? 'justify-end' : ''} ${on ? 'text-accent-ink' : 'text-brass'}`}>
                {categoryLabel(id)}
                <span className={on ? '' : 'text-muted'}>{gbp(parts[id].price)}</span>
              </div>
              <div data-name className="text-[12px] leading-snug">{parts[id].name}</div>
            </div>
          )
        })}

      {chip && <span className="absolute right-3 top-3 bg-surface px-1 text-[12px] text-muted">{chip}</span>}

      {compact && (
        <div data-tap-strip className="pointer-events-auto absolute inset-x-0 top-full flex min-h-16 items-center gap-3 border-t border-brass bg-surface px-4 py-3">
          {sel ? (
            <>
              <PartPictogram id={sel} className="h-7 w-7 shrink-0 text-brass" />
              <div className="min-w-0 flex-1">
                <div className="text-[12px] uppercase tracking-wide text-brass">{categoryLabel(sel)}</div>
                <div className="text-sm">{parts[sel].name}</div>
              </div>
              <span className="text-base">{gbp(parts[sel].price)}</span>
            </>
          ) : (
            <span className="text-[12px] uppercase tracking-wide text-muted">Tap a number to see the part</span>
          )}
        </div>
      )}
    </div>
  )
})

export default ShowroomOverlay
