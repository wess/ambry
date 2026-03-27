import { SQL } from "bun"
import type { ConnectionConfig, DbAdapter, QueryResultRaw, TableInfoRaw, ColumnInfoRaw, IndexInfoRaw, ForeignKeyInfoRaw } from "./types"

export const createMysqlAdapter = (config: ConnectionConfig): DbAdapter => {
  let db: SQL | null = null

  const getDb = (): SQL => {
    if (!db) throw new Error("Not connected")
    return db
  }

  return {
    connect: async () => {
      const opts: Record<string, unknown> = {
        url: `mysql://${config.username}:${config.password}@${config.host}:${config.port}/${config.database}`,
      }
      if (config.ssl && config.ssl.mode !== "disabled") {
        const tls: Record<string, unknown> = { rejectUnauthorized: config.ssl.mode === "verify-identity" || config.ssl.mode === "verify-ca" }
        if (config.ssl.ca) tls.ca = Bun.file(config.ssl.ca)
        if (config.ssl.cert) tls.cert = Bun.file(config.ssl.cert)
        if (config.ssl.key) tls.key = Bun.file(config.ssl.key)
        opts.tls = tls
      }
      db = new SQL(opts as any)
      await db`SELECT 1`
    },

    disconnect: async () => {
      if (db) {
        db.close()
        db = null
      }
    },

    query: async (sql: string): Promise<QueryResultRaw> => {
      const result = await getDb().unsafe(sql)
      const rows = [...result] as Record<string, unknown>[]
      const columns = rows.length > 0 ? Object.keys(rows[0]) : []
      return {
        columns,
        columnTypes: {},
        rows,
        rowsAffected: result.count ?? rows.length,
      }
    },

    getTables: async (): Promise<TableInfoRaw[]> => {
      const rows = await getDb()`
        SELECT
          TABLE_NAME as name,
          CASE TABLE_TYPE WHEN 'BASE TABLE' THEN 'table' ELSE 'view' END as type,
          TABLE_ROWS as row_count
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
        ORDER BY TABLE_NAME
      `
      return [...rows].map((r: any) => ({
        name: r.name,
        type: r.type as "table" | "view",
        rowCount: r.row_count != null ? Number(r.row_count) : null,
      }))
    },

    getColumns: async (table: string): Promise<ColumnInfoRaw[]> => {
      const rows = await getDb()`
        SELECT
          COLUMN_NAME as name,
          COLUMN_TYPE as data_type,
          IS_NULLABLE = 'YES' as nullable,
          COLUMN_DEFAULT as default_value,
          COLUMN_KEY = 'PRI' as is_primary_key,
          COLUMN_COMMENT as comment
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ${table}
        ORDER BY ORDINAL_POSITION
      `
      return [...rows].map((r: any) => ({
        name: r.name,
        dataType: r.data_type,
        nullable: Boolean(r.nullable),
        defaultValue: r.default_value,
        isPrimaryKey: Boolean(r.is_primary_key),
        comment: r.comment || null,
      }))
    },

    getIndexes: async (table: string): Promise<IndexInfoRaw[]> => {
      const rows = await getDb()`
        SELECT
          INDEX_NAME as name,
          GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) as columns_str,
          INDEX_TYPE as type,
          NOT NON_UNIQUE as is_unique
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ${table}
        GROUP BY INDEX_NAME, INDEX_TYPE, NON_UNIQUE
        ORDER BY INDEX_NAME
      `
      return [...rows].map((r: any) => ({
        name: r.name,
        columns: (r.columns_str as string).split(","),
        type: r.type,
        unique: Boolean(r.is_unique),
      }))
    },

    getForeignKeys: async (table: string): Promise<ForeignKeyInfoRaw[]> => {
      const rows = await getDb()`
        SELECT
          CONSTRAINT_NAME as name,
          GROUP_CONCAT(DISTINCT COLUMN_NAME) as columns_str,
          REFERENCED_TABLE_NAME as referenced_table,
          GROUP_CONCAT(DISTINCT REFERENCED_COLUMN_NAME) as ref_columns_str
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ${table}
          AND REFERENCED_TABLE_NAME IS NOT NULL
        GROUP BY CONSTRAINT_NAME, REFERENCED_TABLE_NAME
      `
      const actions = await getDb()`
        SELECT CONSTRAINT_NAME as name, DELETE_RULE as on_delete, UPDATE_RULE as on_update
        FROM information_schema.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ${table}
      `
      const actionMap = new Map([...actions].map((a: any) => [a.name, a]))
      return [...rows].map((r: any) => {
        const action = actionMap.get(r.name) as any ?? {}
        return {
          name: r.name,
          columns: (r.columns_str as string).split(","),
          referencedTable: r.referenced_table,
          referencedColumns: (r.ref_columns_str as string).split(","),
          onDelete: action.on_delete ?? "NO ACTION",
          onUpdate: action.on_update ?? "NO ACTION",
        }
      })
    },

    getDdl: async (table: string): Promise<string> => {
      const rows = await getDb().unsafe(`SHOW CREATE TABLE \`${table}\``)
      const row = [...rows][0] as any
      return row?.["Create Table"] ?? row?.["Create View"] ?? ""
    },

    getVersion: async (): Promise<string> => {
      const rows = await getDb()`SELECT VERSION() as v`
      const row = [...rows][0] as any
      return `MySQL ${row?.v ?? "unknown"}`
    },

    getDatabases: async (): Promise<string[]> => {
      const rows = await getDb()`SHOW DATABASES`
      return [...rows].map((r: any) => r.Database)
    },
  }
}
