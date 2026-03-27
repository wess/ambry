import { on } from "butter"
import { listConnections, saveConnection, deleteConnection, getConnection } from "./storage"
import { connect, disconnect, createAdapter } from "../db"
import { setActiveConnectionId } from "../state"
import { startHealthCheck, stopHealthCheck, getHealthStatus } from "./health"
import type { ConnectionConfig } from "../db/types"

const toConfig = (conn: any): ConnectionConfig => ({
  id: conn.id,
  type: conn.type,
  host: conn.host,
  port: conn.port,
  database: conn.database,
  username: conn.username,
  password: conn.password,
  filepath: conn.filepath,
  ssl: conn.ssl,
  ssh: conn.ssh,
  startupCommands: conn.startupCommands,
})

export const registerConnectionHandlers = () => {
  on("connection:list", async () => {
    return await listConnections()
  })

  on("connection:save", async (data: any) => {
    const conn = {
      ...data,
      id: data.id || crypto.randomUUID(),
    }
    return await saveConnection(conn)
  })

  on("connection:delete", async (id: any) => {
    stopHealthCheck(id as string)
    await disconnect(id as string)
    return await deleteConnection(id as string)
  })

  on("connection:test", async (data: any) => {
    const config = toConfig({ ...data, id: "test" })
    const adapter = createAdapter(config)
    try {
      await adapter.connect()
      const version = await adapter.getVersion()
      await adapter.disconnect()
      return { ok: true, version }
    } catch (err: any) {
      return { ok: false, error: err.message }
    }
  })

  on("connection:connect", async (id: any) => {
    const conn = await getConnection(id as string)
    if (!conn) throw new Error(`Connection not found: ${id}`)
    await connect(toConfig(conn))
    setActiveConnectionId(id as string)
    startHealthCheck(id as string)
    return true
  })

  on("connection:disconnect", async (id: any) => {
    stopHealthCheck(id as string)
    await disconnect(id as string)
    return true
  })

  on("connection:health", async (id: any) => {
    return { status: getHealthStatus(id as string) }
  })
}
