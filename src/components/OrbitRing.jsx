import { useRef, useLayoutEffect, useState, useEffect } from 'react'
import { CATEGORIES } from '../lib/categories'
import { RECOMMENDED_ORDER, nextRecommended } from '../lib/recommendedOrder'
import { partScreenPositions } from '../lib/partScreenPositions'

const ORDERED = RECOMMENDED_ORDER
  .map((id) => CATEGORIES.find((c) => c.id === id))
  .filter(Boolean)

export default function OrbitRing({ selectedParts, onSelectCategory, onDeselect }) {
  const containerRef = useRef(null)
  const [size, setSize] = useState({ w: 800, h: 600 })
  const lineRefs = useRef({})
  const geomRef = useRef({ cx: 400, cy: 300 })

  useLayoutEffect(() => {
    function update() {
      if (containerRef.current)
        setSize({ w: containerRef.current.offsetWidth, h: containerRef.current.offsetHeight })
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const cx = size.w / 2
  const cy = size.h / 2
  const radius = Math.min(size.w, size.h) * 0.40
  geomRef.current = { cx, cy }

  const next = nextRecommended(selectedParts)

  const slots = ORDERED.map((cat, i) => {
    const angle = (i / ORDERED.length) * 2 * Math.PI - Math.PI / 2
    return { cat, x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle), order: i + 1 }
  })

  // Every frame, aim each filled slot's line endpoint at its part's live screen
  // position; empty slots keep the endpoint at the center.
  useEffect(() => {
    let raf
    function tick() {
      const { cx, cy } = geomRef.current
      for (const cat of ORDERED) {
        const line = lineRefs.current[cat.id]
        if (!line) continue
        const tracked = selectedParts[cat.id] ? partScreenPositions.positions[cat.id] : null
        line.setAttribute('x1', tracked ? tracked.x : cx)
        line.setAttribute('y1', tracked ? tracked.y : cy)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [selectedParts])

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none">
      <svg width={size.w} height={size.h} className="absolute inset-0">
        {slots.map(({ cat, x, y }) => {
          const selected = Boolean(selectedParts[cat.id])
          return (
            <line
              key={cat.id}
              ref={(el) => { lineRefs.current[cat.id] = el }}
              x1={cx} y1={cy} x2={x} y2={y}
              stroke={selected ? 'rgba(96,165,250,0.55)' : 'rgba(255,255,255,0.12)'}
              strokeWidth={selected ? 1.5 : 1}
            />
          )
        })}
      </svg>
      {slots.map(({ cat, x, y, order }) => {
        const part = selectedParts[cat.id]
        const isNext = cat.id === next
        return (
          <div
            key={cat.id}
            style={{ left: x, top: y, pointerEvents: 'auto' }}
            className="absolute -translate-x-1/2 -translate-y-1/2"
          >
            {part ? (
              <div className={`flex items-center gap-1 rounded-full border bg-gray-800/95 pl-2 pr-1 py-1 transition-all
                ${isNext ? 'border-blue-400' : 'border-blue-500/60'}`}>
                <button
                  onClick={() => onSelectCategory(cat.id)}
                  className="flex items-center gap-1 text-white text-xs font-medium whitespace-nowrap hover:text-blue-300"
                  title={part.name}
                >
                  <span>{cat.icon}</span>
                  <span className="max-w-[120px] truncate">{part.name}</span>
                  <span className="text-blue-300">£{part.price.toFixed(0)}</span>
                </button>
                <button
                  onClick={() => onDeselect(cat.id)}
                  aria-label={`Remove ${cat.label}`}
                  className="ml-0.5 w-5 h-5 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-red-500/80 text-sm leading-none"
                >
                  &times;
                </button>
              </div>
            ) : (
              <button
                onClick={() => onSelectCategory(cat.id)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all
                  ${isNext
                    ? 'border-blue-400 bg-blue-500/20 text-blue-200 ring-2 ring-blue-400/60 animate-pulse'
                    : 'border-gray-600 bg-gray-800 text-gray-200 hover:border-gray-400 hover:bg-gray-700'}`}
              >
                <span className="flex items-center justify-center w-4 h-4 rounded-full bg-gray-700 text-[10px] text-gray-300">{order}</span>
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
