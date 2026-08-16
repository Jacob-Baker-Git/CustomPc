export default function SearchBar({ value, onChange, placeholder }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-surface-2 text-ink text-sm px-3 py-2 rounded-lg border border-line focus:outline-none focus:border-copper placeholder-faint transition-colors"
    />
  )
}
