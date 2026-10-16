import useBuilderStore, { selTotalSpent, selPeripheralsTotal } from '../store/useBuilderStore'
import useSavedStore from '../store/useSavedStore'
import { encodeBuild } from '../lib/buildCodec'
import { buildShareUrl } from '../lib/shareLink'

// Save and Share for the current build, shared by the Summary page and the
// phone dock so both do exactly the same thing.
export function useBuildActions() {
  const { budget, resolution, selectedParts, selectedPeripherals } = useBuilderStore()
  const total = useBuilderStore(selTotalSpent) + useBuilderStore(selPeripheralsTotal)
  const saveBuild = useSavedStore((s) => s.saveBuild)
  const saved = useSavedStore((s) => s.saved)
  const canSave = Object.keys(selectedParts).length + Object.keys(selectedPeripherals).length > 0
  const fallbackName = `Build · £${total.toFixed(0)}`

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
