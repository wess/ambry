import { describe, expect, test } from "bun:test"
import { csvToInsertSql, parseCSV } from "../src/host/tables/csvimport"

describe("parseCSV", () => {
  test("parses headers and rows", () => {
    const { headers, rows } = parseCSV("id,name\n1,Alice\n2,Bob")
    expect(headers).toEqual(["id", "name"])
    expect(rows).toEqual([
      ["1", "Alice"],
      ["2", "Bob"],
    ])
  })

  test("honors a custom delimiter", () => {
    const { headers, rows } = parseCSV("id\tname\n1\tAlice", "\t")
    expect(headers).toEqual(["id", "name"])
    expect(rows).toEqual([["1", "Alice"]])
  })

  test("handles quoted fields containing the delimiter", () => {
    const { rows } = parseCSV('id,note\n1,"a, b, c"')
    expect(rows).toEqual([["1", "a, b, c"]])
  })

  test("handles escaped double quotes inside quoted fields", () => {
    const { rows } = parseCSV('id,note\n1,"she said ""hi"""')
    expect(rows).toEqual([["1", 'she said "hi"']])
  })

  test("skips blank trailing lines", () => {
    const { rows } = parseCSV("id\n1\n\n2\n")
    expect(rows).toEqual([["1"], ["2"]])
  })
})

describe("csvToInsertSql", () => {
  test("produces one INSERT per row with quoted identifiers", () => {
    const sql = csvToInsertSql("users", "id,name\n1,Alice")
    expect(sql).toEqual([`INSERT INTO "users" ("id", "name") VALUES (1, 'Alice')`])
  })

  test("treats numeric-looking values as numbers and others as strings", () => {
    const sql = csvToInsertSql("t", "a,b,c\n42,3.14,hello")
    expect(sql[0]).toBe(`INSERT INTO "t" ("a", "b", "c") VALUES (42, 3.14, 'hello')`)
  })

  test("maps empty and literal null to SQL NULL", () => {
    const sql = csvToInsertSql("t", "a,b\n,NULL")
    expect(sql[0]).toBe(`INSERT INTO "t" ("a", "b") VALUES (NULL, NULL)`)
  })

  test("escapes single quotes to prevent broken statements", () => {
    const sql = csvToInsertSql("t", "a\nO'Brien")
    expect(sql[0]).toBe(`INSERT INTO "t" ("a") VALUES ('O''Brien')`)
  })

  test("returns no statements for empty input", () => {
    expect(csvToInsertSql("t", "")).toEqual([])
  })
})
