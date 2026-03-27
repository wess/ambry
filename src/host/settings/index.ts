import { on } from "butter"
import { join } from "path"
import { homedir } from "os"
import { mkdir } from "fs/promises"

const dataDir = join(homedir(), ".ambry")
const filePath = join(dataDir, "settings.json")

const ensureDir = async () => {
  await mkdir(dataDir, { recursive: true })
}

export const registerSettingsHandlers = () => {
  on("file:read", async (data: any) => {
    const file = Bun.file(data.path)
    if (!(await file.exists())) return null
    return await file.text()
  })
  on("settings:load", async () => {
    await ensureDir()
    const file = Bun.file(filePath)
    if (!(await file.exists())) return null
    try {
      return await file.json()
    } catch {
      return null
    }
  })

  on("settings:save", async (data: any) => {
    await ensureDir()
    await Bun.write(filePath, JSON.stringify(data, null, 2))
    return true
  })
}
