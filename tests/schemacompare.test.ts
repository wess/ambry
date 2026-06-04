import { describe, expect, test } from "bun:test"
import { compareSchemas } from "../src/host/tables/schemacompare"
import type { ColumnInfoRaw } from "../src/host/db/types"

const col = (name: string, over: Partial<ColumnInfoRaw> = {}): ColumnInfoRaw => ({
  name,
  dataType: "text",
  nullable: true,
  defaultValue: null,
  isPrimaryKey: false,
  comment: null,
  ...over,
})

describe("compareSchemas", () => {
  test("emits CREATE TABLE for tables only in source", () => {
    const diffs = compareSchemas(
      [{ name: "users", columns: [col("id", { dataType: "integer", nullable: false, isPrimaryKey: true })] }],
      [],
    )
    expect(diffs).toHaveLength(1)
    expect(diffs[0].type).toBe("added")
    expect(diffs[0].sql).toContain(`CREATE TABLE "users"`)
    expect(diffs[0].sql).toContain(`PRIMARY KEY ("id")`)
  })

  test("emits DROP TABLE for tables only in target", () => {
    const diffs = compareSchemas([], [{ name: "old", columns: [col("id")] }])
    expect(diffs).toHaveLength(1)
    expect(diffs[0].type).toBe("removed")
    expect(diffs[0].sql).toBe(`DROP TABLE IF EXISTS "old";`)
  })

  test("emits ADD COLUMN for a column only in source", () => {
    const diffs = compareSchemas(
      [{ name: "t", columns: [col("a"), col("b", { dataType: "integer" })] }],
      [{ name: "t", columns: [col("a")] }],
    )
    expect(diffs).toHaveLength(1)
    expect(diffs[0].sql).toBe(`ALTER TABLE "t" ADD COLUMN "b" integer;`)
  })

  test("emits DROP COLUMN for a column only in target", () => {
    const diffs = compareSchemas(
      [{ name: "t", columns: [col("a")] }],
      [{ name: "t", columns: [col("a"), col("gone")] }],
    )
    expect(diffs).toHaveLength(1)
    expect(diffs[0].sql).toBe(`ALTER TABLE "t" DROP COLUMN "gone";`)
  })

  test("detects type and nullability changes on shared columns", () => {
    const diffs = compareSchemas(
      [{ name: "t", columns: [col("a", { dataType: "bigint", nullable: false })] }],
      [{ name: "t", columns: [col("a", { dataType: "integer", nullable: true })] }],
    )
    expect(diffs).toHaveLength(1)
    expect(diffs[0].sql).toContain(`TYPE bigint`)
    expect(diffs[0].sql).toContain(`SET NOT NULL`)
  })

  test("reports no diffs for identical schemas", () => {
    const schema = [{ name: "t", columns: [col("a"), col("b")] }]
    expect(compareSchemas(schema, schema)).toEqual([])
  })
})
