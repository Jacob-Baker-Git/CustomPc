# Realistic 3D Part Models Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace placeholder colored-box part geometry with detailed procedural 3D models for all 8 categories, snapping into realistic mount positions around the motherboard.

**Architecture:** A pure `assemblyLayout.js` computes each part's mount transform (motherboard-relative, with fallbacks). Eight focused model components build detailed geometry from Three.js primitives. A registry maps category → component, and `PartModel.jsx` becomes a thin dispatcher that places the right model at the computed transform.

**Tech Stack:** React, React Three Fiber, Three.js, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-13-3d-part-models-design.md`

---

## File Map

| File | Responsibility |
|---|---|
| `src/lib/assemblyLayout.js` | Pure: `assemblyLayout(category, selectedParts) → {position, rotation}` |
| `src/tests/assemblyLayout.test.js` | Unit tests for the positioning logic |
| `src/components/models/MotherboardModel.jsx` | PCB + socket + slots + heatsinks geometry |
| `src/components/models/CpuModel.jsx` | Chip + IHS geometry |
| `src/components/models/CoolerModel.jsx` | Finned tower + fan geometry |
| `src/components/models/RamModel.jsx` | Two sticks with heatspreaders |
| `src/components/models/GpuModel.jsx` | Shroud + fans + backplate |
| `src/components/models/StorageModel.jsx` | M.2 stick + chips |
| `src/components/models/PsuModel.jsx` | Box + fan grille |
| `src/components/models/CaseModel.jsx` | Semi-transparent shell |
| `src/components/models/partModelRegistry.js` | Maps category string → model component |
| `src/components/PartModel.jsx` | Rewritten dispatcher (registry + assemblyLayout) |
| `src/components/BuildCanvas.jsx` | Pass `selectedParts` to PartModel; camera/light tweak |

**Note on environment:** `node`/`npx` are not on PATH. In PowerShell prepend: `$env:Path = "C:\Program Files\nodejs;" + $env:Path` before running `npx ...`.

---

### Task 1: Assembly Layout (TDD)

**Files:**
- Create: `src/lib/assemblyLayout.js`
- Test: `src/tests/assemblyLayout.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/tests/assemblyLayout.test.js`:
```js
import { assemblyLayout } from '../lib/assemblyLayout'

const withMb = { motherboard: { id: 'mb-x' } }

describe('assemblyLayout', () => {
  it('places the motherboard at the origin', () => {
    expect(assemblyLayout('motherboard', withMb).position).toEqual([0, 0, 0])
  })

  it('mounts the cooler above the CPU when a motherboard is present', () => {
    const cpuY = assemblyLayout('cpu', withMb).position[1]
    const coolerY = assemblyLayout('cooler', withMb).position[1]
    expect(coolerY).toBeGreaterThan(cpuY)
  })

  it('mounts the GPU below the board plane (negative Y) when a motherboard is present', () => {
    expect(assemblyLayout('gpu', withMb).position[1]).toBeLessThan(0)
  })

  it('uses a different (fallback) CPU position when no motherboard is selected', () => {
    const mounted = assemblyLayout('cpu', withMb).position
    const fallback = assemblyLayout('cpu', {}).position
    expect(fallback).not.toEqual(mounted)
  })

  it('returns a default transform for an unknown category', () => {
    const t = assemblyLayout('banana', withMb)
    expect(t.position).toEqual([0, 0, 0])
    expect(t.rotation).toEqual([0, 0, 0])
  })

  it('always returns a position and rotation triple', () => {
    for (const cat of ['cpu', 'gpu', 'ram', 'storage', 'psu', 'case', 'cooler', 'motherboard']) {
      const t = assemblyLayout(cat, withMb)
      expect(t.position).toHaveLength(3)
      expect(t.rotation).toHaveLength(3)
    }
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/tests/assemblyLayout.test.js`
Expected: FAIL — "Cannot find module '../lib/assemblyLayout'"

- [ ] **Step 3: Implement the module**

Create `src/lib/assemblyLayout.js`:
```js
// All transforms are relative to the motherboard anchored at the origin.
// The board lies flat: PCB in the XZ plane, components facing up (+Y).

const MOUNTED = {
  motherboard: { position: [0, 0, 0],        rotation: [0, 0, 0] },
  cpu:         { position: [0, 0.09, -0.5],   rotation: [0, 0, 0] },
  cooler:      { position: [0, 0.35, -0.5],   rotation: [0, 0, 0] },
  ram:         { position: [0.75, 0.3, -0.4], rotation: [0, 0, 0] },
  gpu:         { position: [0, -0.25, 0.4],   rotation: [0, 0, 0] },
  storage:     { position: [-0.5, 0.06, 0.2], rotation: [0, 0, 0] },
  psu:         { position: [0, -1.1, -0.6],   rotation: [0, 0, 0] },
  case:        { position: [0, -0.3, 0],      rotation: [0, 0, 0] },
}

// Standalone positions used until a motherboard exists to mount onto.
const FALLBACK = {
  motherboard: [0, 0, 0],
  cpu:     [0, 0, 0],
  cooler:  [0, 1.2, 0],
  ram:     [1.4, 0, 0],
  gpu:     [0, -1.4, 0],
  storage: [-1.4, 0, 0],
  psu:     [0, -2.4, 0],
  case:    [0, 0, 0],
}

const DEFAULT_TRANSFORM = { position: [0, 0, 0], rotation: [0, 0, 0] }

export function assemblyLayout(category, selectedParts = {}) {
  if (category === 'motherboard') return MOUNTED.motherboard

  const hasMotherboard = Boolean(selectedParts && selectedParts.motherboard)
  if (!hasMotherboard) {
    const position = FALLBACK[category]
    return position ? { position, rotation: [0, 0, 0] } : DEFAULT_TRANSFORM
  }

  return MOUNTED[category] ?? DEFAULT_TRANSFORM
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/tests/assemblyLayout.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Run full suite (no regressions)**

Run: `npx vitest run`
Expected: all prior tests still pass (27) + 6 new = 33.

- [ ] **Step 6: Commit**

```bash
git add src/lib/assemblyLayout.js src/tests/assemblyLayout.test.js
git commit -m "feat: add pure assemblyLayout module for realistic part mount positions"
```

---

### Task 2: Dispatcher + Motherboard & CPU Models

**Files:**
- Create: `src/components/models/MotherboardModel.jsx`
- Create: `src/components/models/CpuModel.jsx`
- Create: `src/components/models/partModelRegistry.js`
- Modify: `src/components/PartModel.jsx` (full rewrite)
- Modify: `src/components/BuildCanvas.jsx`

- [ ] **Step 1: Create MotherboardModel**

Create `src/components/models/MotherboardModel.jsx`:
```jsx
export default function MotherboardModel() {
  return (
    <group>
      {/* PCB */}
      <mesh>
        <boxGeometry args={[2.4, 0.06, 2.4]} />
        <meshStandardMaterial color="#0f5132" metalness={0.2} roughness={0.7} />
      </mesh>
      {/* CPU socket */}
      <mesh position={[0, 0.05, -0.5]}>
        <boxGeometry args={[0.55, 0.04, 0.55]} />
        <meshStandardMaterial color="#222" metalness={0.5} roughness={0.5} />
      </mesh>
      {/* RAM slots */}
      {[0.55, 0.7, 0.85, 1.0].map((x) => (
        <mesh key={x} position={[x, 0.05, -0.4]}>
          <boxGeometry args={[0.05, 0.05, 1.0]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
      ))}
      {/* PCIe slot */}
      <mesh position={[0, 0.05, 0.3]}>
        <boxGeometry args={[1.4, 0.05, 0.12]} />
        <meshStandardMaterial color="#3a3a3a" />
      </mesh>
      {/* Chipset heatsink */}
      <mesh position={[0.2, 0.07, 0.7]}>
        <boxGeometry args={[0.5, 0.08, 0.5]} />
        <meshStandardMaterial color="#444" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* Rear I/O shroud */}
      <mesh position={[-0.9, 0.12, -1.0]}>
        <boxGeometry args={[0.5, 0.25, 0.3]} />
        <meshStandardMaterial color="#555" metalness={0.7} roughness={0.4} />
      </mesh>
      {/* 24-pin power connector */}
      <mesh position={[1.1, 0.08, 0.2]}>
        <boxGeometry args={[0.12, 0.1, 0.5]} />
        <meshStandardMaterial color="#eeeeee" />
      </mesh>
    </group>
  )
}
```

- [ ] **Step 2: Create CpuModel**

Create `src/components/models/CpuModel.jsx`:
```jsx
export default function CpuModel() {
  return (
    <group>
      {/* substrate */}
      <mesh>
        <boxGeometry args={[0.5, 0.03, 0.5]} />
        <meshStandardMaterial color="#0b3d2e" />
      </mesh>
      {/* integrated heat spreader (IHS) */}
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[0.38, 0.05, 0.38]} />
        <meshStandardMaterial color="#c0c0c0" metalness={0.9} roughness={0.2} />
      </mesh>
    </group>
  )
}
```

- [ ] **Step 3: Create the registry (mb + cpu for now)**

Create `src/components/models/partModelRegistry.js`:
```js
import MotherboardModel from './MotherboardModel'
import CpuModel from './CpuModel'

export const MODEL_REGISTRY = {
  motherboard: MotherboardModel,
  cpu: CpuModel,
}
```

- [ ] **Step 4: Rewrite PartModel as a dispatcher**

Replace `src/components/PartModel.jsx` entirely with:
```jsx
import { MODEL_REGISTRY } from './models/partModelRegistry'
import { assemblyLayout } from '../lib/assemblyLayout'

export default function PartModel({ part, selectedParts }) {
  const ModelComponent = MODEL_REGISTRY[part.category]
  const { position, rotation } = assemblyLayout(part.category, selectedParts)

  return (
    <group position={position} rotation={rotation}>
      {ModelComponent ? (
        <ModelComponent part={part} />
      ) : (
        <mesh>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshStandardMaterial color="#555" metalness={0.7} roughness={0.3} />
        </mesh>
      )}
    </group>
  )
}
```

- [ ] **Step 5: Update BuildCanvas to pass selectedParts**

In `src/components/BuildCanvas.jsx`, change the parts map so each `PartModel` receives `selectedParts`:
```jsx
        {parts.map((part) => (
          <PartModel key={part.id} part={part} selectedParts={selectedParts} />
        ))}
```
(Leave the rest of the file unchanged.)

- [ ] **Step 6: Verify build + tests**

Run: `npx vite build`
Expected: build succeeds.
Run: `npx vitest run`
Expected: 33 tests pass (no regressions).

- [ ] **Step 7: Commit**

```bash
git add src/components/models/MotherboardModel.jsx src/components/models/CpuModel.jsx src/components/models/partModelRegistry.js src/components/PartModel.jsx src/components/BuildCanvas.jsx
git commit -m "feat: add model dispatcher with detailed motherboard and CPU models"
```

---

### Task 3: Cooler & RAM Models

**Files:**
- Create: `src/components/models/CoolerModel.jsx`
- Create: `src/components/models/RamModel.jsx`
- Modify: `src/components/models/partModelRegistry.js`

- [ ] **Step 1: Create CoolerModel**

Create `src/components/models/CoolerModel.jsx`:
```jsx
export default function CoolerModel() {
  return (
    <group>
      {/* base block over the CPU */}
      <mesh>
        <boxGeometry args={[0.45, 0.1, 0.45]} />
        <meshStandardMaterial color="#888888" metalness={0.9} roughness={0.2} />
      </mesh>
      {/* fin stack */}
      {Array.from({ length: 8 }).map((_, i) => (
        <mesh key={i} position={[0, 0.18 + i * 0.07, 0]}>
          <boxGeometry args={[0.5, 0.02, 0.45]} />
          <meshStandardMaterial color="#bbbbbb" metalness={0.95} roughness={0.15} />
        </mesh>
      ))}
      {/* fan on the front face */}
      <mesh position={[0, 0.45, 0.32]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 0.08, 24]} />
        <meshStandardMaterial color="#222222" metalness={0.4} roughness={0.6} />
      </mesh>
    </group>
  )
}
```

- [ ] **Step 2: Create RamModel**

Create `src/components/models/RamModel.jsx`:
```jsx
export default function RamModel() {
  return (
    <group>
      {[-0.08, 0.08].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          {/* PCB */}
          <mesh>
            <boxGeometry args={[0.04, 0.5, 0.9]} />
            <meshStandardMaterial color="#0b3d2e" />
          </mesh>
          {/* heatspreader */}
          <mesh position={[0, 0.1, 0]}>
            <boxGeometry args={[0.05, 0.35, 0.85]} />
            <meshStandardMaterial color="#b00000" metalness={0.6} roughness={0.4} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
```

- [ ] **Step 3: Add to registry**

Update `src/components/models/partModelRegistry.js` to:
```js
import MotherboardModel from './MotherboardModel'
import CpuModel from './CpuModel'
import CoolerModel from './CoolerModel'
import RamModel from './RamModel'

export const MODEL_REGISTRY = {
  motherboard: MotherboardModel,
  cpu: CpuModel,
  cooler: CoolerModel,
  ram: RamModel,
}
```

- [ ] **Step 4: Verify build + tests**

Run: `npx vite build`
Expected: build succeeds.
Run: `npx vitest run`
Expected: 33 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/models/CoolerModel.jsx src/components/models/RamModel.jsx src/components/models/partModelRegistry.js
git commit -m "feat: add detailed cooler and RAM models"
```

---

### Task 4: GPU & Storage Models

**Files:**
- Create: `src/components/models/GpuModel.jsx`
- Create: `src/components/models/StorageModel.jsx`
- Modify: `src/components/models/partModelRegistry.js`

- [ ] **Step 1: Create GpuModel**

Create `src/components/models/GpuModel.jsx`:
```jsx
export default function GpuModel() {
  return (
    <group>
      {/* shroud body */}
      <mesh>
        <boxGeometry args={[2.0, 0.25, 0.9]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* two fans */}
      {[-0.5, 0.5].map((x) => (
        <mesh key={x} position={[x, 0.14, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.32, 0.32, 0.05, 24]} />
          <meshStandardMaterial color="#333333" />
        </mesh>
      ))}
      {/* backplate */}
      <mesh position={[0, -0.15, 0]}>
        <boxGeometry args={[2.0, 0.03, 0.9]} />
        <meshStandardMaterial color="#444444" metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  )
}
```

- [ ] **Step 2: Create StorageModel**

Create `src/components/models/StorageModel.jsx`:
```jsx
export default function StorageModel() {
  return (
    <group>
      {/* M.2 PCB */}
      <mesh>
        <boxGeometry args={[0.7, 0.03, 0.18]} />
        <meshStandardMaterial color="#0b3d2e" />
      </mesh>
      {/* controller + NAND chips */}
      {[-0.15, 0.15].map((x) => (
        <mesh key={x} position={[x, 0.03, 0]}>
          <boxGeometry args={[0.18, 0.03, 0.14]} />
          <meshStandardMaterial color="#111111" />
        </mesh>
      ))}
    </group>
  )
}
```

- [ ] **Step 3: Add to registry**

Update `src/components/models/partModelRegistry.js` to:
```js
import MotherboardModel from './MotherboardModel'
import CpuModel from './CpuModel'
import CoolerModel from './CoolerModel'
import RamModel from './RamModel'
import GpuModel from './GpuModel'
import StorageModel from './StorageModel'

export const MODEL_REGISTRY = {
  motherboard: MotherboardModel,
  cpu: CpuModel,
  cooler: CoolerModel,
  ram: RamModel,
  gpu: GpuModel,
  storage: StorageModel,
}
```

- [ ] **Step 4: Verify build + tests**

Run: `npx vite build`
Expected: build succeeds.
Run: `npx vitest run`
Expected: 33 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/models/GpuModel.jsx src/components/models/StorageModel.jsx src/components/models/partModelRegistry.js
git commit -m "feat: add detailed GPU and storage models"
```

---

### Task 5: PSU & Case Models

**Files:**
- Create: `src/components/models/PsuModel.jsx`
- Create: `src/components/models/CaseModel.jsx`
- Modify: `src/components/models/partModelRegistry.js`

- [ ] **Step 1: Create PsuModel**

Create `src/components/models/PsuModel.jsx`:
```jsx
export default function PsuModel() {
  return (
    <group>
      {/* PSU box */}
      <mesh>
        <boxGeometry args={[1.0, 0.55, 0.7]} />
        <meshStandardMaterial color="#1c1c1c" metalness={0.7} roughness={0.4} />
      </mesh>
      {/* fan grille on top */}
      <mesh position={[0, 0.28, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.02, 24]} />
        <meshStandardMaterial color="#333333" metalness={0.5} roughness={0.6} />
      </mesh>
    </group>
  )
}
```

- [ ] **Step 2: Create CaseModel**

Create `src/components/models/CaseModel.jsx`:
```jsx
export default function CaseModel() {
  return (
    <group>
      {/* semi-transparent shell */}
      <mesh>
        <boxGeometry args={[3.2, 3.0, 3.2]} />
        <meshStandardMaterial
          color="#88aadd"
          transparent
          opacity={0.12}
          metalness={0.3}
          roughness={0.1}
          side={2}
        />
      </mesh>
      {/* wireframe edges for definition */}
      <mesh>
        <boxGeometry args={[3.2, 3.0, 3.2]} />
        <meshBasicMaterial color="#5577aa" wireframe />
      </mesh>
    </group>
  )
}
```

- [ ] **Step 3: Add to registry (now complete — all 8)**

Update `src/components/models/partModelRegistry.js` to:
```js
import MotherboardModel from './MotherboardModel'
import CpuModel from './CpuModel'
import CoolerModel from './CoolerModel'
import RamModel from './RamModel'
import GpuModel from './GpuModel'
import StorageModel from './StorageModel'
import PsuModel from './PsuModel'
import CaseModel from './CaseModel'

export const MODEL_REGISTRY = {
  motherboard: MotherboardModel,
  cpu: CpuModel,
  cooler: CoolerModel,
  ram: RamModel,
  gpu: GpuModel,
  storage: StorageModel,
  psu: PsuModel,
  case: CaseModel,
}
```

- [ ] **Step 4: Verify build + tests**

Run: `npx vite build`
Expected: build succeeds.
Run: `npx vitest run`
Expected: 33 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/models/PsuModel.jsx src/components/models/CaseModel.jsx src/components/models/partModelRegistry.js
git commit -m "feat: add detailed PSU and case models — all 8 categories complete"
```

---

### Task 6: Camera/Lighting Polish + Deploy

**Files:**
- Modify: `src/components/BuildCanvas.jsx`

- [ ] **Step 1: Tune the camera and lighting for the new scale**

In `src/components/BuildCanvas.jsx`, update the `<Canvas>` camera and lights so the full assembly (case shell is 3.2 units) fits in frame:
- Change `camera={{ position: [0, 2, 5], fov: 45 }}` to `camera={{ position: [3.5, 2.5, 4.5], fov: 50 }}`
- Change `<ambientLight intensity={0.4} />` to `<ambientLight intensity={0.6} />`

Leave the directional light, Environment, OrbitControls, and the parts map unchanged.

- [ ] **Step 2: Verify build + tests**

Run: `npx vite build`
Expected: build succeeds.
Run: `npx vitest run`
Expected: 33 tests pass.

- [ ] **Step 3: Manual browser check**

Run: `npx vite dev` and open the local URL. Verify:
- Enter a budget, pick a motherboard → detailed green PCB with socket/slots appears
- Add a CPU → small chip seats in the socket area
- Add a cooler → finned tower appears above the CPU
- Add RAM → red-heatspreader sticks stand to the right of the socket
- Add a GPU → card with two fans sits below the board
- Add a case → translucent shell encloses the build, parts still visible inside
- Click-drag still rotates the whole assembly
Stop the dev server when done.

- [ ] **Step 4: Commit**

```bash
git add src/components/BuildCanvas.jsx
git commit -m "feat: tune camera and lighting for the assembled 3D build"
```

- [ ] **Step 5: Push (triggers Netlify auto-deploy)**

```bash
git push origin main
```
Verify the Netlify deploy goes green, then load the live site and run the same flow as Step 3.

---

## Self-Review

**Spec coverage:**
- 8 detailed models → Tasks 2–5 ✓
- Clean architecture (one file per category + registry + dispatcher) → Tasks 2–5 ✓
- Pure testable `assemblyLayout` → Task 1 ✓
- Realistic assembly (motherboard anchor, true mount positions) → Task 1 positions + Task 6 verify ✓
- No-motherboard fallback → Task 1 FALLBACK + test ✓
- Unknown category fallback → Task 1 DEFAULT_TRANSFORM + dispatcher box + test ✓
- Testing (unit for layout, build + manual for geometry, no regressions) → every task ✓

**Type consistency:** `assemblyLayout(category, selectedParts) → {position, rotation}` used identically in the test and `PartModel.jsx`. `MODEL_REGISTRY` keyed by the same 8 category strings as `partsData.json`. `PartModel` receives `{ part, selectedParts }` and BuildCanvas passes both. Consistent.

**Placeholders:** none — every code step has complete content.
