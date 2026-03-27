import { on } from "butter"
import { join } from "path"
import { homedir } from "os"
import { mkdir, readdir } from "fs/promises"

export type PluginManifest = {
  name: string
  version: string
  description: string
  type: "driver" | "export" | "theme"
  author?: string
  entry: string
}

export type InstalledPlugin = PluginManifest & {
  path: string
  enabled: boolean
}

const pluginsDir = join(homedir(), ".ambry", "plugins")
const registryUrl = "https://raw.githubusercontent.com/ambry-app/plugins/main/registry.json"

const ensureDir = async () => {
  await mkdir(pluginsDir, { recursive: true })
}

const loadInstalled = async (): Promise<InstalledPlugin[]> => {
  await ensureDir()
  const plugins: InstalledPlugin[] = []
  try {
    const entries = await readdir(pluginsDir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const manifestPath = join(pluginsDir, entry.name, "manifest.json")
      const file = Bun.file(manifestPath)
      if (!(await file.exists())) continue
      try {
        const manifest = await file.json() as PluginManifest
        plugins.push({
          ...manifest,
          path: join(pluginsDir, entry.name),
          enabled: true,
        })
      } catch { /* skip malformed */ }
    }
  } catch { /* empty */ }
  return plugins
}

const configPath = join(homedir(), ".ambry", "plugins.json")

const loadPluginConfig = async (): Promise<Record<string, boolean>> => {
  const file = Bun.file(configPath)
  if (!(await file.exists())) return {}
  try { return await file.json() } catch { return {} }
}

const savePluginConfig = async (config: Record<string, boolean>): Promise<void> => {
  await ensureDir()
  await Bun.write(configPath, JSON.stringify(config, null, 2))
}

export const registerPluginHandlers = () => {
  on("plugins:list", async () => {
    const installed = await loadInstalled()
    const config = await loadPluginConfig()
    return installed.map((p) => ({
      ...p,
      enabled: config[p.name] !== false,
    }))
  })

  on("plugins:toggle", async (data: any) => {
    const { name, enabled } = data
    const config = await loadPluginConfig()
    config[name] = enabled
    await savePluginConfig(config)
    return true
  })

  on("plugins:registry", async () => {
    // Fetch from remote registry
    try {
      const res = await fetch(registryUrl)
      if (!res.ok) return []
      return await res.json()
    } catch {
      // Return a built-in set of known plugins
      return [
        { name: "ambry-mongodb", version: "0.1.0", description: "MongoDB driver", type: "driver", author: "ambry" },
        { name: "ambry-redis", version: "0.1.0", description: "Redis driver", type: "driver", author: "ambry" },
        { name: "ambry-duckdb", version: "0.1.0", description: "DuckDB driver", type: "driver", author: "ambry" },
        { name: "ambry-xlsx-export", version: "0.1.0", description: "Excel XLSX export", type: "export", author: "ambry" },
        { name: "ambry-dracula", version: "0.1.0", description: "Dracula theme", type: "theme", author: "ambry" },
        { name: "ambry-nord", version: "0.1.0", description: "Nord theme", type: "theme", author: "ambry" },
      ]
    }
  })

  on("plugins:install", async (data: any) => {
    const { name, url } = data
    await ensureDir()
    const pluginDir = join(pluginsDir, name)
    await mkdir(pluginDir, { recursive: true })

    if (url) {
      // Download and extract
      try {
        const res = await fetch(url)
        const content = await res.text()
        await Bun.write(join(pluginDir, "index.ts"), content)
      } catch (err: any) {
        throw new Error(`Failed to download plugin: ${err.message}`)
      }
    }

    // Create manifest if not present
    const manifestPath = join(pluginDir, "manifest.json")
    if (!(await Bun.file(manifestPath).exists())) {
      await Bun.write(manifestPath, JSON.stringify({
        name,
        version: data.version || "0.1.0",
        description: data.description || "",
        type: data.type || "driver",
        entry: "index.ts",
      }, null, 2))
    }

    return true
  })

  on("plugins:uninstall", async (data: any) => {
    const pluginDir = join(pluginsDir, data.name)
    try {
      await Bun.$`rm -rf ${pluginDir}`.quiet()
    } catch { /* */ }
    return true
  })
}
