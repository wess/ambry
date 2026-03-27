import { SQL } from "bun"
import type { ConnectionConfig, DbAdapter, QueryResultRaw, TableInfoRaw, ColumnInfoRaw, IndexInfoRaw, ForeignKeyInfoRaw } from "./types"

export const createPostgresAdapter = (config: ConnectionConfig): DbAdapter => {
  let db: SQL | null = null

  const getDb = (): SQL => {
    if (!db) throw new Error("Not connected")
    return db
  }

  return {
    connect: async () => {
      const opts: Record<string, unknown> = {
        url: `postgres://${config.username}:${config.password}@${config.host}:${config.port}/${config.database}`,
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
          t.table_name as name,
          CASE t.table_type WHEN 'BASE TABLE' THEN 'table' ELSE 'view' END as type,
          s.n_live_tup as row_count
        FROM information_schema.tables t
        LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name
        WHERE t.table_schema = 'public'
        ORDER BY t.table_name
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
          c.column_name as name,
          c.data_type as data_type,
          c.is_nullable = 'YES' as nullable,
          c.column_default as default_value,
          COALESCE(
            (SELECT true FROM information_schema.table_constraints tc
             JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
             WHERE tc.table_name = ${table} AND tc.constraint_type = 'PRIMARY KEY'
             AND kcu.column_name = c.column_name LIMIT 1), false
          ) as is_primary_key,
          pgd.description as comment
        FROM information_schema.columns c
        LEFT JOIN pg_catalog.pg_statio_all_tables st ON st.relname = c.table_name AND st.schemaname = c.table_schema
        LEFT JOIN pg_catalog.pg_description pgd ON pgd.objoid = st.relid AND pgd.objsubid = c.ordinal_position
        WHERE c.table_name = ${table} AND c.table_schema = 'public'
        ORDER BY c.ordinal_position
      `
      return [...rows].map((r: any) => ({
        name: r.name,
        dataType: r.data_type,
        nullable: Boolean(r.nullable),
        defaultValue: r.default_value,
        isPrimaryKey: Boolean(r.is_primary_key),
        comment: r.comment ?? null,
      }))
    },

    getIndexes: async (table: string): Promise<IndexInfoRaw[]> => {
      const rows = await getDb()`
        SELECT
          i.relname as name,
          array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) as columns,
          am.amname as type,
          ix.indisunique as is_unique
        FROM pg_index ix
        JOIN pg_class t ON t.oid = ix.indrelid
        JOIN pg_class i ON i.oid = ix.indexrelid
        JOIN pg_am am ON am.oid = i.relam
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
        WHERE t.relname = ${table}
        GROUP BY i.relname, am.amname, ix.indisunique
        ORDER BY i.relname
      `
      return [...rows].map((r: any) => ({
        name: r.name,
        columns: r.columns,
        type: r.type,
        unique: Boolean(r.is_unique),
      }))
    },

    getForeignKeys: async (table: string): Promise<ForeignKeyInfoRaw[]> => {
      const rows = await getDb()`
        SELECT
          tc.constraint_name as name,
          array_agg(DISTINCT kcu.column_name) as columns,
          ccu.table_name as referenced_table,
          array_agg(DISTINCT ccu.column_name) as referenced_columns,
          rc.delete_rule as on_delete,
          rc.update_rule as on_update
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
        JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
        WHERE tc.table_name = ${table} AND tc.constraint_type = 'FOREIGN KEY'
        GROUP BY tc.constraint_name, ccu.table_name, rc.delete_rule, rc.update_rule
      `
      return [...rows].map((r: any) => ({
        name: r.name,
        columns: r.columns,
        referencedTable: r.referenced_table,
        referencedColumns: r.referenced_columns,
        onDelete: r.on_delete,
        onUpdate: r.on_update,
      }))
    },

    getDdl: async (table: string): Promise<string> => {
      const cols = await getDb()`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = ${table} AND table_schema = 'public'
        ORDER BY ordinal_position
      `
      const lines = [...cols].map((c: any) => {
        let line = `  "${c.column_name}" ${c.data_type}`
        if (c.is_nullable === "NO") line += " NOT NULL"
        if (c.column_default) line += ` DEFAULT ${c.column_default}`
        return line
      })
      return `CREATE TABLE "${table}" (\n${lines.join(",\n")}\n);`
    },

    getVersion: async (): Promise<string> => {
      const rows = await getDb()`SELECT version()`
      const row = [...rows][0] as any
      return row?.version ?? "unknown"
    },

    getDatabases: async (): Promise<string[]> => {
      const rows = await getDb()`SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname`
      return [...rows].map((r: any) => r.datname)
    },
  }
}
