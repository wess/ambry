import { on } from "butter"
import { join } from "path"
import { homedir } from "os"
import { mkdir } from "fs/promises"

export type MacroStep = {
  action: "query" | "navigate" | "switchdb"
  params: Record<string, string>
}

export type Macro = {
  id: string
  name: string
  steps: MacroStep[]
  parameters?: string[]
  shortcut?: string
  createdAt: string
}

const dataDir = join(homedir(), ".ambry")
const filePath = join(dataDir, "macros.json")

const ensureDir = async () => {
  await mkdir(dataDir, { recursive: true })
}

const readAll = async (): Promise<Macro[]> => {
  await ensureDir()
  const file = Bun.file(filePath)
  if (!(await file.exists())) return []
  try { return await file.json() } catch { return [] }
}

const writeAll = async (macros: Macro[]): Promise<void> => {
  await ensureDir()
  await Bun.write(filePath, JSON.stringify(macros, null, 2))
}

export const registerMacroHandlers = () => {
  on("macros:list", async () => {
    return await readAll()
  })

  on("macros:save", async (data: any) => {
    const all = await readAll()
    const macro: Macro = {
      id: data.id || crypto.randomUUID(),
      name: data.name,
      steps: data.steps,
      parameters: data.parameters,
      shortcut: data.shortcut,
      createdAt: data.createdAt || new Date().toISOString(),
    }
    const idx = all.findIndex((m) => m.id === macro.id)
    if (idx >= 0) all[idx] = macro
    else all.push(macro)
    await writeAll(all)
    return macro
  })

  on("macros:delete", async (id: any) => {
    const all = await readAll()
    await writeAll(all.filter((m) => m.id !== id))
    return true
  })

  on("macros:export", async (id: any) => {
    const all = await readAll()
    const macro = all.find((m) => m.id === id)
    if (!macro) throw new Error("Macro not found")
    return JSON.stringify(macro, null, 2)
  })

  on("macros:import", async (data: any) => {
    const macro = typeof data === "string" ? JSON.parse(data) : data
    macro.id = crypto.randomUUID()
    macro.createdAt = new Date().toISOString()
    const all = await readAll()
    all.push(macro)
    await writeAll(all)
    return macro
  })
}
