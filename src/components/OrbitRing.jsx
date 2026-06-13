import { useRef, useLayoutEffect, useState } from 'react'
import { CATEGORIES } from './CategoryPicker'

export default function OrbitRing({ selectedParts, onSelectCategory }) {
  const containerRef = useRef(null)
  const [size, setSize] = useState({ w: 800, h: 600 })

  useLayoutEffect(() => {
    function update() {
      if (containerRef.current)
        setSize({ w: containerRef.current.offsetWidth, h: containerRef.current.offsetHeight })
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const unselected = CATEGORIES.filter((c) => !selectedParts[c.id])
  const cx = size.w / 2
  const cy = size.h / 2
  const radius = Math.min(size.w, size.h) * 0.38

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none">
      <svg width={size.w} height={size.h} className="absolute inset-0">
        {unselected.map((cat, i) => {
          const angle = (i / unselected.length) * 2 * Math.PI - Math.PI / 2
          const x = cx + radius * Math.cos(angle)
          const y = cy + radius * Math.sin(angle)
          return (
            <line
              key={cat.id}
              x1={cx} y1={cy} x2={x} y2={y}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth={1}
            />
          )
        })}
      </svg>
      {unselected.map((cat, i) => {
        const angle = (i / unselected.length) * 2 * Math.PI - Math.PI / 2
        const x = cx + radius * Math.cos(angle)
        const y = cy + radius * Math.sin(angle)
        return (
          <button
            key={cat.id}
            onClick={() => onSelectCategory(cat.id)}
            style={{ left: x - 40, top: y - 18, pointerEvents: 'auto' }}
            className="absolute bg-gray-800 hover:bg-gray-700 border border-gray-600 hover:border-blue-500 text-white text-xs font-medium px-3 py-1.5 rounded-full transition-all whitespace-nowrap"
          >
            {cat.icon} {cat.label}
          </button>
        )
      })}
    </div>
  )
}
