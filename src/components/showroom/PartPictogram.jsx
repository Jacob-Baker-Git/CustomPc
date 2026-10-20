import CategoryIcon from '../../lib/categoryIcons.jsx'

const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.25, strokeLinecap: 'round', strokeLinejoin: 'round' }

const DRAWINGS = {
  cpu: <><rect x="7" y="7" width="18" height="18" {...s} /><rect x="11" y="11" width="10" height="10" {...s} />{[11, 16, 21].map((n) => <path key={n} d={`M${n} 3v4M${n} 25v4M3 ${n}h4M25 ${n}h4`} {...s} />)}</>,
  gpu: <><rect x="2" y="9" width="28" height="13" {...s} /><circle cx="11" cy="15.5" r="4" {...s} /><circle cx="21" cy="15.5" r="4" {...s} /><path d="M5 22v3h12v-3" {...s} /></>,
  motherboard: <><rect x="5" y="3" width="22" height="26" {...s} /><rect x="9" y="7" width="8" height="8" {...s} /><path d="M21 7v10M23.5 7v10M9 20h14M9 24h10" {...s} /></>,
  ram: <><path d="M3 10h26v10H3z M7 20v3M11 20v3M15 20v3M19 20v3M23 20v3" {...s} /><path d="M7 13h4v4H7zM14 13h4v4h-4zM21 13h4v4h-4z" {...s} /></>,
  storage: <><rect x="3" y="11" width="26" height="10" {...s} /><path d="M7 14h6v4H7zM16 14h4v4h-4z M26 14v4" {...s} /></>,
  psu: <><rect x="3" y="7" width="26" height="18" {...s} /><circle cx="12" cy="16" r="6" {...s} /><path d="M12 10v12M6 16h12M22 11h4M22 14h4" {...s} /></>,
  case: <><rect x="8" y="2" width="16" height="28" {...s} /><path d="M12 6h8M12 26h2M8 10h16" {...s} /><circle cx="16" cy="18" r="4" {...s} /></>,
  cooler: <><path d="M6 6h20M6 9h20M6 12h20M6 15h20M6 18h20" {...s} /><path d="M12 18v8h8v-8M10 26h12" {...s} /></>,
  fans: <><rect x="4" y="4" width="24" height="24" {...s} /><circle cx="16" cy="16" r="9" {...s} /><path d="M16 16c0-4 2-6 4-6M16 16c-4 0-6-2-6-4M16 16c0 4-2 6-4 6M16 16c4 0 6 2 6 4" {...s} /></>,
  // Syringe: barrel, plunger, needle, and a drop.
  paste: <><rect x="6" y="11" width="14" height="7" {...s} /><path d="M20 14.5h6M3 14.5h3M3 11v7M11 11v7M16 11v7" {...s} /><path d="M26 21c-1.5 2-2.5 3.2-2.5 4.4a2.5 2.5 0 0 0 5 0c0-1.2-1-2.4-2.5-4.4z" {...s} /></>,
}

export default function PartPictogram({ id, className = '' }) {
  const drawing = DRAWINGS[id]
  // A caller colour replaces the muted default rather than competing with it
  // in the same class list, where CSS order would pick the winner.
  const tone = /(^| )text-/.test(className) ? '' : 'text-muted'
  if (!drawing) return <CategoryIcon id={id} size={28} className={`${tone} ${className}`} />
  return (
    <svg viewBox="0 0 32 32" className={`h-7 w-7 shrink-0 ${tone} ${className}`} aria-hidden="true">
      {drawing}
    </svg>
  )
}
