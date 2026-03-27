import { on } from "butter"
import { getAdapter, disconnect, connect } from "../db"
import { getActiveConnectionId, setActiveConnectionId } from "../state"
import { getConnection } from "../connections/storage"
import { csvToInsertSql } from "./csvimport"
import { compareSchemas } from "./schemacompare"
import { profileTable } from "./profiling"
import { generateMockRows } from "./mockdata"

const getActive = () => {
  const id = getActiveConnectionId()
  if (!id) throw new Error("No active connection")
  return getAdapter(id)
}

const buildFilterClause = (filter: any): string => {
  const col = `"${filter.column}"`
  const val = filter.value
  const escapedVal = String(val).replace(/'/g, "''")

  switch (filter.operator) {
    case "=": return `${col} = '${escapedVal}'`
    case "!=": return `${col} != '${escapedVal}'`
    case "contains": return `${col} LIKE '%${escapedVal}%'`
    case "not_contains": return `${col} NOT LIKE '%${escapedVal}%'`
    case "starts_with": return `${col} LIKE '${escapedVal}%'`
    case "ends_with": return `${col} LIKE '%${escapedVal}'`
    case ">": return `${col} > '${escapedVal}'`
    case "<": return `${col} < '${escapedVal}'`
    case ">=": return `${col} >= '${escapedVal}'`
    case "<=": return `${col} <= '${escapedVal}'`
    case "is_null": return `${col} IS NULL`
    case "is_not_null": return `${col} IS NOT NULL`
    case "in": {
      const items = String(val).split(",").map((s) => `'${s.trim().replace(/'/g, "''")}'`).join(", ")
      return `${col} IN (${items})`
    }
    case "between": {
      const v2 = String(filter.value2).replace(/'/g, "''")
      return `${col} BETWEEN '${escapedVal}' AND '${v2}'`
    }
    default: return ""
  }
}

export const registerTableHandlers = () => {
  on("tables:list", async (connectionId: any) => {
    setActiveConnectionId(connectionId as string)
    return await getActive().getTables()
  })

  on("table:rows", async (data: any) => {
    const { table, page, pageSize, sort, filters, filterLogic } = data
    const adapter = getActive()

    let where = ""
    if (filters && filters.length > 0) {
      const clauses = filters.map((f: any) => buildFilterClause(f)).filter(Boolean)
      if (clauses.length > 0) {
        const joiner = filterLogic === "or" ? " OR " : " AND "
        where = `WHERE ${clauses.join(joiner)}`
      }
    }

    const orderBy = sort ? `ORDER BY "${sort.column}" ${sort.direction}` : ""
    const offset = (page - 1) * pageSize
    const limit = `LIMIT ${pageSize} OFFSET ${offset}`

    const countResult = await adapter.query(`SELECT COUNT(*) as total FROM "${table}" ${where}`)
    const total = Number(countResult.rows[0]?.total ?? 0)

    const result = await adapter.query(
      `SELECT * FROM "${table}" ${where} ${orderBy} ${limit}`
    )

    return {
      rows: result.rows,
      columns: result.columns,
      columnTypes: result.columnTypes,
      total,
      page,
      pageSize,
    }
  })

  on("table:structure", async (data: any) => {
    const adapter = getActive()
    const [columns, indexes, foreignKeys] = await Promise.all([
      adapter.getColumns(data.table),
      adapter.getIndexes(data.table),
      adapter.getForeignKeys(data.table),
    ])
    return { columns, indexes, foreignKeys }
  })

  on("table:ddl", async (data: any) => {
    return await getActive().getDdl(data.table)
  })

  on("row:insert", async (data: any) => {
    const { table, row } = data
    const keys = Object.keys(row)
    if (keys.length === 0) {
      await getActive().query(`INSERT INTO "${table}" DEFAULT VALUES`)
      return true
    }
    const cols = keys.map((k) => `"${k}"`).join(", ")
    const placeholders = keys.map((k) => {
      const v = row[k]
      if (v === null) return "NULL"
      if (typeof v === "number") return String(v)
      return `'${String(v).replace(/'/g, "''")}'`
    }).join(", ")
    await getActive().query(`INSERT INTO "${table}" (${cols}) VALUES (${placeholders})`)
    return true
  })

  on("row:update", async (data: any) => {
    const { table, primaryKey, changes } = data
    const setClauses = Object.entries(changes).map(([k, v]) => {
      if (v === null) return `"${k}" = NULL`
      if (typeof v === "number") return `"${k}" = ${v}`
      return `"${k}" = '${String(v).replace(/'/g, "''")}'`
    }).join(", ")
    const whereClauses = Object.entries(primaryKey).map(([k, v]) => {
      if (v === null) return `"${k}" IS NULL`
      if (typeof v === "number") return `"${k}" = ${v}`
      return `"${k}" = '${String(v).replace(/'/g, "''")}'`
    }).join(" AND ")
    await getActive().query(`UPDATE "${table}" SET ${setClauses} WHERE ${whereClauses}`)
    return true
  })

  on("row:delete", async (data: any) => {
    const { table, primaryKey } = data
    const whereClauses = Object.entries(primaryKey).map(([k, v]) => {
      if (v === null) return `"${k}" IS NULL`
      if (typeof v === "number") return `"${k}" = ${v}`
      return `"${k}" = '${String(v).replace(/'/g, "''")}'`
    }).join(" AND ")
    await getActive().query(`DELETE FROM "${table}" WHERE ${whereClauses}`)
    return true
  })

  on("databases:list", async (connectionId: any) => {
    const id = connectionId as string
    const adapter = getAdapter(id)
    return await adapter.getDatabases()
  })

  on("database:switch", async (data: any) => {
    const { connectionId, database } = data
    const conn = await getConnection(connectionId)
    if (!conn) throw new Error(`Connection not found: ${connectionId}`)
    await disconnect(connectionId)
    const config = {
      ...conn,
      database,
      ssl: conn.ssl,
      ssh: conn.ssh,
    }
    await connect(config as any)
    setActiveConnectionId(connectionId)
    return true
  })

  on("export:data", async (data: any) => {
    const { table, sql: rawSql, format } = data
    const adapter = getActive()

    let result
    if (rawSql) {
      result = await adapter.query(rawSql)
    } else if (table) {
      result = await adapter.query(`SELECT * FROM "${table}"`)
    } else {
      throw new Error("No table or SQL provided for export")
    }

    switch (format) {
      case "csv": {
        const header = result.columns.join(",")
        const rows = result.rows.map((row) =>
          result.columns.map((col) => {
            const v = row[col]
            if (v === null || v === undefined) return ""
            const s = String(v)
            return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s
          }).join(",")
        )
        return [header, ...rows].join("\n")
      }
      case "json":
        return JSON.stringify(result.rows, null, 2)
      case "sql": {
        if (!table) throw new Error("Table name required for SQL export")
        return result.rows.map((row) => {
          const cols = result.columns.map((c) => `"${c}"`).join(", ")
          const vals = result.columns.map((c) => {
            const v = row[c]
            if (v === null || v === undefined) return "NULL"
            if (typeof v === "number") return String(v)
            return `'${String(v).replace(/'/g, "''")}'`
          }).join(", ")
          return `INSERT INTO "${table}" (${cols}) VALUES (${vals});`
        }).join("\n")
      }
      default:
        throw new Error(`Unknown format: ${format}`)
    }
  })

  on("import:sql", async (data: any) => {
    const adapter = getActive()
    // If a file path is provided, read it first
    const sql = data.path
      ? await Bun.file(data.path).text()
      : data.sql
    if (!sql) return { success: false, error: "No SQL provided", rowsAffected: 0 }
    try {
      const result = await adapter.query(sql)
      return { success: true, rowsAffected: result.rowsAffected }
    } catch (err: any) {
      return { success: false, error: err.message, rowsAffected: 0 }
    }
  })

  on("export:file", async (data: any) => {
    const { table, format, filename, path: filePath, options } = data
    const adapter = getActive()
    const result = await adapter.query(`SELECT * FROM "${table}"`)

    let content: string
    switch (format) {
      case "csv": {
        const delim = options?.delimiter || ","
        const nullAs = options?.nullAs ?? ""
        const escapeField = (v: unknown): string => {
          if (v === null || v === undefined) return nullAs
          const s = String(v)
          if (s.includes(delim) || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`
          return s
        }
        const lines: string[] = []
        if (options?.includeHeaders !== false) {
          lines.push(result.columns.map(escapeField).join(delim))
        }
        for (const row of result.rows) {
          lines.push(result.columns.map((col) => escapeField(row[col])).join(delim))
        }
        content = lines.join("\n")
        break
      }
      case "json":
        content = JSON.stringify(result.rows, null, 2)
        break
      case "sql": {
        content = result.rows.map((row) => {
          const cols = result.columns.map((c) => `"${c}"`).join(", ")
          const vals = result.columns.map((c) => {
            const v = row[c]
            if (v === null || v === undefined) return "NULL"
            if (typeof v === "number") return String(v)
            if (typeof v === "boolean") return v ? "TRUE" : "FALSE"
            return `'${String(v).replace(/'/g, "''")}'`
          }).join(", ")
          return `INSERT INTO "${table}" (${cols}) VALUES (${vals});`
        }).join("\n")
        break
      }
      default:
        throw new Error(`Unknown export format: ${format}`)
    }

    if (!filePath) return { path: null, rows: 0 }
    await Bun.write(filePath, content)
    return { path: filePath, rows: result.rows.length }
  })

  on("import:csvfile", async (data: any) => {
    const { table, path } = data
    const csv = await Bun.file(path).text()
    const adapter = getActive()
    const delimiter = path.endsWith(".tsv") ? "\t" : ","
    const statements = csvToInsertSql(table, csv, delimiter)
    let inserted = 0
    let error: string | undefined
    for (const stmt of statements) {
      try {
        await adapter.query(stmt)
        inserted++
      } catch (err: any) {
        error = `Row ${inserted + 1}: ${err.message}`
        break
      }
    }
    return { inserted, total: statements.length, error }
  })

  on("import:csv", async (data: any) => {
    const { table, csv, delimiter } = data
    const adapter = getActive()
    const statements = csvToInsertSql(table, csv, delimiter || ",")
    let inserted = 0
    let error: string | undefined
    for (const stmt of statements) {
      try {
        await adapter.query(stmt)
        inserted++
      } catch (err: any) {
        error = `Row ${inserted + 1}: ${err.message}`
        break
      }
    }
    return { inserted, total: statements.length, error }
  })

  on("schema:compare", async (data: any) => {
    const { sourceConnectionId, targetConnectionId } = data
    const sourceAdapter = getAdapter(sourceConnectionId)
    const targetAdapter = getAdapter(targetConnectionId)

    const sourceTables = await sourceAdapter.getTables()
    const targetTables = await targetAdapter.getTables()

    const sourceSchemas = await Promise.all(
      sourceTables.filter((t) => t.type === "table").map(async (t) => ({
        name: t.name,
        columns: await sourceAdapter.getColumns(t.name),
      }))
    )
    const targetSchemas = await Promise.all(
      targetTables.filter((t) => t.type === "table").map(async (t) => ({
        name: t.name,
        columns: await targetAdapter.getColumns(t.name),
      }))
    )

    return compareSchemas(sourceSchemas, targetSchemas)
  })

  on("table:profile", async (data: any) => {
    const adapter = getActive()
    return await profileTable(adapter, data.table)
  })

  on("table:mockdata", async (data: any) => {
    const { table, count } = data
    const adapter = getActive()
    const columns = await adapter.getColumns(table)
    const rows = generateMockRows(columns, count || 10)

    let inserted = 0
    let error: string | undefined
    for (const row of rows) {
      const keys = Object.keys(row)
      if (keys.length === 0) continue
      const cols = keys.map((k) => `"${k}"`).join(", ")
      const vals = keys.map((k) => {
        const v = row[k]
        if (v === null) return "NULL"
        if (typeof v === "number") return String(v)
        if (typeof v === "boolean") return v ? "TRUE" : "FALSE"
        return `'${String(v).replace(/'/g, "''")}'`
      }).join(", ")
      try {
        await adapter.query(`INSERT INTO "${table}" (${cols}) VALUES (${vals})`)
        inserted++
      } catch (err: any) {
        error = `Row ${inserted + 1}: ${err.message}`
        break
      }
    }
    return { inserted, total: rows.length, error }
  })
}
