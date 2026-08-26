import InfoBadge from './InfoBadge'

const TEXT =
  "This 3D view is a stylised approximation to help you picture the build. Your actual PC won't look exactly like this."

// The "ⓘ" badge over the 3D viewport, revealing the disclaimer on hover (title)
// or click (popover). Positioned relative to the canvas container it sits in.
//
// `floating` gives it an opaque chip and a larger hit target, because it lands
// on a busy WebGL canvas rather than beside a line of text. The colour is not
// its own decision any more: it shares InfoBadge with ScoreInfo, which is what
// stops the two ⓘ badges on the build page disagreeing about what an ⓘ is.
export default function InfoDisclaimer() {
  return (
    <div className="absolute top-3 right-3 z-40">
      <InfoBadge label={TEXT} align="right" floating width="w-64">
        {TEXT}
        <p className="mt-2">
          {/* CC BY 4.0 attribution for the part models lives on the Help page. */}
          <a href="/help" className="text-brass hover:underline">3D model credits</a>
        </p>
      </InfoBadge>
    </div>
  )
}
