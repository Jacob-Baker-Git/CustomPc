import useBuilderStore, { selTotalSpent, selPeripheralsTotal } from '../store/useBuilderStore'
import useSavedStore from '../store/useSavedStore'
import { encodeBuild } from '../lib/buildCodec'
import { buildShareUrl } from '../lib/shareLink'
import { gbp } from '../lib/money'

// Save and Share for the current build, shared by the Summary page and the
// phone dock so both do exactly the same thing.
export function useBuildActions() {
  // One selector per field: a bare useBuilderStore() re-rendered the Dock and
  // Summary on every store change (hover, fold, flow), not just these four.
  const budget = useBuilderStore((s) => s.budget)
  const resolution = useBuilderStore((s) => s.resolution)
  const selectedParts = useBuilderStore((s) => s.selectedParts)
  const selectedPeripherals = useBuilderStore((s) => s.selectedPeripherals)
  const total = useBuilderStore(selTotalSpent) + useBuilderStore(selPeripheralsTotal)
  const saveBuild = useSavedStore((s) => s.saveBuild)
  const saved = useSavedStore((s) => s.saved)
  const canSave = Object.keys(selectedParts).length + Object.keys(selectedPeripherals).length > 0
  const fallbackName = `Build · ${gbp(total)}`

  function save(name) {
    if (!canSave) return
    const code = encodeBuild({ budget, resolution, parts: selectedParts, peripherals: selectedPeripherals })
    // The same build saved twice is two identical entries to tell apart later.
    if (saved.some((b) => b.code === code)) return
    saveBuild(name?.trim() || fallbackName, code)
  }

  // Resolves true once the link is on the clipboard, false where the clipboard
  // is unavailable (insecure context, denied permission).
  async function share() {
    try {
      await navigator.clipboard.writeText(buildShareUrl())
      return true
    } catch {
      return false
    }
  }

  return { save, share, canSave, fallbackName }
}
