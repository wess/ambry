import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "fs/promises"
import { tmpdir } from "os"
import { join } from "path"

// storage.ts resolves its data directory from homedir() at import time,
// so point HOME at a scratch directory before importing the module.
let tmp = ""
let storage: typeof import("../src/host/connections/storage")
const originalHome = process.env.HOME

beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), "ambry-storage-"))
  process.env.HOME = tmp
  storage = await import("../src/host/connections/storage")
})

afterAll(async () => {
  process.env.HOME = originalHome
  if (tmp) await rm(tmp, { recursive: true, force: true })
})

const conn = {
  id: "c1",
  name: "Local PG",
  type: "postgres" as const,
  host: "localhost",
  port: 5432,
  database: "app",
  username: "postgres",
  password: "secret",
  color: "blue",
  ssl: { mode: "required" as const },
}

describe("connection storage", () => {
  test("starts empty", async () => {
    expect(await storage.listConnections()).toEqual([])
  })

  test("saves and reads a connection back unchanged", async () => {
    await storage.saveConnection(conn)
    const all = await storage.listConnections()
    expect(all).toHaveLength(1)
    expect(all[0]).toEqual(conn)
    expect(all[0].ssl?.mode).toBe("required")
  })

  test("getConnection finds by id", async () => {
    const found = await storage.getConnection("c1")
    expect(found?.name).toBe("Local PG")
    expect(await storage.getConnection("missing")).toBeUndefined()
  })

  test("saving an existing id updates in place rather than duplicating", async () => {
    await storage.saveConnection({ ...conn, name: "Renamed" })
    const all = await storage.listConnections()
    expect(all).toHaveLength(1)
    expect(all[0].name).toBe("Renamed")
  })

  test("delete removes the connection and reports success", async () => {
    expect(await storage.deleteConnection("c1")).toBe(true)
    expect(await storage.listConnections()).toEqual([])
  })

  test("deleting a missing connection returns false", async () => {
    expect(await storage.deleteConnection("nope")).toBe(false)
  })
})
