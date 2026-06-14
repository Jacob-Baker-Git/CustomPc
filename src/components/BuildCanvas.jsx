import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'
import PartModel from './PartModel'
import ScreenTracker from './ScreenTracker'

export default function BuildCanvas({ selectedParts }) {
  const parts = Object.values(selectedParts).filter(Boolean)

  return (
    <div className="w-full h-full">
      <Canvas camera={{ position: [2.6, 0.8, 7.0], fov: 46 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <Environment preset="city" />
        {parts.map((part) => (
          <PartModel key={part.id} part={part} selectedParts={selectedParts} />
        ))}
        <ScreenTracker selectedParts={selectedParts} />
        <OrbitControls target={[0, -0.1, 0.4]} enablePan={false} enableZoom dampingFactor={0.05} enableDamping />
      </Canvas>
    </div>
  )
}
