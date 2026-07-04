export default function SearchBar({ value, onChange, placeholder }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-white/5 text-white text-sm px-3 py-2 rounded-sm border border-white/10 focus:outline-none focus:border-cyan-400 placeholder-gray-500 transition-colors"
    />
  )
}
