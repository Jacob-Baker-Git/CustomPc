// Read-only access to the parts/peripherals catalog in Supabase.
//
// These values are safe to ship in the client bundle: the publishable key
// only grants what Row Level Security allows, and the catalog tables are
// SELECT-only for anonymous users (no write policies exist). Env vars can
// override them for a different project.
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://igeggndtnmdpauxovnwv.supabase.co'
const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_Iu7O2Gu9K693IjISZb7GMw_CHtE5tvs'

// Each row stores the full part object in its `data` column, so the rows
// deserialise into exactly the same shape as the bundled JSON snapshot.
async function fetchTable(table) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=data&order=id`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  })
  if (!res.ok) throw new Error(`Catalog fetch failed for ${table}: HTTP ${res.status}`)
  const rows = await res.json()
  if (!Array.isArray(rows)) throw new Error(`Catalog fetch for ${table}: unexpected payload`)
  return rows.map((r) => r.data)
}

export async function fetchCatalog() {
  const [parts, peripherals] = await Promise.all([
    fetchTable('parts'),
    fetchTable('peripherals'),
  ])
  return { parts, peripherals }
}
