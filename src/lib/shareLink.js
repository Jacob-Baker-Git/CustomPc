import useBuilderStore from '../store/useBuilderStore'
import { encodeBuild, decodeBuild } from './buildCodec'

export function buildShareUrl() {
  const { budget, resolution, selectedParts, selectedPeripherals } = useBuilderStore.getState()
  const code = encodeBuild({ budget, resolution, parts: selectedParts, peripherals: selectedPeripherals })
  return `${window.location.origin}${window.location.pathname}?build=${code}`
}

export function applyShareLinkFromUrl() {
  const code = new URLSearchParams(window.location.search).get('build')
  if (!code) return false
  const decoded = decodeBuild(code)
  if (decoded) {
    useBuilderStore.setState({
      budget: decoded.budget,
      resolution: decoded.resolution,
      selectedParts: decoded.parts,
      selectedPeripherals: decoded.peripherals,
    })
  }
  // Strip the param either way so a refresh doesn't reload a stale link.
  window.history.replaceState({}, '', window.location.pathname)
  return Boolean(decoded)
}
