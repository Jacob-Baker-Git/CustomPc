import { useMemo } from 'react'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'

// Loads a GLTF/GLB part and normalises it: the model is re-centred on the origin
// and scaled so it lands at a predictable size in the assembly, whatever its
// native scale and pivot.
//
// `targetSize` is a number for a uniform fit (largest dimension → that size), or
// an [x, y, z] triple in the model's own axes for a per-axis fit. The triple is
// for meshes whose proportions are not the real component's — the PSU mesh is
// near-cubic where a real ATX unit is 150x86x160, so no uniform scale can be
// right on more than one axis. assemblyGeometry decides which; see PART_SPECS.
//
// Takes NO rotation on purpose. Orientation is owned entirely by PartModel's
// placement group, which wraps this and must rotate the procedural fallback and
// hover highlight too. Accepting a rotation here once meant every GLB got its
// spec rotation applied twice — see gltfModels.js and assemblyRenderRotation.test.js.
export default function GltfPart({ url, targetSize = 2, position = [0, 0, 0], hideNodes }) {
  const { scene } = useGLTF(url)

  const { object, scale } = useMemo(() => {
    const obj = scene.clone(true)
    obj.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(obj)
    const size = new THREE.Vector3()
    box.getSize(size)
    const nz = (v) => (v > 1e-9 ? v : 1)
    const fit = Array.isArray(targetSize)
      ? [targetSize[0] / nz(size.x), targetSize[1] / nz(size.y), targetSize[2] / nz(size.z)]
      : targetSize / (Math.max(size.x, size.y, size.z) || 1)

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

    // Strictly AFTER the box above: `raw` in PART_SPECS is the whole mesh's
    // bounding box, so the fit has to be measured on the whole mesh or the scale
    // silently stops matching the geometry. Hiding here only removes geometry
    // that draws no real component — the board's stray Object_197 sheet. A test
    // pins that every name listed still resolves, because a name that matches
    // nothing would fail silently.
    if (hideNodes?.length) {
      const wanted = new Set(hideNodes)
      obj.traverse((child) => {
        if (wanted.has(child.name)) child.visible = false
      })
    }

    return { object: obj, scale: fit }
  }, [scene, targetSize, hideNodes])

  return (
    <group position={position}>
      <group scale={scale}>
        <primitive object={object} />
      </group>
    </group>
  )
}
