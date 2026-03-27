import { join } from "path"
import { homedir } from "os"
import { mkdir } from "fs/promises"

type HistoryEntry = {
  id: string
  sql: string
  connectionId: string
  executedAt: string
  executionTime: number
  rowsAffected: number
  error?: string
}

const dataDir = join(homedir(), ".ambry")
const filePath = join(dataDir, "history.json")
const MAX_ENTRIES = 500

const ensureDir = async () => {
  await mkdir(dataDir, { recursive: true })
}

const readHistory = async (): Promise<HistoryEntry[]> => {
  await ensureDir()
  const file = Bun.file(filePath)
  if (!(await file.exists())) return []
  return file.json()
}

const writeHistory = async (entries: HistoryEntry[]): Promise<void> => {
  await ensureDir()
  await Bun.write(filePath, JSON.stringify(entries, null, 2))
}

export const addHistoryEntry = async (entry: HistoryEntry): Promise<void> => {
  const all = await readHistory()
  all.unshift(entry)
  if (all.length > MAX_ENTRIES) all.length = MAX_ENTRIES
  await writeHistory(all)
}

export const getHistory = async (): Promise<HistoryEntry[]> =>
  readHistory()
