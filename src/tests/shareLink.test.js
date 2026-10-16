import { describe, it, expect, beforeEach } from 'vitest'
import useBuilderStore from '../store/useBuilderStore'
import useSavedStore from '../store/useSavedStore'
import { encodeBuild } from '../lib/buildCodec'
import { buildShareUrl, applyShareLinkFromUrl, shareUrlFromCode } from '../lib/shareLink'
import partsData from '../data/partsData.json'

const cpu = partsData.find((p) => p.id === 'cpu-ryzen-7-7700x')
const gpu = partsData.find((p) => p.id === 'gpu-rtx-4060ti')

beforeEach(() => {
  useBuilderStore.setState({ budget: 0, selectedParts: {}, selectedPeripherals: {}, resolution: '1440p', flow: 'hub', lastGenerated: null })
  useSavedStore.setState({ saved: [] })
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

  // Opening a stranger's link used to overwrite the visitor's own build with no
  // way back. The build they had is saved first, and they land on the shared one.
  describe('when the visitor already has a build', () => {
    const open = (parts) => {
      window.history.pushState({}, '', '/?build=' + encodeBuild({ budget: 900, resolution: '1440p', parts, peripherals: {} }))
      return applyShareLinkFromUrl()
    }

    it('saves the existing build before replacing it', () => {
      useBuilderStore.setState({ budget: 1500, selectedParts: { cpu } })
      const mine = encodeBuild({ budget: 1500, resolution: '1440p', parts: { cpu }, peripherals: {} })
      open({ gpu })
      const { saved } = useSavedStore.getState()
      expect(saved).toHaveLength(1)
      expect(saved[0].code).toBe(mine)
      expect(useBuilderStore.getState().selectedParts).toEqual({ gpu })
      expect(useBuilderStore.getState().lastGenerated).toEqual({ shared: true, savedPrevious: true })
    })

    it('saves nothing when the build was empty', () => {
      open({ gpu })
      expect(useSavedStore.getState().saved).toHaveLength(0)
      expect(useBuilderStore.getState().lastGenerated).toEqual({ shared: true, savedPrevious: false })
    })

    it('saves nothing when the link is the build they already have', () => {
      useBuilderStore.setState({ budget: 900, selectedParts: { gpu } })
      open({ gpu })
      expect(useSavedStore.getState().saved).toHaveLength(0)
    })

    it('does not save the same build twice', () => {
      useBuilderStore.setState({ budget: 1500, selectedParts: { cpu } })
      open({ gpu })
      useBuilderStore.setState({ budget: 1500, selectedParts: { cpu } })
      open({ gpu })
      expect(useSavedStore.getState().saved).toHaveLength(1)
    })

    it('lands the visitor in the builder, on Summary', () => {
      open({ gpu })
      expect(useBuilderStore.getState().flow).toBe('builder')
      expect(window.location.hash).toBe('#summary')
    })
  })

  it('returns false when there is no build param', () => {
    expect(applyShareLinkFromUrl()).toBe(false)
  })

  it('a link that does not decode adds no #summary', () => {
    window.history.pushState({}, '', '/?build=not-a-build')
    expect(applyShareLinkFromUrl()).toBe(false)
    expect(window.location.hash).toBe('')
  })

  it('shareUrlFromCode builds a ?build= url from a code', () => {
    const url = shareUrlFromCode('ZZZ')
    expect(url).toContain('?build=ZZZ')
    expect(new URL(url).searchParams.get('build')).toBe('ZZZ')
  })
})
