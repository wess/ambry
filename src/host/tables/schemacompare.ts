import type { ColumnInfoRaw } from "../db/types"

export type SchemaDiff = {
  table: string
  type: "added" | "removed" | "modified"
  details: string
  sql: string
}

export const compareSchemas = (
  sourceTables: { name: string; columns: ColumnInfoRaw[] }[],
  targetTables: { name: string; columns: ColumnInfoRaw[] }[],
): SchemaDiff[] => {
  const diffs: SchemaDiff[] = []
  const sourceMap = new Map(sourceTables.map((t) => [t.name, t]))
  const targetMap = new Map(targetTables.map((t) => [t.name, t]))

  // Tables in source but not target — need to CREATE
  for (const [name, table] of sourceMap) {
    if (!targetMap.has(name)) {
      const cols = table.columns.map((c) => {
        let def = `  "${c.name}" ${c.dataType}`
        if (!c.nullable) def += " NOT NULL"
        if (c.defaultValue) def += ` DEFAULT ${c.defaultValue}`
        return def
      }).join(",\n")
      const pks = table.columns.filter((c) => c.isPrimaryKey).map((c) => `"${c.name}"`).join(", ")
      const pkClause = pks ? `,\n  PRIMARY KEY (${pks})` : ""
      diffs.push({
        table: name,
        type: "added",
        details: `Table missing in target (${table.columns.length} columns)`,
        sql: `CREATE TABLE "${name}" (\n${cols}${pkClause}\n);`,
      })
    }
  }

  // Tables in target but not source — need to DROP
  for (const [name] of targetMap) {
    if (!sourceMap.has(name)) {
      diffs.push({
        table: name,
        type: "removed",
        details: "Table exists in target but not in source",
        sql: `DROP TABLE IF EXISTS "${name}";`,
      })
    }
  }

  // Tables in both — compare columns
  for (const [name, sourceTable] of sourceMap) {
    const targetTable = targetMap.get(name)
    if (!targetTable) continue

    const sourceCols = new Map(sourceTable.columns.map((c) => [c.name, c]))
    const targetCols = new Map(targetTable.columns.map((c) => [c.name, c]))

    // Columns in source but not target — ADD COLUMN
    for (const [colName, col] of sourceCols) {
      if (!targetCols.has(colName)) {
        let def = `"${colName}" ${col.dataType}`
        if (!col.nullable) def += " NOT NULL"
        if (col.defaultValue) def += ` DEFAULT ${col.defaultValue}`
        diffs.push({
          table: name,
          type: "modified",
          details: `Add column "${colName}" (${col.dataType})`,
          sql: `ALTER TABLE "${name}" ADD COLUMN ${def};`,
        })
      }
    }

    // Columns in target but not source — DROP COLUMN
    for (const [colName] of targetCols) {
      if (!sourceCols.has(colName)) {
        diffs.push({
          table: name,
          type: "modified",
          details: `Drop column "${colName}"`,
          sql: `ALTER TABLE "${name}" DROP COLUMN "${colName}";`,
        })
      }
    }

    // Columns in both — check type/nullable changes
    for (const [colName, sourceCol] of sourceCols) {
      const targetCol = targetCols.get(colName)
      if (!targetCol) continue

      const changes: string[] = []
      if (sourceCol.dataType !== targetCol.dataType) {
        changes.push(`type ${targetCol.dataType} → ${sourceCol.dataType}`)
      }
      if (sourceCol.nullable !== targetCol.nullable) {
        changes.push(sourceCol.nullable ? "make nullable" : "make not null")
      }
      if (sourceCol.defaultValue !== targetCol.defaultValue) {
        changes.push(`default ${targetCol.defaultValue ?? "none"} → ${sourceCol.defaultValue ?? "none"}`)
      }

      if (changes.length > 0) {
        let sql = `ALTER TABLE "${name}" ALTER COLUMN "${colName}" TYPE ${sourceCol.dataType};`
        if (sourceCol.nullable !== targetCol.nullable) {
          sql += `\nALTER TABLE "${name}" ALTER COLUMN "${colName}" ${sourceCol.nullable ? "DROP NOT NULL" : "SET NOT NULL"};`
        }
        if (sourceCol.defaultValue !== targetCol.defaultValue) {
          sql += sourceCol.defaultValue
            ? `\nALTER TABLE "${name}" ALTER COLUMN "${colName}" SET DEFAULT ${sourceCol.defaultValue};`
            : `\nALTER TABLE "${name}" ALTER COLUMN "${colName}" DROP DEFAULT;`
        }
        diffs.push({
          table: name,
          type: "modified",
          details: `Column "${colName}": ${changes.join(", ")}`,
          sql,
        })
      }
    }
  }

  return diffs
}
