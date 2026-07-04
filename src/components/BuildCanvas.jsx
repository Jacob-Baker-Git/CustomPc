import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'
import PartModel from './PartModel'
import ScreenTracker from './ScreenTracker'
import CableHarness from './models/CableHarness'
import FanSystem from './FanSystem'

export default function BuildCanvas({ selectedParts }) {
  const parts = Object.values(selectedParts).filter(Boolean)

  return (
    <div className="w-full h-full">
      <Canvas camera={{ position: [1.7, 1.05, 5.6], fov: 46 }}>
        <ambientLight intensity={0.95} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        {/* Front key light (no distance falloff) so the build reads clearly
            through the glass window in solid mode. */}
        <directionalLight position={[2, 2, 8]} intensity={1.4} />
        <Environment preset="city" />
        {parts.map((part) => (
          <PartModel key={part.id} part={part} selectedParts={selectedParts} />
        ))}
        <CableHarness selectedParts={selectedParts} />
        {selectedParts.case && selectedParts.motherboard && (
          <FanSystem filled={Boolean(selectedParts.fans)} />
        )}
        <ScreenTracker selectedParts={selectedParts} />
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
