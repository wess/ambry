import type { ColumnInfoRaw } from "../db/types"

const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
const randomFloat = (min: number, max: number) => +(Math.random() * (max - min) + min).toFixed(2)
const randomPick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

const firstNames = ["Alice", "Bob", "Charlie", "Diana", "Eve", "Frank", "Grace", "Henry", "Iris", "Jack", "Kate", "Leo", "Mia", "Noah", "Olivia", "Paul", "Quinn", "Ruby", "Sam", "Tara"]
const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Wilson", "Moore", "Taylor", "Anderson", "Thomas", "Jackson", "White", "Harris", "Martin", "Thompson", "Clark", "Lewis"]
const domains = ["example.com", "test.org", "demo.io", "sample.net", "mock.dev"]
const cities = ["New York", "London", "Tokyo", "Paris", "Berlin", "Sydney", "Toronto", "Mumbai", "Seoul", "Amsterdam"]
const words = ["lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing", "elit", "sed", "do", "eiusmod", "tempor", "incididunt", "labore", "dolore", "magna", "aliqua"]

const randomDate = (start = 2020, end = 2026): string => {
  const year = randomInt(start, end)
  const month = String(randomInt(1, 12)).padStart(2, "0")
  const day = String(randomInt(1, 28)).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const randomTimestamp = (): string =>
  `${randomDate()} ${String(randomInt(0, 23)).padStart(2, "0")}:${String(randomInt(0, 59)).padStart(2, "0")}:${String(randomInt(0, 59)).padStart(2, "0")}`

const randomSentence = (wordCount = 6): string =>
  Array.from({ length: wordCount }, () => randomPick(words)).join(" ")

const generateValue = (col: ColumnInfoRaw, rowIndex: number): unknown => {
  const t = col.dataType.toLowerCase()
  const name = col.name.toLowerCase()

  // Auto-increment / serial — skip
  if (col.isPrimaryKey && /serial|identity|autoincrement/i.test(t)) return undefined
  if (col.isPrimaryKey && /int/i.test(t)) return rowIndex + 1

  // Nullable — 10% chance of null
  if (col.nullable && Math.random() < 0.1) return null

  // Name-based heuristics
  if (name.includes("email")) return `${randomPick(firstNames).toLowerCase()}.${randomPick(lastNames).toLowerCase()}@${randomPick(domains)}`
  if (name.includes("first_name") || name === "firstname") return randomPick(firstNames)
  if (name.includes("last_name") || name === "lastname") return randomPick(lastNames)
  if (name.includes("name") && !name.includes("table")) return `${randomPick(firstNames)} ${randomPick(lastNames)}`
  if (name.includes("phone")) return `+1${randomInt(200, 999)}${randomInt(100, 999)}${randomInt(1000, 9999)}`
  if (name.includes("city")) return randomPick(cities)
  if (name.includes("url") || name.includes("website")) return `https://${randomPick(domains)}/${randomPick(words)}`
  if (name.includes("description") || name.includes("bio") || name.includes("notes")) return randomSentence(randomInt(8, 20))
  if (name.includes("title") || name.includes("subject")) return randomSentence(randomInt(3, 6))
  if (name.includes("status")) return randomPick(["active", "inactive", "pending", "archived"])
  if (name.includes("country")) return randomPick(["US", "UK", "JP", "FR", "DE", "AU", "CA", "IN", "KR", "NL"])
  if (name.includes("uuid") || name.includes("guid")) return crypto.randomUUID()

  // Type-based
  if (/bool/i.test(t)) return Math.random() > 0.5
  if (/uuid/i.test(t)) return crypto.randomUUID()
  if (/timestamp/i.test(t)) return randomTimestamp()
  if (/date/i.test(t)) return randomDate()
  if (/time/i.test(t)) return `${String(randomInt(0, 23)).padStart(2, "0")}:${String(randomInt(0, 59)).padStart(2, "0")}:00`
  if (/int|serial/i.test(t)) return randomInt(1, 10000)
  if (/float|double|decimal|numeric|real|money/i.test(t)) return randomFloat(0, 10000)
  if (/json/i.test(t)) return JSON.stringify({ key: randomPick(words), value: randomInt(1, 100) })
  if (/text|varchar|char|string/i.test(t)) {
    const maxLen = /\((\d+)\)/.exec(t)?.[1]
    const len = maxLen ? Math.min(Number(maxLen), 50) : 50
    return randomSentence(Math.min(Math.ceil(len / 6), 10)).slice(0, len)
  }

  return randomPick(words)
}

export const generateMockRows = (columns: ColumnInfoRaw[], count: number): Record<string, unknown>[] => {
  const rows: Record<string, unknown>[] = []
  for (let i = 0; i < count; i++) {
    const row: Record<string, unknown> = {}
    for (const col of columns) {
      const value = generateValue(col, i)
      if (value !== undefined) row[col.name] = value
    }
    rows.push(row)
  }
  return rows
}
