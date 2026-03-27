import type { DbAdapter } from "../db/types"

export type ColumnProfile = {
  column: string
  dataType: string
  totalRows: number
  nullCount: number
  nullPercent: number
  distinctCount: number
  minValue: string | null
  maxValue: string | null
  avgValue: string | null
  topValues: { value: string; count: number }[]
}

export const profileTable = async (adapter: DbAdapter, table: string): Promise<ColumnProfile[]> => {
  const columns = await adapter.getColumns(table)
  const countResult = await adapter.query(`SELECT COUNT(*) as total FROM "${table}"`)
  const totalRows = Number(countResult.rows[0]?.total ?? 0)

  const profiles: ColumnProfile[] = []

  for (const col of columns) {
    try {
      const statsResult = await adapter.query(`
        SELECT
          COUNT(*) - COUNT("${col.name}") as null_count,
          COUNT(DISTINCT "${col.name}") as distinct_count,
          MIN("${col.name}"::text) as min_val,
          MAX("${col.name}"::text) as max_val
        FROM "${table}"
      `)
      const stats = statsResult.rows[0] as any ?? {}

      let avgValue: string | null = null
      if (/int|float|double|decimal|numeric|real|money|serial/i.test(col.dataType)) {
        try {
          const avgResult = await adapter.query(`SELECT AVG("${col.name}"::numeric)::text as avg_val FROM "${table}"`)
          avgValue = (avgResult.rows[0] as any)?.avg_val ?? null
          if (avgValue) avgValue = Number(avgValue).toFixed(2)
        } catch { /* not numeric */ }
      }

      let topValues: { value: string; count: number }[] = []
      try {
        const topResult = await adapter.query(`
          SELECT "${col.name}"::text as val, COUNT(*) as cnt
          FROM "${table}"
          WHERE "${col.name}" IS NOT NULL
          GROUP BY "${col.name}"
          ORDER BY cnt DESC
          LIMIT 5
        `)
        topValues = topResult.rows.map((r: any) => ({ value: String(r.val), count: Number(r.cnt) }))
      } catch { /* skip */ }

      const nullCount = Number(stats.null_count ?? 0)
      profiles.push({
        column: col.name,
        dataType: col.dataType,
        totalRows,
        nullCount,
        nullPercent: totalRows > 0 ? Math.round((nullCount / totalRows) * 10000) / 100 : 0,
        distinctCount: Number(stats.distinct_count ?? 0),
        minValue: stats.min_val ?? null,
        maxValue: stats.max_val ?? null,
        avgValue,
        topValues,
      })
    } catch {
      profiles.push({
        column: col.name,
        dataType: col.dataType,
        totalRows,
        nullCount: 0,
        nullPercent: 0,
        distinctCount: 0,
        minValue: null,
        maxValue: null,
        avgValue: null,
        topValues: [],
      })
    }
  }

  return profiles
}
