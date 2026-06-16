import { describe, it, expect, beforeEach } from 'vitest'
import useBuilderStore from '../store/useBuilderStore'
import { encodeBuild } from '../lib/buildCodec'
import { buildShareUrl, applyShareLinkFromUrl } from '../lib/shareLink'
import partsData from '../data/partsData.json'

const cpu = partsData.find((p) => p.id === 'cpu-ryzen-7-7700x')
const gpu = partsData.find((p) => p.id === 'gpu-rtx-4060ti')

beforeEach(() => {
  useBuilderStore.setState({ budget: 0, selectedParts: {}, selectedPeripherals: {}, resolution: '1440p' })
  window.history.replaceState({}, '', '/')
})

describe('shareLink', () => {
  it('buildShareUrl encodes the current build into a ?build= url', () => {
    useBuilderStore.setState({ budget: 1500, selectedParts: { cpu }, resolution: '4k' })
    const url = buildShareUrl()
    expect(url).toContain('?build=')
    const code = new URL(url).searchParams.get('build')
    expect(code).toBe(encodeBuild({ budget: 1500, resolution: '4k', parts: { cpu }, peripherals: {} }))
  })

  it('applyShareLinkFromUrl hydrates the store and strips the param', () => {
    const code = encodeBuild({ budget: 2000, resolution: '1080p', parts: { cpu, gpu }, peripherals: {} })
    window.history.pushState({}, '', '/?build=' + code)
    expect(applyShareLinkFromUrl()).toBe(true)
    const st = useBuilderStore.getState()
    expect(st.budget).toBe(2000)
    expect(st.selectedParts.cpu.id).toBe(cpu.id)
    expect(st.selectedParts.gpu.id).toBe(gpu.id)
    expect(window.location.search).toBe('')
  })

  it('returns false when there is no build param', () => {
    expect(applyShareLinkFromUrl()).toBe(false)
  })
})
