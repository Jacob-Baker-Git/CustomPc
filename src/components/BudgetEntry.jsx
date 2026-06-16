import { useState } from 'react'
import Backdrop from './Backdrop'

export default function BudgetEntry({ onSubmit }) {
  const [value, setValue] = useState('1000')

  function handleSubmit(e) {
    e.preventDefault()
    const num = parseFloat(value)
    if (num > 0) onSubmit(num)
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center text-white bg-[#05080f]">
      <Backdrop />
      <div className="relative z-10 flex flex-col items-center">
        <h1 className="text-5xl font-bold mb-2 bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">
          Build Your PC
        </h1>
        <p className="text-gray-400 mb-10 text-lg">What's your budget?</p>
        <form onSubmit={handleSubmit} aria-label="form" className="flex flex-col items-center gap-6">
          <div className="flex items-center gap-2 text-3xl">
            <span className="text-cyan-300">£</span>
            <input
              autoFocus
              type="number"
              min="1"
              placeholder="e.g. 1500"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="bg-slate-950/60 backdrop-blur-md text-white font-mono text-3xl w-52 px-4 py-3 rounded-sm border border-slate-700/70 focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_25px_rgba(34,211,238,0.35)] text-center transition-all"
            />
          </div>
          <button
            type="submit"
            className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:shadow-[0_0_25px_rgba(34,211,238,0.45)] text-white font-semibold px-10 py-3 rounded-sm text-lg transition-all"
          >
            Start Building
          </button>
        </form>
      </div>
    </div>
  )
}
