import { useState } from 'react'

export default function BudgetEntry({ onSubmit }) {
  const [value, setValue] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    const num = parseFloat(value)
    if (num > 0) onSubmit(num)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-white bg-gradient-to-br from-gray-950 via-gray-900 to-cyan-950/40">
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
            placeholder="1000"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="bg-gray-900/70 backdrop-blur-md text-white text-3xl w-52 px-4 py-3 rounded-2xl border border-white/10 focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_25px_rgba(34,211,238,0.35)] text-center transition-all"
          />
        </div>
        <button
          type="submit"
          className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:shadow-[0_0_25px_rgba(34,211,238,0.45)] text-white font-semibold px-10 py-3 rounded-2xl text-lg transition-all"
        >
          Start Building
        </button>
      </form>
    </div>
  )
}
