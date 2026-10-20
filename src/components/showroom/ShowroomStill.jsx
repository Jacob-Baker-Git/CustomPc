import still from '../../data/showroomAnchors.json'
import ShowroomOverlay from './ShowroomOverlay.jsx'

const clamp = (v, lo, hi) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)))
const ratio = (s) => { const [w, h] = s.split('/').map(Number); return w / h }

// Where the picture box sits in the frame, in frame fractions. The box is the
// image fitted by height and centred; zoomed, it scales about the anchor and
// slides so the anchor is as near the middle as the picture's edges allow.
function layout(frame, zoom) {
  const r = (still.width / still.height) / ratio(frame) // box width / frame width
  const a = zoom && still.anchors[zoom.id]
  if (!a) return { r, focus: null, transform: undefined }
  const s = zoom.scale
  const ax = a.x / 100
  const ay = a.y / 100
  const cx = clamp(0.5, 1 - s * r * (1 - ax), s * r * ax)
  const cy = clamp(0.5, 1 - s * (1 - ay), s * ay)
  const x0 = (1 - r) / 2 + ax * r
  return {
    r,
    focus: { x: cx * 100, y: cy * 100 },
    transform: `translate(${((cx - x0) / r) * 100}%, ${(cy - ay) * 100}%) scale(${s})`,
    origin: `${a.x}% ${a.y}%`,
  }
}

// The captured still of the whole build. Unzoomed it carries the overlay
// (static anchors); zoomed on one part it shows only that part's dot and the
// children as its callout. `frame` is the frame's aspect; by default the
// image's own, so the picture fills it.
export default function ShowroomStill({
  parts, ids, hot, setHot, compact, zoom, chip, frame = `${still.width} / ${still.height}`, children,
}) {
  const { r, focus, transform, origin } = layout(frame, zoom)
  const top = focus && focus.y < 50 // callout goes on the far side from the dot
  return (
    <div className="relative w-full overflow-hidden bg-surface" style={{ aspectRatio: frame }}>
      <div
        data-still-box
        className="absolute top-0"
        style={{ width: `${r * 100}%`, height: '100%', left: `${((1 - r) / 2) * 100}%`, transform, transformOrigin: origin }}
      >
        <img src="/img/showroom-pc.webp" alt="" loading="lazy" className="h-full w-full" />
        {!zoom && (
          <ShowroomOverlay parts={parts} ids={ids} anchors={still.anchors} hot={hot} setHot={setHot ?? (() => {})} compact={compact} />
        )}
      </div>

      {focus && (
        <>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
            <polyline
              fill="none" vectorEffect="non-scaling-stroke" className="stroke-brass"
              points={`8,${top ? 86 : 14} ${focus.x},${top ? 86 : 14} ${focus.x},${focus.y}`}
            />
          </svg>
          <span
            data-focus-dot
            className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-brass bg-surface"
            style={{ left: `${focus.x}%`, top: `${focus.y}%` }}
          />
        </>
      )}

      {children && (
        <div className={`absolute left-[4%] max-w-[60%] border bg-surface px-2 py-1.5 ${focus ? 'border-brass' : 'border-line'} ${top ? 'bottom-[6%]' : 'top-[6%]'}`}>
          {children}
        </div>
      )}
      {chip && <span className={`absolute right-[4%] bg-surface px-1 font-mono text-[12px] text-muted ${top ? 'top-3' : 'bottom-3'}`}>{chip}</span>}
    </div>
  )
}
