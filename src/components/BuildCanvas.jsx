import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'
import PartModel from './PartModel'
import ScreenTracker from './ScreenTracker'
import CableHarness from './models/CableHarness'

export default function BuildCanvas({ selectedParts }) {
  const parts = Object.values(selectedParts).filter(Boolean)

  return (
    <div className="w-full h-full">
      <Canvas camera={{ position: [0.9, 0.5, 6.4], fov: 46 }}>
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
        <ScreenTracker selectedParts={selectedParts} />
        <OrbitControls target={[0, -0.1, 0.2]} enablePan={false} enableZoom dampingFactor={0.05} enableDamping />
      </Canvas>
    </div>
  )
}
