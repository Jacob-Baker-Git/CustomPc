import { useMemo } from 'react'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'

// Loads a GLTF/GLB part and normalises it: the model is re-centred on the origin
// and uniformly scaled so its largest dimension equals `targetSize` (world
// units). This lets us drop in models of unknown native scale/pivot and have
// them land at a predictable size in the assembly.
//
// Takes NO rotation on purpose. Orientation is owned entirely by PartModel's
// placement group, which wraps this and must rotate the procedural fallback and
// hover highlight too. Accepting a rotation here once meant every GLB got its
// spec rotation applied twice — see gltfModels.js and assemblyRenderRotation.test.js.
export default function GltfPart({ url, targetSize = 2, position = [0, 0, 0] }) {
  const { scene } = useGLTF(url)

  const { object, scale } = useMemo(() => {
    const obj = scene.clone(true)
    obj.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(obj)
    const size = new THREE.Vector3()
    box.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z) || 1

    // Always centre on the bounding box. Connector alignment — mounting the AIO
    // by its pump block rather than its middle — is handled analytically in
    // assemblyGeometry via each spec's anchorOffset/anchorSize, NOT here.
    // Deliberate: the geometry module is the oracle for part placement because
    // the rendered canvas cannot be inspected on some machines, and it can only
    // predict placement if it never depends on inspecting a loaded mesh.
    // Re-centring on a named node here would double-apply that offset.
    const centre = new THREE.Vector3()
    box.getCenter(centre)

    obj.position.sub(centre)
    return { object: obj, scale: targetSize / maxDim }
  }, [scene, targetSize])

  return (
    <group position={position}>
      <group scale={scale}>
        <primitive object={object} />
      </group>
    </group>
  )
}
