// What a catalogue row has to look like on the wire to survive an upsert.
//
// 🛑 WHY THIS EXISTS. The Supabase tables do NOT hold a row as JSON alone. A few
// fields are mirrored out of the JSON into real columns, and every one of them
// is NOT NULL:
//
//   parts, peripherals : id, category, name, price, data, updated_at
//   games              : id, name, data, updated_at
//
// An upsert is an INSERT carrying ON CONFLICT DO UPDATE, so PostgREST validates
// the INSERT path even when every row already exists and nothing will actually
// be inserted. Sending { id, data } therefore leaves category/name/price null
// and Postgres rejects the entire batch with 23502 — which is exactly how the
// first real run of catalog-push failed, on `parts`, before writing anything.
//
// ⚠️ Keep this in step with the table definitions. A column added there and not
// here fails the same way, at the same point: after the network round trip, on
// the first row, naming a column rather than a field.
//
// This module is pure so it can be tested; the CLI does the fetching.

const MIRRORED = {
  parts: ['category', 'name', 'price'],
  peripherals: ['category', 'name', 'price'],
  games: ['name'],
}

export function mirroredColumns(table) {
  const columns = MIRRORED[table]
  if (!columns) throw new Error(`No column mapping for table "${table}" — add one before pushing to it`)
  return columns
}

// ⚠️ Absence is `undefined` or `null`, and nothing else. `price` of 0 and an
// empty-string name are real values; a falsy check here would reject them and
// be very hard to see, since the row would simply never be pushed.
const absent = (v) => v === undefined || v === null

export function upsertPayload(table, rows) {
  const columns = mirroredColumns(table)
  return rows.map((row) => {
    if (absent(row.id)) throw new Error(`${table}: a row has no id, which is the conflict target`)
    const payload = { id: row.id, data: row }
    for (const column of columns) {
      if (absent(row[column])) {
        throw new Error(`${table}: row "${row.id}" has no ${column}, which the table requires as NOT NULL`)
      }
      payload[column] = row[column]
    }
    return payload
  })
}
