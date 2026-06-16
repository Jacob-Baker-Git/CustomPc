// Shared Industrial Utilitarian backdrop: a deep near-black base, a soft
// slate-cyan radial core, a faint HUD dot-grid for technical texture, and an
// edge vignette that drops to black. Fills its nearest positioned ancestor and
// sits behind sibling content.
export default function Backdrop() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-[#05080f]" />
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 60% 55% at 50% 44%, rgba(34,128,170,0.20), rgba(5,8,15,0) 72%)' }}
      />
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage: 'radial-gradient(rgba(148,163,184,0.55) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 120% 105% at 50% 50%, rgba(2,6,18,0) 58%, rgba(2,6,18,0.7) 100%)' }}
      />
    </div>
  )
}
