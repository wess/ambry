const parseCSV = (text: string, delimiter = ","): { headers: string[]; rows: string[][] } => {
  const lines = text.split("\n")
  if (lines.length === 0) return { headers: [], rows: [] }

  const parseLine = (line: string): string[] => {
    const fields: string[] = []
    let current = ""
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"'
          i++
        } else if (ch === '"') {
          inQuotes = false
        } else {
          current += ch
        }
      } else {
        if (ch === '"') {
          inQuotes = true
        } else if (ch === delimiter) {
          fields.push(current)
          current = ""
        } else if (ch !== "\r") {
          current += ch
        }
      }
    }
    fields.push(current)
    return fields
  }

  const headers = parseLine(lines[0])
  const rows = lines.slice(1).filter((l) => l.trim()).map(parseLine)
  return { headers, rows }
}

export const csvToInsertSql = (table: string, csv: string, delimiter = ","): string[] => {
  const { headers, rows } = parseCSV(csv, delimiter)
  if (headers.length === 0) return []

  const cols = headers.map((h) => `"${h.trim()}"`).join(", ")
  return rows.map((row) => {
    const vals = row.map((v) => {
      const trimmed = v.trim()
      if (trimmed === "" || trimmed.toLowerCase() === "null") return "NULL"
      if (/^-?\d+(\.\d+)?$/.test(trimmed)) return trimmed
      return `'${trimmed.replace(/'/g, "''")}'`
    }).join(", ")
    return `INSERT INTO "${table}" (${cols}) VALUES (${vals})`
  })
}

export { parseCSV }
