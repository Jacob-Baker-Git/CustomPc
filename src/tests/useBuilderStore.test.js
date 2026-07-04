import useBuilderStore, {
  selTotalSpent, selRemainingBudget, selTotalPower, selPsuWattage, selPeripheralsTotal
} from '../store/useBuilderStore'
import partsData from '../data/partsData.json'

const cpu = partsData.find(p => p.id === 'cpu-ryzen-7-7700x')
const gpu = partsData.find(p => p.id === 'gpu-rtx-4060ti')
const psu = partsData.find(p => p.id === 'psu-bequiet-750w')

beforeEach(() => {
  localStorage.clear()
  useBuilderStore.setState({ budget: 0, selectedParts: {}, selectedPeripherals: {} })
})

describe('useBuilderStore', () => {
  it('sets budget', () => {
    useBuilderStore.getState().setBudget(1200)
    expect(useBuilderStore.getState().budget).toBe(1200)
  })

  it('adds a part', () => {
    useBuilderStore.getState().addPart('cpu', cpu)
    expect(useBuilderStore.getState().selectedParts.cpu).toEqual(cpu)
  })

  it('removes a part', () => {
    useBuilderStore.getState().addPart('cpu', cpu)
    useBuilderStore.getState().removePart('cpu')
    expect(useBuilderStore.getState().selectedParts.cpu).toBeUndefined()
  })

  it('persists budget and parts to localStorage so a refresh resumes the build', () => {
    useBuilderStore.getState().setBudget(1200)
    useBuilderStore.getState().addPart('cpu', cpu)
    const saved = JSON.parse(localStorage.getItem('custompc-builder-v1'))
    expect(saved.state.budget).toBe(1200)
    expect(saved.state.selectedParts.cpu.id).toBe('cpu-ryzen-7-7700x')
  })

  it('persists resolution and peripherals but not transient UI state', () => {
    useBuilderStore.getState().setResolution('4k')
    useBuilderStore.getState().addPeripheral('monitor', { id: 'mon-x', price: 300 })
    const saved = JSON.parse(localStorage.getItem('custompc-builder-v1'))
    expect(saved.state.resolution).toBe('4k')
    expect(saved.state.selectedPeripherals.monitor.id).toBe('mon-x')
    expect(saved.state.caseTransparent).toBeUndefined()
  })

  it('clearBuild empties parts and peripherals but keeps budget', () => {
    useBuilderStore.getState().setBudget(1500)
    useBuilderStore.getState().addPart('cpu', cpu)
    useBuilderStore.getState().addPeripheral('monitor', { price: 300 })
    useBuilderStore.getState().clearBuild()
    expect(useBuilderStore.getState().selectedParts).toEqual({})
    expect(useBuilderStore.getState().selectedPeripherals).toEqual({})
    expect(useBuilderStore.getState().budget).toBe(1500)
  })

  it('setBuild replaces all selected parts at once', () => {
    useBuilderStore.getState().addPart('cpu', cpu)
    useBuilderStore.getState().setBuild({ gpu })
    expect(useBuilderStore.getState().selectedParts.cpu).toBeUndefined()
    expect(useBuilderStore.getState().selectedParts.gpu).toEqual(gpu)
  })

  it('selTotalSpent sums part prices', () => {
    useBuilderStore.getState().addPart('cpu', cpu)
    useBuilderStore.getState().addPart('gpu', gpu)
    expect(selTotalSpent(useBuilderStore.getState())).toBeCloseTo(cpu.price + gpu.price)
  })

  it('selRemainingBudget subtracts spend from budget', () => {
    useBuilderStore.getState().setBudget(1000)
    useBuilderStore.getState().addPart('cpu', cpu)
    expect(selRemainingBudget(useBuilderStore.getState())).toBeCloseTo(1000 - cpu.price)
  })

  it('selTotalPower sums TDPs', () => {
    useBuilderStore.getState().addPart('cpu', cpu)
    useBuilderStore.getState().addPart('gpu', gpu)
    expect(selTotalPower(useBuilderStore.getState())).toBe(cpu.tdp + gpu.tdp)
  })

  it('selPsuWattage is null with no PSU', () => {
    expect(selPsuWattage(useBuilderStore.getState())).toBeNull()
  })

  it('selPsuWattage returns PSU wattage when selected', () => {
    useBuilderStore.getState().addPart('psu', psu)
    expect(selPsuWattage(useBuilderStore.getState())).toBe(750)
  })

  it('adds and removes a peripheral independently of selectedParts', () => {
    const mon = { id: 'mon-x', category: 'monitor', name: 'Mon', price: 300 }
    useBuilderStore.getState().addPeripheral('monitor', mon)
    expect(useBuilderStore.getState().selectedPeripherals.monitor).toEqual(mon)
    expect(useBuilderStore.getState().selectedParts.monitor).toBeUndefined()
    useBuilderStore.getState().removePeripheral('monitor')
    expect(useBuilderStore.getState().selectedPeripherals.monitor).toBeUndefined()
  })

  it('selPeripheralsTotal sums peripheral prices', () => {
    useBuilderStore.getState().addPeripheral('monitor', { price: 300 })
    useBuilderStore.getState().addPeripheral('mouse', { price: 60 })
    expect(selPeripheralsTotal(useBuilderStore.getState())).toBeCloseTo(360)
  })

  it('peripherals do not affect selTotalSpent', () => {
    useBuilderStore.getState().addPeripheral('monitor', { price: 300 })
    expect(selTotalSpent(useBuilderStore.getState())).toBe(0)
  })
})
