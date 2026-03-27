export type DatabaseType = "postgres" | "sqlite" | "mysql"

export type SslMode = "disabled" | "required" | "verify-ca" | "verify-identity"

export type SslConfig = {
  mode: SslMode
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

export type Connection = {
  id: string
  name: string
  type: DatabaseType
  host: string
  port: number
  database: string
  username: string
  password: string
  color: string
  filepath?: string
  ssl?: SslConfig
  ssh?: SshConfig
  startupCommands?: string
  safeMode?: "off" | "confirm" | "readonly"
  group?: string
  tags?: string[]
}

export type ConnectionFormData = Omit<Connection, "id"> & { id?: string }

export type ConnectionTestResult = {
  ok: boolean
  error?: string
  version?: string
}
