import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'
import PartModel from './PartModel'
import CableHarness from './models/CableHarness'
import FanSystem from './FanSystem'

export default function BuildCanvas({ selectedParts }) {
  const parts = Object.values(selectedParts).filter(Boolean)

  return (
    <div className="w-full h-full">
      <Canvas camera={{ position: [1.7, 1.05, 5.6], fov: 46 }}>
        <ambientLight intensity={1.15} />
        <directionalLight position={[5, 5, 5]} intensity={1.1} />
        {/* Front key light (no distance falloff) so the build reads clearly
            through the glass window in solid mode. */}
        <directionalLight position={[2, 2, 8]} intensity={1.7} />
        {/* Interior fill so parts inside the solid case don't read as black. */}
        <pointLight position={[0, 0.4, 0.55]} intensity={5} distance={5} decay={1.6} />
        {/* Bundled locally (public/hdri) so lighting doesn't depend on a CDN. */}
        <Environment files="/hdri/city.hdr" />
        {parts.map((part) => (
          <PartModel key={part.id} part={part} selectedParts={selectedParts} />
        ))}
        <CableHarness selectedParts={selectedParts} />
        {selectedParts.case && selectedParts.motherboard && (
          <FanSystem filled={Boolean(selectedParts.fans)} />
        )}
        <OrbitControls
          target={[0, -0.1, 0.05]}
          enablePan={false}
          enableZoom
          minDistance={3}
          maxDistance={9}
          dampingFactor={0.05}
          enableDamping
        />
      </Canvas>
    </div>
  )
}
