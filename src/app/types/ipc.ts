import type { Connection, ConnectionFormData, ConnectionTestResult } from "./connection"
import type { TableInfo, TableStructure, RowsRequest, RowsResponse } from "./table"
import type { QueryResult, QueryHistoryEntry, Favorite } from "./query"

export type AmbryCalls = {
  "connection:list": { input: undefined; output: Connection[] }
  "connection:save": { input: ConnectionFormData; output: Connection }
  "connection:delete": { input: string; output: boolean }
  "connection:test": { input: ConnectionFormData; output: ConnectionTestResult }
  "connection:connect": { input: string; output: boolean }
  "connection:disconnect": { input: string; output: boolean }
  "tables:list": { input: string; output: TableInfo[] }
  "table:rows": { input: RowsRequest; output: RowsResponse }
  "table:structure": { input: { table: string }; output: TableStructure }
  "table:ddl": { input: { table: string }; output: string }
  "row:insert": { input: { table: string; row: Record<string, unknown> }; output: boolean }
  "row:update": { input: { table: string; primaryKey: Record<string, unknown>; changes: Record<string, unknown> }; output: boolean }
  "row:delete": { input: { table: string; primaryKey: Record<string, unknown> }; output: boolean }
  "query:execute": { input: { sql: string }; output: QueryResult }
  "query:execute:multi": { input: { sql: string }; output: (QueryResult & { sql: string })[] }
  "query:history": { input: undefined; output: QueryHistoryEntry[] }
  "favorites:list": { input: undefined; output: Favorite[] }
  "favorites:save": { input: { id?: string; name: string; sql: string }; output: Favorite }
  "favorites:delete": { input: string; output: boolean }
  "databases:list": { input: string; output: string[] }
  "database:switch": { input: { connectionId: string; database: string }; output: boolean }
  "export:data": { input: { table?: string; sql?: string; format: "csv" | "json" | "sql"; options?: Record<string, unknown> }; output: string }
  "export:file": { input: { table: string; format: "csv" | "json" | "sql"; filename: string; path: string; options?: Record<string, unknown> }; output: { path: string | null; rows: number } }
  "import:sql": { input: { sql: string }; output: { success: boolean; error?: string; rowsAffected: number } }
  "tabs:load": { input: undefined; output: { id: string; title: string; sql: string }[] }
  "tabs:save": { input: { id: string; title: string; sql: string }[]; output: boolean }
  "import:csv": { input: { table: string; csv: string; delimiter?: string }; output: { inserted: number; total: number; error?: string } }
}
