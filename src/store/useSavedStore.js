import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const useSavedStore = create(
  persist(
    (set) => ({
      saved: [],
      saveBuild: (name, code) =>
        set((state) => ({
          saved: [{ id: newId(), name, savedAt: Date.now(), code }, ...state.saved],
        })),
      removeSaved: (id) =>
        set((state) => ({ saved: state.saved.filter((b) => b.id !== id) })),
    }),
    { name: 'custompc-saved-v1', version: 1 }
  )
)

export default useSavedStore
