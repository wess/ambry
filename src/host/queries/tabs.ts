import { join } from "path"
import { homedir } from "os"
import { mkdir } from "fs/promises"

type SavedTab = {
  id: string
  title: string
  sql: string
}

const dataDir = join(homedir(), ".ambry")
const filePath = join(dataDir, "tabs.json")

const ensureDir = async () => {
  await mkdir(dataDir, { recursive: true })
}

export const loadTabs = async (): Promise<SavedTab[]> => {
  await ensureDir()
  const file = Bun.file(filePath)
  if (!(await file.exists())) return []
  try {
    return await file.json()
  } catch {
    return []
  }
}

export const saveTabs = async (tabs: SavedTab[]): Promise<void> => {
  await ensureDir()
  await Bun.write(filePath, JSON.stringify(tabs, null, 2))
}
