import useBuilderStore from '../store/useBuilderStore'
import useSavedStore from '../store/useSavedStore'
import { encodeBuild, decodeBuild } from './buildCodec'

export function shareUrlFromCode(code) {
  return `${window.location.origin}${window.location.pathname}?build=${code}`
}

export function buildShareUrl() {
  const { budget, resolution, selectedParts, selectedPeripherals } = useBuilderStore.getState()
  const code = encodeBuild({ budget, resolution, parts: selectedParts, peripherals: selectedPeripherals })
  return shareUrlFromCode(code)
}

export function applyShareLinkFromUrl() {
  const code = new URLSearchParams(window.location.search).get('build')
  if (!code) return false
  const decoded = decodeBuild(code)
  if (decoded) {
    // The visitor's own build would otherwise be overwritten with no way back,
    // so it goes into Saved builds first - unless it is empty, is the build
    // being opened, or is already saved.
    const { budget, resolution, selectedParts, selectedPeripherals } = useBuilderStore.getState()
    const mine = encodeBuild({ budget, resolution, parts: selectedParts, peripherals: selectedPeripherals })
    const incoming = encodeBuild({ budget: decoded.budget, resolution: decoded.resolution, parts: decoded.parts, peripherals: decoded.peripherals })
    const hasBuild = Object.keys(selectedParts).length + Object.keys(selectedPeripherals).length > 0
    const { saved, saveBuild } = useSavedStore.getState()
    const savedPrevious = hasBuild && mine !== incoming && !saved.some((b) => b.code === mine)
    if (savedPrevious) saveBuild('Your build before opening a shared link', mine)

    useBuilderStore.setState({
      budget: decoded.budget,
      resolution: decoded.resolution,
      selectedParts: decoded.parts,
      selectedPeripherals: decoded.peripherals,
      flow: 'builder',
      lastGenerated: { shared: true, savedPrevious },
    })
  }
  // Strip the param either way so a refresh doesn't reload a stale link.
  window.history.replaceState({}, '', window.location.pathname)
  return Boolean(decoded)
}
