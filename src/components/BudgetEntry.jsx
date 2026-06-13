import { useState } from 'react'

export default function BudgetEntry({ onSubmit }) {
  const [value, setValue] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    const num = parseFloat(value)
    if (num > 0) onSubmit(num)
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-white">
      <h1 className="text-4xl font-bold mb-2">Build Your PC</h1>
      <p className="text-gray-400 mb-8 text-lg">What's your budget?</p>
      <form onSubmit={handleSubmit} aria-label="form" className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-2 text-3xl">
          <span className="text-gray-400">£</span>
          <input
            type="number"
            min="1"
            placeholder="1000"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="bg-gray-800 text-white text-3xl w-48 px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 text-center"
          />
        </div>
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-3 rounded-lg text-lg transition-colors"
        >
          Start Building
        </button>
      </form>
    </div>
  )
}
