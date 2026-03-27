export type DatabaseType = "postgres" | "sqlite" | "mysql"

export type SslConfig = {
  mode: "disabled" | "required" | "verify-ca" | "verify-identity"
  ca?: string
  cert?: string
  key?: string
}

export type SshConfig = {
  enabled: boolean
  host: string
  port: number
  username: string
  authMethod: "password" | "key"
  password?: string
  keyPath?: string
}

export type ConnectionConfig = {
  id: string
  type: DatabaseType
  host: string
  port: number
  database: string
  username: string
  password: string
  filepath?: string
  ssl?: SslConfig
  ssh?: SshConfig
  startupCommands?: string
  safeMode?: "off" | "confirm" | "readonly"
}

export type DbAdapter = {
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  query: (sql: string) => Promise<QueryResultRaw>
  getTables: () => Promise<TableInfoRaw[]>
  getColumns: (table: string) => Promise<ColumnInfoRaw[]>
  getIndexes: (table: string) => Promise<IndexInfoRaw[]>
  getForeignKeys: (table: string) => Promise<ForeignKeyInfoRaw[]>
  getDdl: (table: string) => Promise<string>
  getVersion: () => Promise<string>
  getDatabases: () => Promise<string[]>
}

export type QueryResultRaw = {
  columns: string[]
  columnTypes: Record<string, string>
  rows: Record<string, unknown>[]
  rowsAffected: number
}

export type TableInfoRaw = {
  name: string
  type: "table" | "view"
  rowCount: number | null
}

export type ColumnInfoRaw = {
  name: string
  dataType: string
  nullable: boolean
  defaultValue: string | null
  isPrimaryKey: boolean
  comment: string | null
}

export type IndexInfoRaw = {
  name: string
  columns: string[]
  type: string
  unique: boolean
}

export type ForeignKeyInfoRaw = {
  name: string
  columns: string[]
  referencedTable: string
  referencedColumns: string[]
  onDelete: string
  onUpdate: string
}
