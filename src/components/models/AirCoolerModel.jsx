import { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { Fan } from './FanUnit'
import { mm, FAN_MM } from '../../lib/pcScale'

// An air tower, drawn at the box partOverrides gives it (world axes, centred on
// the origin): base plate on the CPU, copper heat pipes, a stacked aluminium fin
// array, and a 120 mm fan on the front face. A low-profile cooler is the same
// parts squashed flat, with its fan lying on top.
//
// The fins are ONE instanced mesh — a tower has ~60 of them and the scene draws
// on demand, so 60 meshes would be 60 draw calls on every orbit frame.
const FIN_PITCH_MM = 2.4
const FIN_MM = 0.5
const BASE_MM = 6
const PIPE_RISE_MM = 30 // bare heat pipe between the base and the first fin

const fin = new THREE.BoxGeometry(1, 1, 1)
const pipe = new THREE.CylinderGeometry(1, 1, 1, 12)

function FinStack({ size, from, to, colour }) {
  const ref = useRef()
  const count = Math.max(1, Math.floor((to - from) / mm(FIN_PITCH_MM)))
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    for (let i = 0; i < count; i++) {
      const z = from + (i + 0.5) * ((to - from) / count)
      m.compose(new THREE.Vector3(0, 0, z), new THREE.Quaternion(), new THREE.Vector3(size[0], size[1], mm(FIN_MM)))
      ref.current.setMatrixAt(i, m)
    }
    ref.current.instanceMatrix.needsUpdate = true
  }, [count, from, to, size])
  return (
    <instancedMesh ref={ref} args={[fin, undefined, count]} key={count}>
      <meshStandardMaterial color={colour} metalness={0.85} roughness={0.35} />
    </instancedMesh>
  )
}

export default function AirCoolerModel({ part, size, lowProfile, fanMm = 0 }) {
  const [sx, sy, sz] = size
  const black = /black|dark/i.test(part?.name ?? '')
  const finColour = black ? '#1c1d21' : '#c9ccd2'
  const fan = mm(fanMm)
  // Fins sit over the socket; the fan hangs on their front (+X) face.
  const finsX = -fan / 2
  const finsW = sx - fan
  const bottom = -sz / 2
  const finsFrom = bottom + mm(lowProfile ? BASE_MM + 2 : PIPE_RISE_MM)
  const finsTo = lowProfile ? sz / 2 - mm(15) : sz / 2
  const pipeLen = finsTo - bottom
  const pipeXs = [-0.3, -0.1, 0.1, 0.3].map((f) => f * finsW)

  return (
    <group>
      <mesh position={[finsX, 0, bottom + mm(BASE_MM) / 2]}>
        <boxGeometry args={[mm(40), mm(40), mm(BASE_MM)]} />
        <meshStandardMaterial color={black ? '#222' : '#b87333'} metalness={0.9} roughness={0.3} />
      </mesh>
      <group position={[finsX, 0, 0]}>
        {pipeXs.map((x) => (
          <mesh key={x} geometry={pipe} position={[x, 0, bottom + pipeLen / 2]} rotation={[Math.PI / 2, 0, 0]}
            scale={[mm(3), pipeLen, mm(3)]}>
            <meshStandardMaterial color={black ? '#2a2a2e' : '#b87333'} metalness={0.9} roughness={0.25} />
          </mesh>
        ))}
        <FinStack size={[finsW, sy]} from={finsFrom} to={finsTo} colour={finColour} />
      </group>
      {lowProfile ? (
        // 92 mm fan lying on the fins, blowing down onto them.
        <group position={[0, 0, sz / 2 - mm(7)]} scale={[sx / mm(FAN_MM), sy / mm(FAN_MM), 14 / 25]}>
          <Fan />
        </group>
      ) : (
        // Centred on the fins, but never above the top fin — a short (125 mm)
        // tower's fin span is less than the fan's 120 mm.
        <group position={[sx / 2 - fan / 2, 0, Math.min((finsFrom + finsTo) / 2, sz / 2 - mm(FAN_MM) / 2)]}
          rotation={[0, Math.PI / 2, 0]}>
          <Fan />
        </group>
      )}
    </group>
  )
}
