import * as THREE from 'three'
import { cableRoutes, atxConnector, pcieConnector } from '../lib/cableRoutes'
import { partBox, boardFaceZ, caseInterior } from '../lib/assemblyGeometry'
import { FAN_MOUNTS } from '../lib/fanMounts'
import { mm, FAN_MM } from '../lib/pcScale'

const FULL = { motherboard: {}, psu: {}, gpu: {} }

// Sample the curve the renderer actually draws, not the control points. A
// CatmullRom bows away from its controls, so control points that all sit clear
// of a part prove nothing about the tube between them — which is how the old
// harness ran through the graphics card while every typed coordinate looked
// plausible on its own.
const sample = (route, n = 300) =>
  new THREE.CatmullRomCurve3(route.points.map((p) => new THREE.Vector3(...p))).getPoints(n)

const routeById = (id, parts = FULL) => cableRoutes(parts).find((r) => r.id === id)

// How far a point sits inside a box; 0 when it is outside or on the surface.
const penetration = (p, box) => {
  const v = [p.x, p.y, p.z]
  let depth = Infinity
  for (let i = 0; i < 3; i++) {
    depth = Math.min(depth, Math.min(v[i] - box.min[i], box.max[i] - v[i]))
  }
  return Math.max(0, depth)
}

// A cable that lands ON a connector legitimately touches the part it plugs into,
// so the guard is against passing THROUGH one. Millimetres, not zero.
const TOUCH_MM = 4

describe('cableRoutes', () => {
  it('draws nothing without a board or a PSU to run between', () => {
    expect(cableRoutes({})).toEqual([])
    expect(cableRoutes({ motherboard: {} })).toEqual([])
    expect(cableRoutes({ psu: {} })).toEqual([])
  })

  it('omits the PCIe lead when there is no card to power', () => {
    const ids = cableRoutes({ motherboard: {}, psu: {} }).map((r) => r.id)
    expect(ids).toEqual(['atx'])
  })
})

describe('connectors sit where a real board and card put them', () => {
  it('puts the 24-pin on the board, at its front edge and proud of the PCB', () => {
    const board = partBox('motherboard')
    const [x, y, z] = atxConnector()
    expect(x).toBeLessThan(board.max[0])
    expect(x).toBeGreaterThan(board.max[0] - mm(30))
    expect(y).toBeGreaterThan(board.min[1])
    expect(y).toBeLessThan(board.max[1])
    expect(z).toBeGreaterThan(boardFaceZ())
  })

  // Measured from the mesh's own `12_pin` node rather than guessed at from the
  // bounding box. The guess put it on the card's upper face — 34 mm from any
  // actual socket, which is why the lead ended in mid-air.
  it('puts the PCIe plug on the card\'s own power inlet', () => {
    const gpu = partBox('gpu')
    const [x, y, z] = pcieConnector()
    expect(x).toBeGreaterThan(gpu.min[0])
    expect(x).toBeLessThan(gpu.max[0])
    expect(y).toBeGreaterThan(gpu.min[1])
    expect(y).toBeLessThan(gpu.max[1])
    // On this card the socket is on the outer edge, facing the side window.
    expect(z).toBeLessThan(gpu.max[2])
    expect(gpu.max[2] - z).toBeLessThan(mm(20))
  })
})

describe('every cable reaches what it claims to power', () => {
  it('runs the 24-pin from inside the PSU to the board connector', () => {
    const route = routeById('atx')
    const pts = sample(route)
    // Starts inside the unit, with a socket body straddling the face it comes
    // out of. Either alone left the loom looking like it merely passed the PSU.
    expect(penetration(pts[0], partBox('psu'))).toBeGreaterThan(0)
    expect(route.socket.position[0]).toBeCloseTo(partBox('psu').max[0], 6)
    const end = pts[pts.length - 1]
    const target = atxConnector()
    expect(end.distanceTo(new THREE.Vector3(...target))).toBeLessThan(mm(1))
  })

  it('runs the PCIe lead from inside the PSU onto the card\'s inlet', () => {
    const route = routeById('pcie')
    const pts = sample(route)
    // Starts inside the unit, with a socket body straddling the face it comes
    // out of. Either alone left the loom looking like it merely passed the PSU.
    expect(penetration(pts[0], partBox('psu'))).toBeGreaterThan(0)
    expect(route.socket.position[0]).toBeCloseTo(partBox('psu').max[0], 6)
    // Lands ON the socket rather than floating near it, which is where the old
    // harness stopped — 34 mm short, below the card, connected to nothing.
    const end = pts[pts.length - 1]
    expect(end.distanceTo(new THREE.Vector3(...pcieConnector()))).toBeLessThan(mm(1))
  })
})

describe('no cable runs through a part', () => {
  // The cooler is excluded for the same reason assemblyNoOverlap excludes it:
  // it is an L of pump block, tubes and radiator, so its bounding box encloses
  // a large volume of air. The 24-pin connector itself lies inside that box.
  for (const id of ['atx', 'pcie']) {
    it(`${id} clears the graphics card`, () => {
      const gpu = partBox('gpu')
      const inlet = new THREE.Vector3(...pcieConnector())
      for (const p of sample(routeById(id))) {
        // The card's power socket is recessed inside its outer edge, so the
        // final stretch of the PCIe lead legitimately enters the card — that is
        // the plug going in. Everything up to it has to stay clear.
        if (p.distanceTo(inlet) < mm(30)) continue
        expect(penetration(p, gpu)).toBeLessThan(mm(TOUCH_MM))
      }
    })

    it(`${id} clears the motherboard and the RAM`, () => {
      for (const p of sample(routeById(id))) {
        expect(penetration(p, partBox('motherboard'))).toBeLessThan(mm(TOUCH_MM))
        expect(penetration(p, partBox('ram'))).toBeLessThan(mm(TOUCH_MM))
      }
    })

    // The lane runs up the front of the case, so it passes the intake column.
    // If a longer card ever squeezes that channel shut this is what says so.
    it(`${id} clears the intake fans`, () => {
      const half = mm(FAN_MM) / 2
      // The tube's own radius counts: the centreline clearing a blade is not
      // the same as the cable clearing it.
      const thickHalf = mm(12.5) + mm(routeById(id).radiusMm)
      for (const p of sample(routeById(id))) {
        for (const mount of FAN_MOUNTS) {
          const [mx, my, mz] = mount.position
          // Mounts sit on end walls, so the frame's thin axis is X.
          const clear =
            Math.abs(p.x - mx) > thickHalf ||
            Math.abs(p.y - my) > half ||
            Math.abs(p.z - mz) > half
          expect(clear, `${id} at ${p.x},${p.y},${p.z} vs fan ${mx},${my},${mz}`).toBe(true)
        }
      }
    })

    it(`${id} stays inside the case`, () => {
      const inner = caseInterior()
      for (const p of sample(routeById(id))) {
        for (const [i, v] of [p.x, p.y, p.z].entries()) {
          expect(v).toBeGreaterThanOrEqual(inner.min[i] - 1e-6)
          expect(v).toBeLessThanOrEqual(inner.max[i] + 1e-6)
        }
      }
    })
  }
})
