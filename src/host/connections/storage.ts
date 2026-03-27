import { join } from "path"
import { homedir } from "os"
import { mkdir } from "fs/promises"

type StoredConnection = {
  id: string
  name: string
  type: string
  host: string
  port: number
  database: string
  username: string
  password: string
  color: string
  filepath?: string
}

const dataDir = join(homedir(), ".ambry")
const filePath = join(dataDir, "connections.json")

const ensureDir = async () => {
  await mkdir(dataDir, { recursive: true })
}

const readAll = async (): Promise<StoredConnection[]> => {
  await ensureDir()
  const file = Bun.file(filePath)
  if (!(await file.exists())) return []
  return file.json()
}

const writeAll = async (connections: StoredConnection[]): Promise<void> => {
  await ensureDir()
  await Bun.write(filePath, JSON.stringify(connections, null, 2))
}

export const listConnections = async (): Promise<StoredConnection[]> =>
  readAll()

export const saveConnection = async (conn: StoredConnection): Promise<StoredConnection> => {
  const all = await readAll()
  const idx = all.findIndex((c) => c.id === conn.id)
  if (idx >= 0) {
    all[idx] = conn
  } else {
    all.push(conn)
  }
  await writeAll(all)
  return conn
}

export const deleteConnection = async (id: string): Promise<boolean> => {
  const all = await readAll()
  const filtered = all.filter((c) => c.id !== id)
  if (filtered.length === all.length) return false
  await writeAll(filtered)
  return true
}

export const getConnection = async (id: string): Promise<StoredConnection | undefined> => {
  const all = await readAll()
  return all.find((c) => c.id === id)
}
