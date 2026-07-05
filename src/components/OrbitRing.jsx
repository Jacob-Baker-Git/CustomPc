import { useRef, useLayoutEffect, useState, useEffect } from 'react'
import { CATEGORIES } from '../lib/categories'
import CategoryIcon from '../lib/categoryIcons'
import { RECOMMENDED_ORDER, nextRecommended } from '../lib/recommendedOrder'
import { partScreenPositions } from '../lib/partScreenPositions'
import { orbitRadii } from '../lib/orbitGeometry'
import useBuilderStore from '../store/useBuilderStore'

const ORDERED = RECOMMENDED_ORDER
  .map((id) => CATEGORIES.find((c) => c.id === id))
  .filter(Boolean)

export default function OrbitRing({ selectedParts, onSelectCategory, onDeselect }) {
  const containerRef = useRef(null)
  const [size, setSize] = useState({ w: 800, h: 600 })
  const [hoveredCat, setHoveredCat] = useState(null)
  const setHoveredCategory = useBuilderStore((s) => s.setHoveredCategory)
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
  const { rx, ry } = orbitRadii(size.w, size.h)

  useEffect(() => {
    geomRef.current = { cx, cy }
  })

  const next = nextRecommended(selectedParts)

  const slots = ORDERED.map((cat, i) => {
    const angle = (i / ORDERED.length) * 2 * Math.PI - Math.PI / 2
    return { cat, x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle), order: i + 1 }
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
        {/* Faint orbital guide path the pills sit on */}
        <ellipse
          cx={cx} cy={cy} rx={rx} ry={ry}
          fill="none"
          stroke="rgba(56,189,248,0.18)"
          strokeWidth="1"
          strokeDasharray="2 6"
        />
        {slots.map(({ cat, x, y }) => (
          <line
            key={cat.id}
            data-cat={cat.id}
            ref={(el) => { lineRefs.current[cat.id] = el }}
            x1={cx} y1={cy} x2={x} y2={y}
            stroke="rgba(56,189,248,0.6)"
            strokeWidth="1"
            className={`transition-opacity duration-300 ${hoveredCat === cat.id ? 'opacity-100' : 'opacity-0'}`}
          />
        ))}
      </svg>
      {slots.map(({ cat, x, y, order }) => {
        const part = selectedParts[cat.id]
        const isNext = cat.id === next
        const far = y < cy - 1 // upper/back arc → slight depth dim
        return (
          <div
            key={cat.id}
            data-pill={cat.id}
            onMouseEnter={() => { setHoveredCat(cat.id); setHoveredCategory(cat.id) }}
            onMouseLeave={() => { setHoveredCat(null); setHoveredCategory(null) }}
            style={{ left: x, top: y, pointerEvents: 'auto' }}
            className={`absolute -translate-x-1/2 -translate-y-1/2 transition-opacity ${far ? 'opacity-70 hover:opacity-100' : ''}`}
          >
            {part ? (
              <div className={`flex items-center gap-1.5 rounded-sm border bg-slate-950/70 backdrop-blur-sm pl-1.5 pr-1 py-1 transition-all
                ${isNext ? 'border-cyan-400' : 'border-slate-700/70'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isNext ? 'bg-cyan-300' : 'bg-cyan-400/70'}`} />
                <button
                  onClick={() => onSelectCategory(cat.id)}
                  className="flex items-center gap-1.5 text-slate-100 text-xs whitespace-nowrap hover:text-cyan-300"
                  title={part.name}
                >
                  <CategoryIcon id={cat.id} size={12} className="text-slate-400" />
                  <span className="max-w-[120px] truncate">{part.name}</span>
                  <span className="font-mono text-cyan-300">£{part.price.toFixed(0)}</span>
                </button>
                <button
                  onClick={() => onDeselect(cat.id)}
                  aria-label={`Remove ${cat.label}`}
                  className="ml-0.5 w-5 h-5 flex items-center justify-center rounded-sm text-slate-400 hover:text-white hover:bg-red-500/80 text-sm leading-none"
                >
                  &times;
                </button>
              </div>
            ) : (
              <button
                onClick={() => onSelectCategory(cat.id)}
                className={`flex items-center gap-1.5 rounded-sm border px-2.5 py-1.5 text-xs whitespace-nowrap transition-all
                  ${isNext
                    ? 'border-cyan-400 bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-400/50 motion-safe:animate-pulse'
                    : 'border-slate-700/70 bg-slate-950/50 backdrop-blur-sm text-slate-300 hover:border-slate-500 hover:bg-slate-900/70'}`}
              >
                <span className="flex items-center justify-center w-4 h-4 rounded-sm bg-slate-800 text-[10px] font-mono text-slate-300">{order}</span>
                <CategoryIcon id={cat.id} size={12} className="text-slate-400" />
                <span>{cat.label}</span>
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
