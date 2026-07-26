// Workbench backdrop: the neutral-dark ground, a whisper of warm accent glow
// off-centre, a faint dot-grid for technical texture, and an edge vignette that
// settles to near-black. Fills its nearest positioned ancestor and sits behind
// sibling content. Deliberately restrained — the accent stays a hint, not a wash.
export default function Backdrop() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-ground" />
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 58% 52% at 50% 42%, rgba(242,107,58,0.07), rgba(15,17,20,0) 70%)' }}
      />
      <div
        className="absolute inset-0 opacity-[0.10]"
        style={{
          backgroundImage: 'radial-gradient(rgba(153,160,171,0.5) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 120% 105% at 50% 50%, rgba(9,11,14,0) 56%, rgba(9,11,14,0.72) 100%)' }}
      />
    </div>
  )
}
