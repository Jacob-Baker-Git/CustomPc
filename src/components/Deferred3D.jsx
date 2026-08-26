import { Box } from 'lucide-react'
import { BTN_PRIMARY, TELEMETRY } from '../lib/uiTokens'
import { MODEL_PAYLOAD_MB } from '../lib/modelPayload'

// The 3D view, not loaded yet, on a device where that is a real cost.
//
// Opening the builder pulls the lazy BuildCanvas chunk plus every model for the
// selected parts — 11 MB of GLB, 7.7 of it the motherboard alone. On a desktop
// that is invisible. On a phone on mobile data it is the single largest thing
// the site does, and it happens before the person has asked for it.
//
// ⚠️ This is a DEFERRAL, not a downgrade, and the distinction is the whole
// design. The site's promise is "build and price a gaming PC in 3D" — hiding
// that on half its traffic would be answering a data problem by deleting the
// feature. So the panel keeps its size and its frame, says plainly what is
// behind it and what it costs, and loads the real thing on one tap.
//
// Shrinking the payload instead was investigated and declined: motherboard.glb
// is a triangle soup that floors at 57% of its triangles under decimation, and
// its textures are only 7% of the file. The lever that remains is WHEN it
// loads, not how big it is.
export default function Deferred3D({ onLoad }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
      <Box size={28} className="text-brass" aria-hidden="true" />
      <div>
        <div className="text-ink font-semibold">See this build in 3D</div>
        <p className="text-muted text-sm mt-1 max-w-xs">
          Rotate the case and look at how the parts actually fit together.
        </p>
      </div>
      <button onClick={onLoad} className={`${BTN_PRIMARY} px-4 py-2 rounded-lg text-sm transition-colors`}>
        View in 3D
      </button>
      {/* The number is the point of the whole screen, so it is stated rather
          than implied — and it comes from a constant that a test keeps honest
          against the actual files. See src/lib/modelPayload.js. */}
      <p className="text-faint text-xs">
        Downloads about <span className={TELEMETRY}>{MODEL_PAYLOAD_MB}</span> MB of models
      </p>
    </div>
  )
}
