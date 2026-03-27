import type { ConnectionConfig, DbAdapter } from "./types"
import { createPostgresAdapter } from "./postgres"
import { createSqliteAdapter } from "./sqlite"
import { createMysqlAdapter } from "./mysql"
import { openTunnel, closeTunnel } from "../ssh"

const activeConnections = new Map<string, DbAdapter>()

export const createAdapter = (config: ConnectionConfig): DbAdapter => {
  switch (config.type) {
    case "postgres": return createPostgresAdapter(config)
    case "sqlite": return createSqliteAdapter(config)
    case "mysql": return createMysqlAdapter(config)
    default: throw new Error(`Unsupported database type: ${config.type}`)
  }
}

export const connect = async (config: ConnectionConfig): Promise<void> => {
  if (activeConnections.has(config.id)) return

  let effectiveConfig = config

  // Set up SSH tunnel if configured
  if (config.ssh?.enabled && config.type !== "sqlite") {
    const localPort = await openTunnel(config.id, config.ssh, config.host, config.port)
    effectiveConfig = { ...config, host: "127.0.0.1", port: localPort }
  }

  const adapter = createAdapter(effectiveConfig)
  await adapter.connect()
  activeConnections.set(config.id, adapter)

  // Run startup commands if configured
  if (config.startupCommands) {
    const cmds = config.startupCommands.split("\n").map((s) => s.trim()).filter(Boolean)
    for (const cmd of cmds) {
      try { await adapter.query(cmd) } catch { /* non-fatal */ }
    }
  }
}

export const disconnect = async (id: string): Promise<void> => {
  const adapter = activeConnections.get(id)
  if (adapter) {
    await adapter.disconnect()
    activeConnections.delete(id)
  }
  await closeTunnel(id)
}

export const getAdapter = (id: string): DbAdapter => {
  const adapter = activeConnections.get(id)
  if (!adapter) throw new Error(`No active connection: ${id}`)
  return adapter
}

export const isConnected = (id: string): boolean =>
  activeConnections.has(id)

export type { ConnectionConfig, DbAdapter } from "./types"
