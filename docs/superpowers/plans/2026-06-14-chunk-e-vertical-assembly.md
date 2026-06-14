# Chunk E — Realistic Vertical Tower Assembly Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-orient the 3D parts to sit like a real ATX build inside the case (vertical motherboard, horizontal GPU in the PCIe slot, PSU basement, fans at the front), and render case fans as the actual pack count.

**Architecture:** `assemblyLayout.js` gains per-part `position` AND `rotation` for an upright in-case arrangement (motherboard anchored at origin, rotated vertical; other parts in world space around it). `FansModel` reads `part.specs.count` to render the right number of fans. `BuildCanvas` camera/lighting is re-framed for the upright build.

**Tech Stack:** React Three Fiber, Three.js, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-14-builder-realism-ui-design.md`

**Note:** `node`/`npx` are NOT on PATH. In PowerShell prepend: `$env:Path = "C:\Program Files\nodejs;" + $env:Path`. Commit locally; do NOT push/deploy. Depends on Chunk D. Exact 3D values here are a reasoned first cut; the final task includes a manual visual check where positions get fine-tuned.

---

### Task E1: Vertical Tower Layout (assemblyLayout)

**Files:**
- Modify: `src/lib/assemblyLayout.js`
- Modify: `src/tests/assemblyLayout.test.js`

Coordinate convention: the motherboard stays anchored at the origin but is **rotated vertical** (`rotation [Math.PI/2, 0, 0]`), so its PCB stands in the XY plane and its components face the viewer (+Z). Other parts are placed in world space: things mounted on the board sit just in front of it (+Z) and share its rotation; the GPU is a horizontal card lower down extending toward +Z; the PSU sits in the basement (−Y).

- [ ] **Step 1: Update the assemblyLayout tests for the vertical layout**

In `src/tests/assemblyLayout.test.js`:

(a) REPLACE the test titled `'mounts the GPU above the board so it is visible, not hidden under it'` with:
```js
  it('mounts the GPU in front of the board plane so it is visible', () => {
    expect(assemblyLayout('gpu', withMb).position[2]).toBeGreaterThan(0)
  })
```

(b) ADD this test inside the `describe('assemblyLayout', ...)` block:
```js
  it('stands the motherboard vertical (non-zero rotation)', () => {
    const r = assemblyLayout('motherboard', withMb).rotation
    expect(r.some((v) => v !== 0)).toBe(true)
  })
```

(The existing `'places the motherboard at the origin'` test still holds — the board stays at position `[0,0,0]`, only its rotation changes.)

- [ ] **Step 2: Run to verify the new tests fail**

Run: `npx vitest run src/tests/assemblyLayout.test.js`
Expected: FAIL — current GPU z is `0.55`... wait, GPU z is currently `0.55` (> 0) so (a) passes already; but the motherboard rotation test (b) FAILS because the current motherboard rotation is `[0,0,0]`. Confirm (b) fails.

- [ ] **Step 3: Rewrite MOUNTED with the vertical-tower transforms**

In `src/lib/assemblyLayout.js`, replace the entire `MOUNTED` object with:
```js
const MOUNTED = {
  // Board anchored at origin, stood up vertical; components face the viewer (+Z).
  motherboard: { position: [0, 0, 0],       rotation: [Math.PI / 2, 0, 0] },
  // Mounted on the board face, just in front of it, sharing its vertical rotation.
  cpu:         { position: [0, 0.4, 0.1],    rotation: [Math.PI / 2, 0, 0] },
  cooler:      { position: [0, 0.4, 0.4],    rotation: [Math.PI / 2, 0, 0] },
  ram:         { position: [0.7, 0.4, 0.1],  rotation: [0, Math.PI / 2, 0] },
  storage:     { position: [-0.7, 0.0, 0.1], rotation: [Math.PI / 2, 0, 0] },
  // Horizontal graphics card in the lower PCIe slot, extending toward the front.
  gpu:         { position: [0, -0.35, 0.5],  rotation: [0, 0, 0] },
  // Power supply in the bottom basement of the case.
  psu:         { position: [0, -1.15, 0.0],  rotation: [0, 0, 0] },
  case:        { position: [0, 0, 0],        rotation: [0, 0, 0] },
  // Intake fans at the front of the case, facing the viewer.
  fans:        { position: [0, 0, 1.35],     rotation: [0, 0, 0] },
}
```
(Leave `FALLBACK`, `DEFAULT_TRANSFORM`, and the `assemblyLayout` function body unchanged.)

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/tests/assemblyLayout.test.js`
Expected: PASS (motherboard rotation now non-zero; GPU z `0.5` > 0; motherboard position still `[0,0,0]`).

- [ ] **Step 5: Full suite + commit**

Run: `npx vitest run` → all pass.
```bash
git add src/lib/assemblyLayout.js src/tests/assemblyLayout.test.js
git commit -m "feat: vertical in-case tower layout (board upright, GPU horizontal, PSU basement)"
```

---

### Task E2: Fan-Count Rendering + Camera Re-frame

**Files:**
- Modify: `src/components/models/FansModel.jsx`
- Modify: `src/components/BuildCanvas.jsx`

- [ ] **Step 1: Render the actual fan count**

Replace `src/components/models/FansModel.jsx` ENTIRELY with:
```jsx
// One fan unit (frame + hub + blades), built around its own origin.
function Fan() {
  return (
    <group>
      <mesh>
        <boxGeometry args={[0.6, 0.6, 0.12]} />
        <meshStandardMaterial color="#222222" metalness={0.4} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.07]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.06, 20]} />
        <meshStandardMaterial color="#444444" />
      </mesh>
      {Array.from({ length: 7 }).map((_, i) => (
        <mesh key={i} position={[0, 0, 0.06]} rotation={[0, 0, (i / 7) * Math.PI * 2]}>
          <boxGeometry args={[0.26, 0.08, 0.02]} />
          <meshStandardMaterial color="#5577aa" metalness={0.3} roughness={0.5} />
        </mesh>
      ))}
    </group>
  )
}

export default function FansModel({ part }) {
  const count = Math.max(1, Math.min(3, part?.specs?.count ?? 1))
  const spacing = 0.66
  const startX = -((count - 1) / 2) * spacing

  return (
    <group>
      {Array.from({ length: count }).map((_, i) => (
        <group key={i} position={[startX + i * spacing, 0, 0]}>
          <Fan />
        </group>
      ))}
    </group>
  )
}
```

- [ ] **Step 2: Re-frame the camera for the upright build**

In `src/components/BuildCanvas.jsx`, the current Canvas camera line is:
```jsx
      <Canvas camera={{ position: [3.5, 2.5, 4.5], fov: 50 }}>
```
Change it to a straighter, slightly higher front-three-quarter view of the upright tower:
```jsx
      <Canvas camera={{ position: [3.2, 1.6, 5.2], fov: 48 }}>
```
(Leave lights, Environment, OrbitControls, and the parts map unchanged.)

- [ ] **Step 3: Verify build + tests**

Run: `npx vite build` → succeeds.
Run: `npx vitest run` → all pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/models/FansModel.jsx src/components/BuildCanvas.jsx
git commit -m "feat: render case fans by pack count; re-frame camera for upright build"
```

---

## Self-Review

**Spec coverage (Chunk E):** vertical board + horizontal GPU + PSU basement + on-board parts (E1) ✓; fan-count rendering at front intake (E1 fans position + E2 FansModel) ✓; camera re-frame (E2) ✓.

**Type consistency:** `assemblyLayout` still returns `{ position, rotation }` (both length-3) for every category; `FansModel` reads `part.specs.count` (the field authored in the catalog). GPU `position[2] > 0` matches the updated test.

**Placeholders:** none. The 3D transform values are an explicit first cut; the Chunk-G/final manual check is where they get visually refined.
