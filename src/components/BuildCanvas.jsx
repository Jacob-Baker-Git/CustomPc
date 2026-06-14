import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'
import PartModel from './PartModel'

export default function BuildCanvas({ selectedParts }) {
  const parts = Object.values(selectedParts).filter(Boolean)

  return (
    <div className="w-full h-full">
      <Canvas camera={{ position: [3.5, 2.5, 4.5], fov: 50 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <Environment preset="city" />
        {parts.map((part) => (
          <PartModel key={part.id} part={part} selectedParts={selectedParts} />
        ))}
        <OrbitControls enablePan={false} enableZoom dampingFactor={0.05} enableDamping />
      </Canvas>
    </div>
  )
}
