import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { createSqliteAdapter } from "../src/host/db/sqlite"
import type { ConnectionConfig, DbAdapter } from "../src/host/db/types"

const config: ConnectionConfig = {
  id: "test",
  type: "sqlite",
  host: "",
  port: 0,
  database: ":memory:",
  username: "",
  password: "",
}

describe("sqlite adapter", () => {
  let db: DbAdapter

  beforeEach(async () => {
    db = createSqliteAdapter(config)
    await db.connect()
    await db.query(`CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT)`)
    await db.query(`CREATE TABLE posts (id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id), title TEXT)`)
    await db.query(`CREATE INDEX idx_posts_user ON posts(user_id)`)
    await db.query(`INSERT INTO users (name, email) VALUES ('Alice', 'a@x.io'), ('Bob', NULL)`)
  })

  afterEach(async () => {
    await db.disconnect()
  })

  test("throws when querying before connect", async () => {
    const fresh = createSqliteAdapter(config)
    expect(fresh.query("SELECT 1")).rejects.toThrow("Not connected")
  })

  test("SELECT returns columns and rows", async () => {
    const res = await db.query("SELECT id, name FROM users ORDER BY id")
    expect(res.columns).toEqual(["id", "name"])
    expect(res.rows).toEqual([
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ])
  })

  test("INSERT reports rows affected and no columns", async () => {
    const res = await db.query(`INSERT INTO users (name) VALUES ('Carol')`)
    expect(res.rowsAffected).toBe(1)
    expect(res.columns).toEqual([])
  })

  test("getTables lists user tables sorted, excluding internal", async () => {
    const tables = await db.getTables()
    expect(tables.map((t) => t.name)).toEqual(["posts", "users"])
  })

  test("getColumns reports types, nullability, and primary key", async () => {
    const cols = await db.getColumns("users")
    const byName = Object.fromEntries(cols.map((c) => [c.name, c]))
    expect(byName.id.isPrimaryKey).toBe(true)
    expect(byName.name.nullable).toBe(false)
    expect(byName.email.nullable).toBe(true)
  })

  test("getIndexes includes the declared index", async () => {
    const idx = await db.getIndexes("posts")
    expect(idx.some((i) => i.columns.includes("user_id"))).toBe(true)
  })

  test("getForeignKeys resolves the referenced table", async () => {
    const fks = await db.getForeignKeys("posts")
    expect(fks).toHaveLength(1)
    expect(fks[0].referencedTable).toBe("users")
    expect(fks[0].columns).toEqual(["user_id"])
  })

  test("getVersion returns a SQLite version string", async () => {
    expect(await db.getVersion()).toContain("SQLite")
  })
})
