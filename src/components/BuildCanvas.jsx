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

export default function BuildCanvas({ selectedParts }) {
  const parts = Object.values(selectedParts).filter(Boolean)

  return (
    <div className="w-full h-full">
      <Canvas
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
        {/* Interior fill so solid-case parts still read through the glass. */}
        <pointLight position={[0, 0.4, 0.55]} intensity={3.6} distance={5} decay={1.6} />

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
            floating in a void. Sits just under the case floor (y ≈ -1.85). */}
        <ContactShadows
          position={[CENTRE_X, -1.92, 0]}
          scale={11}
          far={4.2}
          blur={2.8}
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
