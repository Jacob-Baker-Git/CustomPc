import { describe, it, expect, beforeEach } from 'vitest'
import useSavedStore from '../store/useSavedStore'

beforeEach(() => { useSavedStore.setState({ saved: [] }) })

describe('useSavedStore', () => {
  it('persists to storage', () => {
    expect(useSavedStore.persist).toBeDefined()
  })
  it('saveBuild prepends a named entry with a code, id and timestamp', () => {
    useSavedStore.getState().saveBuild('My Rig', 'ABC')
    const { saved } = useSavedStore.getState()
    expect(saved).toHaveLength(1)
    expect(saved[0].name).toBe('My Rig')
    expect(saved[0].code).toBe('ABC')
    expect(typeof saved[0].id).toBe('string')
    expect(typeof saved[0].savedAt).toBe('number')
  })
  it('keeps newest save first', () => {
    useSavedStore.getState().saveBuild('First', 'A')
    useSavedStore.getState().saveBuild('Second', 'B')
    expect(useSavedStore.getState().saved.map((b) => b.name)).toEqual(['Second', 'First'])
  })
  it('removeSaved deletes by id', () => {
    useSavedStore.getState().saveBuild('X', 'A')
    const id = useSavedStore.getState().saved[0].id
    useSavedStore.getState().removeSaved(id)
    expect(useSavedStore.getState().saved).toHaveLength(0)
  })
})
