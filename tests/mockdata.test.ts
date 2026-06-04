import { describe, expect, test } from "bun:test"
import { generateMockRows } from "../src/host/tables/mockdata"
import type { ColumnInfoRaw } from "../src/host/db/types"

const col = (name: string, over: Partial<ColumnInfoRaw> = {}): ColumnInfoRaw => ({
  name,
  dataType: "text",
  nullable: false,
  defaultValue: null,
  isPrimaryKey: false,
  comment: null,
  ...over,
})

describe("generateMockRows", () => {
  test("generates the requested number of rows", () => {
    const rows = generateMockRows([col("name")], 25)
    expect(rows).toHaveLength(25)
  })

  test("omits auto-increment serial primary keys", () => {
    const rows = generateMockRows([col("id", { dataType: "serial", isPrimaryKey: true }), col("name")], 3)
    expect(rows.every((r) => !("id" in r))).toBe(true)
    expect(rows.every((r) => "name" in r)).toBe(true)
  })

  test("assigns sequential integer primary keys", () => {
    const rows = generateMockRows([col("id", { dataType: "integer", isPrimaryKey: true })], 3)
    expect(rows.map((r) => r.id)).toEqual([1, 2, 3])
  })

  test("produces email-shaped values for email columns", () => {
    const rows = generateMockRows([col("email")], 5)
    expect(rows.every((r) => String(r.email).includes("@"))).toBe(true)
  })

  test("respects boolean column types", () => {
    const rows = generateMockRows([col("active", { dataType: "boolean" })], 10)
    expect(rows.every((r) => typeof r.active === "boolean")).toBe(true)
  })

  test("produces integers within range for int columns", () => {
    const rows = generateMockRows([col("qty", { dataType: "integer" })], 20)
    expect(rows.every((r) => Number.isInteger(r.qty))).toBe(true)
  })
})
