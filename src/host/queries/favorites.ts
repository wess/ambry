import { join } from "path"
import { homedir } from "os"
import { mkdir } from "fs/promises"

export type Favorite = {
  id: string
  name: string
  sql: string
  createdAt: string
}

const dataDir = join(homedir(), ".ambry")
const filePath = join(dataDir, "favorites.json")

const ensureDir = async () => {
  await mkdir(dataDir, { recursive: true })
}

const readAll = async (): Promise<Favorite[]> => {
  await ensureDir()
  const file = Bun.file(filePath)
  if (!(await file.exists())) return []
  return file.json()
}

const writeAll = async (favorites: Favorite[]): Promise<void> => {
  await ensureDir()
  await Bun.write(filePath, JSON.stringify(favorites, null, 2))
}

export const listFavorites = async (): Promise<Favorite[]> =>
  readAll()

export const saveFavorite = async (fav: Favorite): Promise<Favorite> => {
  const all = await readAll()
  const idx = all.findIndex((f) => f.id === fav.id)
  if (idx >= 0) {
    all[idx] = fav
  } else {
    all.push(fav)
  }
  await writeAll(all)
  return fav
}

export const deleteFavorite = async (id: string): Promise<boolean> => {
  const all = await readAll()
  const filtered = all.filter((f) => f.id !== id)
  if (filtered.length === all.length) return false
  await writeAll(filtered)
  return true
}
