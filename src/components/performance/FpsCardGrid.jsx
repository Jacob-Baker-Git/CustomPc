import FpsCard from './FpsCard'

export default function FpsCardGrid({ rows }) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {rows.map((row) => <FpsCard key={row.gameId} row={row} />)}
    </div>
  )
}
