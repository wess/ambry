import { Database } from "bun:sqlite"
import type { ConnectionConfig, DbAdapter, QueryResultRaw, TableInfoRaw, ColumnInfoRaw, IndexInfoRaw, ForeignKeyInfoRaw } from "./types"

export const createSqliteAdapter = (config: ConnectionConfig): DbAdapter => {
  let db: Database | null = null

  const getDb = (): Database => {
    if (!db) throw new Error("Not connected")
    return db
  }

  return {
    connect: async () => {
      const path = config.filepath || config.database
      db = new Database(path)
      db.run("SELECT 1")
    },

    disconnect: async () => {
      if (db) {
        db.close()
        db = null
      }
    },

    query: async (sql: string): Promise<QueryResultRaw> => {
      const trimmed = sql.trim().toUpperCase()
      const isSelect = trimmed.startsWith("SELECT") ||
                       trimmed.startsWith("PRAGMA") ||
                       trimmed.startsWith("WITH")
      if (isSelect) {
        const rows = getDb().prepare(sql).all() as Record<string, unknown>[]
        const columns = rows.length > 0 ? Object.keys(rows[0]) : []
        return { columns, columnTypes: {}, rows, rowsAffected: rows.length }
      }
      const result = getDb().run(sql)
      return { columns: [], columnTypes: {}, rows: [], rowsAffected: result.changes }
    },

    getTables: async (): Promise<TableInfoRaw[]> => {
      const rows = getDb().prepare(`
        SELECT name, type FROM sqlite_master
        WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `).all() as any[]
      return rows.map((r) => ({
        name: r.name,
        type: r.type as "table" | "view",
        rowCount: null,
      }))
    },

    getColumns: async (table: string): Promise<ColumnInfoRaw[]> => {
      const rows = getDb().prepare(`PRAGMA table_info("${table}")`).all() as any[]
      return rows.map((r) => ({
        name: r.name,
        dataType: r.type || "TEXT",
        nullable: r.notnull === 0,
        defaultValue: r.dflt_value,
        isPrimaryKey: r.pk === 1,
        comment: null,
      }))
    },

    getIndexes: async (table: string): Promise<IndexInfoRaw[]> => {
      const idxList = getDb().prepare(`PRAGMA index_list("${table}")`).all() as any[]
      return idxList.map((idx) => {
        const cols = getDb().prepare(`PRAGMA index_info("${idx.name}")`).all() as any[]
        return {
          name: idx.name,
          columns: cols.map((c: any) => c.name),
          type: idx.origin === "pk" ? "PRIMARY" : "BTREE",
          unique: idx.unique === 1,
        }
      })
    },

    getForeignKeys: async (table: string): Promise<ForeignKeyInfoRaw[]> => {
      const rows = getDb().prepare(`PRAGMA foreign_key_list("${table}")`).all() as any[]
      const grouped = new Map<number, any[]>()
      for (const r of rows) {
        const list = grouped.get(r.id) ?? []
        list.push(r)
        grouped.set(r.id, list)
      }
      return [...grouped.entries()].map(([id, fks]) => ({
        name: `fk_${id}`,
        columns: fks.map((f: any) => f.from),
        referencedTable: fks[0].table,
        referencedColumns: fks.map((f: any) => f.to),
        onDelete: fks[0].on_delete,
        onUpdate: fks[0].on_update,
      }))
    },

    getDdl: async (table: string): Promise<string> => {
      const row = getDb().prepare(
        `SELECT sql FROM sqlite_master WHERE name = ?`
      ).get(table) as any
      return row?.sql ?? ""
    },

    getVersion: async (): Promise<string> => {
      const row = getDb().prepare("SELECT sqlite_version() as v").get() as any
      return `SQLite ${row?.v ?? "unknown"}`
    },

    getDatabases: async (): Promise<string[]> => {
      const path = config.filepath || config.database
      return [path.split("/").pop() || "main"]
    },
  }
}
