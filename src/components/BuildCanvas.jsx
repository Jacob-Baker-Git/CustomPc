import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei'
import PartModel from './PartModel'
import CableHarness from './models/CableHarness'
import FanSystem from './FanSystem'
import { caseInterior } from '../lib/assemblyGeometry'

// The case is anchored to the board's REAR edge, not centred on the origin, so
// the build's mass sits forward of it. Framing off the interior keeps the tower
// centred instead of drifting to one side of the frame — and keeps doing so if
// the case's depth changes again.
const interior = caseInterior()
const CENTRE_X = (interior.min[0] + interior.max[0]) / 2
// Z and the floor were left on bare constants while X was derived — the exact
// half-anchored shape this scene keeps producing. The contact shadow sat 93 mm
// off the case in Z and 8.3 mm ABOVE the floor, i.e. inside the case, which is
// what smeared a shadow out past the back panel.
const CENTRE_Z = (interior.min[2] + interior.max[2]) / 2
const FLOOR_Y = interior.min[1]

export default function BuildCanvas({ selectedParts }) {
  const parts = Object.values(selectedParts).filter(Boolean)

  return (
    <div className="w-full h-full">
      <Canvas
        // ⚠️ "demand", not r3f's default of "always". Measured before this
        // change: 964 draw calls during five seconds of ABSOLUTE IDLE — 193 a
        // second — on a build nobody was touching. That is a warm phone, a flat
        // battery, and a frame budget spent competing with the page's own
        // scroll and paint.
        //
        // Under demand the scene draws only when something invalidates it.
        // drei's OrbitControls calls invalidate() on its change event, which
        // covers the damping tail after a drag — verified in a browser, because
        // a camera that sticks mid-glide would be a worse bug than the cost
        // this saves.
        frameloop="demand"
        dpr={[1, 2]}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
        // Distance from the orbit target is ~7.2 world units. At fov 46 the
        // visible frame height is 0.849·d, so the 482mm case (3.95 wu at
        // 1 wu = 122 mm) fills ~65% of the frame — it used to be ~78%, which
        // read as starting too zoomed in.
        camera={{ position: [CENTRE_X + 2.05, 1.3, 6.8], fov: 46 }}
      >
        {/* Studio product lighting. The old setup flooded the scene with ambient
            1.15, which washed out all form and shadow (the "cheap render" look).
            Now: low ambient so shape returns, an HDRI for realistic metal/glass
            reflections, a warm key, a cool back-rim for edge separation, a gentle
            front fill so the build reads through the glass, and an interior fill
            so parts inside a solid case don't go black. */}
        <ambientLight intensity={0.32} />
        {/* Bundled locally (public/hdri) so lighting doesn't depend on a CDN. */}
        <Environment files="/hdri/city.hdr" environmentIntensity={0.9} />
        {/* Warm key — upper front-left. */}
        <directionalLight position={[-4, 6, 6]} intensity={2.2} color="#fff2e6" />
        {/* Cool back-rim — carves the silhouette out of the dark ground. */}
        <directionalLight position={[5, 3.5, -6]} intensity={1.5} color="#a9c6ff" />
        {/* Soft front fill through the glass window. */}
        <directionalLight position={[2, 1.5, 8]} intensity={0.8} />
        {/* Interior fill so solid-case parts still read through the glass.
            Anchored to the interior rather than sat on [0, 0.4, 0.55], which was
            91 mm from the AIO's pump block — point-blank for a decay-1.6 light,
            and the reason the pump wore a blown-out white hotspot. From the
            interior's centre it is ~135 mm away, and the intensity drop keeps
            the fill without the glare. */}
        <pointLight
          position={[CENTRE_X, (interior.min[1] + interior.max[1]) / 2, CENTRE_Z]}
          intensity={2.6}
          distance={5}
          decay={1.6}
        />

        {parts.map((part) => (
          <PartModel key={part.id} part={part} />
        ))}
        <CableHarness selectedParts={selectedParts} />
        {/* Fans render at their mount points whenever fans are selected, case or
            not. With a case but no fans, the empty slot outlines show where they
            go — the outlines belong to the case, which is the thing with the
            mounts. Cables stay driven by selectedParts: they only appear when
            both parts they connect are present. */}
        {(selectedParts.fans || selectedParts.case) && (
          <FanSystem filled={Boolean(selectedParts.fans)} />
        )}

        {/* Grounding contact shadow so the build sits on a surface instead of
            floating in a void. Sits just UNDER the floor — at -1.92 the plane
            was 8.3 mm above it, cutting through the case's own base.
            Scale hugs the 380 x 210 mm footprint: at 11 the catcher was 1342 mm
            across, so a blur-2.8 smear reached far out behind the tower and read
            as a stray shadow rather than as contact with the ground. */}
        {/* ⚠️ `frames={1}` bakes the shadow ONCE instead of re-rendering a 512²
            depth pass every frame, which was a large share of what "always" was
            paying for. The `key` is what stops that becoming a stale-shadow
            bug: a changed build remounts this and re-bakes. Without the key the
            shadow would be correct only for whatever parts happened to be
            selected on first paint — a quieter and nastier defect than the cost
            it saves. */}
        <ContactShadows
          key={parts.map((p) => p.id).join('|')}
          frames={1}
          position={[CENTRE_X, FLOOR_Y - 0.005, CENTRE_Z]}
          scale={[4.4, 2.8]}
          far={4.2}
          blur={2.0}
          opacity={0.6}
          resolution={512}
          color="#05070c"
        />

        {/* 2.2–16 rather than 3–9: close enough to inspect one part, far enough
            to see the whole build in its room. WU_PER_MM was originally chosen
            so the old clamps still worked — widening them is deliberate. */}
        <OrbitControls
          target={[CENTRE_X, -0.1, 0.05]}
          enablePan={false}
          enableZoom
          minDistance={2.2}
          maxDistance={16}
          dampingFactor={0.05}
          enableDamping
        />
      </Canvas>
    </div>
  )
}
